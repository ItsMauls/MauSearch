import { NextRequest, NextResponse } from "next/server";
import { StageId, StageRequest } from "@/lib/schema";
import { runStage, StageError } from "@/lib/ai/run-stage";
import { intentStage } from "@/lib/ai/stages/intent";
import { clustersStage } from "@/lib/ai/stages/clusters";
import { planningStage } from "@/lib/ai/stages/planning";
import { creativeStage } from "@/lib/ai/stages/creative";
import { getRun, updateRun } from "@/lib/db";
import { RunRow } from "@/lib/db/schema";
import { applyKeywordIntents, toRunView } from "@/lib/view";

export const maxDuration = 300;

/**
 * POST /api/runs/[id]/stages - advances one desk.
 *
 * The client drives the pipeline one stage per request. That keeps every
 * request to a single model call, lets each panel appear the moment its stage
 * lands, and means a failure is isolated to one stage instead of collapsing
 * the run.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = StageRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  }

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // Recorded once per attempt, not per request: a reload re-issues this same
  // POST for the same stage, and reusing the existing timestamp instead of
  // overwriting it is what lets the client's elapsed timer resume instead of
  // restarting at 0.
  const stageStartedAt = run.stageStartedAt ?? new Date();
  if (!run.stageStartedAt) await updateRun(id, { stageStartedAt });

  const intake = {
    keyword: run.keyword,
    normalized: run.normalizedKeyword,
    market: run.market,
    language: run.language,
    country: run.market,
    lens: run.lens,
  };

  try {
    const patch = await advance(parsed.data.stage, run, intake);
    // Clear any recorded error for this stage - a successful retry is a success.
    const stageErrors = { ...run.stageErrors };
    delete stageErrors[parsed.data.stage];

    await updateRun(id, { ...patch, stageErrors, stageStartedAt: null });
    return NextResponse.json({
      run: toRunView({ ...run, ...patch, stageErrors, stageStartedAt: null }),
    });
  } catch (err) {
    if (err instanceof MissingPrerequisite) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof StageError ? err.message : `Stage failed: ${String(err)}`;
    const stageErrors = { ...run.stageErrors, [parsed.data.stage]: message };
    await updateRun(id, { stageErrors, stageStartedAt: null });
    return NextResponse.json(
      { error: message, run: toRunView({ ...run, stageErrors, stageStartedAt: null }) },
      { status: 502 }
    );
  }
}

class MissingPrerequisite extends Error {}

function need<T>(value: T | null | undefined, name: string): T {
  if (!value) throw new MissingPrerequisite(`${name} must complete before this stage`);
  return value;
}

type Intake = Parameters<typeof clustersStage.user>[0]["intake"];

/**
 * Each stage reads only the structured output of the stages before it.
 *
 * `intent` is retryable here too, even though it normally runs inside
 * POST /api/runs - otherwise a first-call intent failure would leave a run with
 * a perfectly good keyword harvest and no way forward.
 */
async function advance(
  stage: StageId,
  run: RunRow,
  intake: Intake
): Promise<Partial<RunRow>> {
  switch (stage) {
    case "intent": {
      const intent = await runStage(intentStage, { intake, keywords: run.keywords });
      return { intent, keywords: applyKeywordIntents(run.keywords, intent.keywordIntents) };
    }
    case "clusters": {
      const intent = need(run.intent, "Intent classification");
      return {
        clusters: await runStage(clustersStage, { intake, keywords: run.keywords, intent }),
      };
    }
    case "planning": {
      const intent = need(run.intent, "Intent classification");
      const clusters = need(run.clusters, "Clustering");
      return { audienceFit: await runStage(planningStage, { intake, intent, clusters }) };
    }
    case "creative": {
      const intent = need(run.intent, "Intent classification");
      const clusters = need(run.clusters, "Clustering");
      const planning = need(run.audienceFit, "Audience & fit");
      return {
        angles: await runStage(creativeStage, {
          intake,
          intent,
          clusters,
          planning,
          keywords: run.keywords,
        }),
      };
    }
  }
}
