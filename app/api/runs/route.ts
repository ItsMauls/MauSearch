import { NextRequest, NextResponse } from "next/server";
import { IntakeInput } from "@/lib/schema";
import { normalize, runHarvest } from "@/lib/pipeline";
import { runStage } from "@/lib/ai/run-stage";
import { expandStage, toHarvestedKeywords } from "@/lib/ai/stages/expand";
import { startDrive } from "@/lib/ai/drive";
import { findRecentRun, getRunBySlug, insertRun, newId } from "@/lib/db";
import { RunRow } from "@/lib/db/schema";
import { toRunView } from "@/lib/view";
import { slugify } from "@/lib/slug";

export const maxDuration = 300;

/**
 * POST /api/runs - stages 0 through 3: normalize, harvest, clean/dedupe, rule
 * signals, then hand the four AI desks to a background worker and answer.
 *
 * The desks deliberately do not run inside this request. The row is persisted
 * the moment harvest finishes and the worker takes it from there, so the answer
 * comes back as soon as there is a board to look at - and the run finishes
 * whether or not anyone is still looking at it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = IntakeInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid intake", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const intake = normalize(parsed.data);

  // An identical intake inside the cache window reuses the existing run rather
  // than re-billing the model and re-hitting Google for the same answer.
  const existing = await findRecentRun(intake.normalized, intake.market);
  if (existing) {
    // It may have been left unfinished (a failed desk, a killed worker); this
    // is where it gets picked back up.
    return NextResponse.json({ run: toRunView(await startDrive(existing)), reused: true });
  }

  // Stages 1-3: real data, entirely deterministic.
  const harvest = await runHarvest(intake, request.signal);

  // The client cancelled mid-harvest - no point finishing the fallback call or
  // persisting a run nobody is waiting on.
  if (request.signal.aborted) {
    return NextResponse.json({ error: "Cancelled" }, { status: 499 });
  }

  // Total Suggest outage is the only case that falls back to AI expansion, and
  // everything derived from it is relabelled `ai` for the user.
  let keywords = harvest.keywords;
  if (harvest.status === "unavailable") {
    // Small slice of this route's budget: the four desks still have to run.
    const expanded = await runStage(expandStage, { intake }, 60_000);
    keywords = toHarvestedKeywords(expanded, intake);
  }

  if (request.signal.aborted) {
    return NextResponse.json({ error: "Cancelled" }, { status: 499 });
  }

  const id = newId();
  let slug = slugify(intake.keyword);
  if (slug && (await getRunBySlug(slug))) slug = `${slug}-${id.slice(0, 6)}`;

  const row: RunRow = {
    id,
    slug: slug || null,
    keyword: intake.keyword,
    normalizedKeyword: intake.normalized,
    market: intake.market,
    language: intake.language,
    lens: intake.lens,
    suggestStatus: harvest.status,
    seedsAttempted: harvest.seedsAttempted,
    seedsSucceeded: harvest.seedsSucceeded,
    keywords,
    intent: null,
    clusters: null,
    audienceFit: null,
    angles: null,
    stageErrors: {},
    stageAttempts: {},
    stageStartedAt: null,
    createdAt: new Date(),
  };

  await insertRun(row);
  return NextResponse.json({ run: toRunView(await startDrive(row)), reused: false }, { status: 201 });
}
