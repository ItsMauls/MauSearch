import { after } from "next/server";
import { StageId, STAGE_IDS } from "@/lib/schema";
import { runStage, StageError } from "@/lib/ai/run-stage";
import { intentStage } from "@/lib/ai/stages/intent";
import { clustersStage } from "@/lib/ai/stages/clusters";
import { planningStage } from "@/lib/ai/stages/planning";
import { creativeStage } from "@/lib/ai/stages/creative";
import { claimRun, getRun, updateRun } from "@/lib/db";
import { RunRow } from "@/lib/db/schema";
import { applyKeywordIntents } from "@/lib/view";

/**
 * The desk pipeline runs on the server, not in the browser.
 *
 * The client used to drive it one fetch per stage, which meant closing the tab
 * stopped the run dead and a reload fired a second model call for the desk that
 * was already in flight. Here a background worker holds an exclusive lock on
 * the run, runs one desk, and hands what is left to a fresh worker. The board
 * only watches. Leaving the page is a non-event, and two workers on one desk
 * are impossible by construction.
 *
 * A desk that fails gets up to MAX_STAGE_ATTEMPTS tries, each by a fresh
 * worker, before the run is parked for the user - free-tier queue misses and
 * the odd malformed response are common enough that asking the user to click
 * "retry" for the first one is just asking them to do what the next worker
 * would have done anyway.
 */

/**
 * One desk per invocation, deliberately.
 *
 * A single free-tier call routinely takes two to three minutes, and the
 * platform kills the function at maxDuration (300s) - so four desks cannot
 * share one invocation, and guessing how many fit just produces a desk that
 * fails because it was handed the leftovers. Each worker takes exactly one
 * desk with the whole budget behind it, then hands over.
 */
const STAGE_CAP_MS = 240_000;

/** A lock this old belongs to a worker the platform killed mid-desk, so the
 *  next caller may take the run over. Sits above STAGE_CAP_MS: a desk that is
 *  genuinely still working can never look abandoned. */
const STALE_MS = 260_000;

/** A desk gets this many tries before its failure actually stops the run. A
 *  free-tier queue miss or one malformed response is common enough that
 *  surfacing it to the user on the first hit would mean "Retry this desk"
 *  is usually just doing what the next worker would have done anyway. */
const MAX_STAGE_ATTEMPTS = 3;

/** The first desk still owed: not done, and not parked on a failure the user
 *  has to retry explicitly. Null means there is nothing to drive.
 *
 *  Desks are strictly sequential - each reads every desk before it (see
 *  `advance` below) - so the first not-done desk is the only one ever in
 *  play. A `.find` that skipped a parked desk to check the next one used to
 *  live here; it let a stuck intent desk "hand off" to clusters, which
 *  immediately failed its own `need()` guard and got parked with a
 *  misleading "Retry this desk" of its own, one stage that never actually
 *  ran. Stopping at the first incomplete desk - parked or not - is what the
 *  one-desk-at-a-time contract actually requires. */
export function nextStage(run: RunRow): StageId | null {
  const done: Record<StageId, boolean> = {
    intent: Boolean(run.intent),
    clusters: Boolean(run.clusters),
    planning: Boolean(run.audienceFit),
    creative: Boolean(run.angles),
  };
  const stage = STAGE_IDS.find((id) => !done[id]);
  if (!stage || run.stageErrors?.[stage]) return null;
  return stage;
}

/**
 * Claims the run's worker lock and, only if this is genuinely a new desk
 * (not a retry hand-off, which leaves stageStartedAt set on purpose - see
 * driveRun's catch branch), stamps its true start.
 *
 * Pulled out of startDrive so scripts/check.mts can verify the claim/stamp
 * behaviour directly - the `after()` call below needs a real request scope
 * and would crash a plain script.
 */
export async function claimDesk(run: RunRow): Promise<RunRow | null> {
  const claimed = await claimRun(run.id, new Date(Date.now() - STALE_MS));
  if (!claimed) return null;
  if (!claimed.stageStartedAt) {
    claimed.stageStartedAt = new Date();
    await updateRun(claimed.id, { stageStartedAt: claimed.stageStartedAt });
  }
  return claimed;
}

/**
 * Hands the next desk to a background worker and returns the run as the caller
 * should now report it.
 *
 * Safe to call from anywhere, as often as you like: the claim is atomic, so
 * intake, a reload, a second tab, every poll and the hand-over below all
 * collapse onto the one worker that already holds the lock.
 */
export async function startDrive(run: RunRow): Promise<RunRow> {
  if (!nextStage(run)) return run;
  const claimed = await claimDesk(run);
  if (!claimed) return run;
  after(() => driveRun(claimed.id)); // outlives the response - not the client's to wait for
  return claimed;
}

/** Exported for scripts/check.mts, which drives a run end to end on fixtures. */
export async function driveRun(id: string): Promise<void> {
  const run = await getRun(id);
  if (!run) return; // deleted mid-run
  const stage = nextStage(run);
  if (!stage) {
    await updateRun(id, { stageStartedAt: null, workerLockedAt: null });
    return;
  }

  let advanced: RunRow;
  try {
    const patch = await advance(stage, run, STAGE_CAP_MS);
    // A success clears this desk's strike count - the next failure (if any)
    // starts counting from zero again, same as a fresh desk.
    const stageAttempts = { ...run.stageAttempts };
    delete stageAttempts[stage];
    // Both released in the same write that stores the result: the desk is
    // over (so its timer resets - the *next* desk gets its own fresh start),
    // and no worker is on this run any more.
    await updateRun(id, { ...patch, stageAttempts, stageStartedAt: null, workerLockedAt: null });
    advanced = { ...run, ...patch, stageAttempts, stageStartedAt: null };
  } catch (err) {
    const message = err instanceof StageError ? err.message : `Stage failed: ${String(err)}`;
    const patch = failurePatch(run, stage, message);
    await updateRun(id, {
      ...patch,
      // Always release the worker lock so a fresh one can pick this up.
      // stageStartedAt is a different story: only a genuinely exhausted desk
      // clears it (nothing is "in progress" to show a timer for any more) -
      // a silent retry keeps it, so the elapsed time the user sees is how
      // long they've waited for this desk, not how long this one attempt ran.
      stageStartedAt: patch.exhausted ? null : run.stageStartedAt,
      workerLockedAt: null,
    });
    // Not exhausted yet: hand straight to a fresh worker instead of waiting
    // for the user (or the next poll) to notice and ask again.
    if (!patch.exhausted) await handOver(id);
    return;
  }

  if (nextStage(advanced)) await handOver(id);
}

/**
 * Decides what a failed desk becomes: silently retried, or parked for the
 * user. Only a genuinely exhausted desk parks the run - everything already
 * produced stays either way, and a park resets the counter so a manual retry
 * gets the same MAX_STAGE_ATTEMPTS tries the auto-retry did.
 *
 * Exported (and kept pure - no I/O) so scripts/check.mts can verify the
 * counting and the park threshold without needing a real desk to fail.
 */
export function failurePatch(
  run: Pick<RunRow, "stageErrors" | "stageAttempts">,
  stage: StageId,
  message: string
): { stageErrors: RunRow["stageErrors"]; stageAttempts: RunRow["stageAttempts"]; exhausted: boolean } {
  const attempts = (run.stageAttempts[stage] ?? 0) + 1;
  const exhausted = attempts >= MAX_STAGE_ATTEMPTS;
  return {
    stageErrors: exhausted ? { ...run.stageErrors, [stage]: message } : run.stageErrors,
    stageAttempts: { ...run.stageAttempts, [stage]: exhausted ? 0 : attempts },
    exhausted,
  };
}

/**
 * Starts the next worker by calling the same endpoint the board polls.
 *
 * This is what makes a run finish with nobody watching it: each invocation gets
 * a fresh platform budget, and the chain runs until the pipeline is done or a
 * desk fails. A hand-over that cannot be delivered is not fatal - the run is
 * left released, so the next poll or the next visit to the board resumes it.
 */
async function handOver(id: string): Promise<void> {
  try {
    await fetch(`${appUrl()}/api/runs/${id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (err) {
    console.error(`hand-over failed for run ${id}:`, err);
  }
}

/** Where this deployment answers its own requests. APP_URL only has to be set
 *  when neither guess fits (a custom domain behind deployment protection). */
function appUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

/** Each desk reads only the structured output of the desks before it. */
async function advance(stage: StageId, run: RunRow, budgetMs: number): Promise<Partial<RunRow>> {
  const intake = {
    keyword: run.keyword,
    normalized: run.normalizedKeyword,
    market: run.market,
    language: run.language,
    country: run.market,
    lens: run.lens,
  };

  switch (stage) {
    case "intent": {
      const intent = await runStage(intentStage, { intake, keywords: run.keywords }, budgetMs);
      return { intent, keywords: applyKeywordIntents(run.keywords, intent.keywordIntents) };
    }
    case "clusters": {
      const intent = need(run.intent, "Intent classification");
      const clusters = await runStage(
        clustersStage,
        { intake, keywords: run.keywords, intent },
        budgetMs
      );
      return { clusters };
    }
    case "planning": {
      const intent = need(run.intent, "Intent classification");
      const clusters = need(run.clusters, "Clustering");
      const audienceFit = await runStage(planningStage, { intake, intent, clusters }, budgetMs);
      return { audienceFit };
    }
    case "creative": {
      const angles = await runStage(
        creativeStage,
        {
          intake,
          intent: need(run.intent, "Intent classification"),
          clusters: need(run.clusters, "Clustering"),
          planning: need(run.audienceFit, "Audience & fit"),
          keywords: run.keywords,
        },
        budgetMs
      );
      return { angles };
    }
  }
}

function need<T>(value: T | null | undefined, name: string): T {
  if (!value) throw new StageError("pipeline", `${name} must complete before this stage`);
  return value;
}
