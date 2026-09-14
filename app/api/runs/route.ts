import { NextRequest, NextResponse } from "next/server";
import { IntakeInput } from "@/lib/schema";
import { normalize, runHarvest } from "@/lib/pipeline";
import { runStage } from "@/lib/ai/run-stage";
import { expandStage, toHarvestedKeywords } from "@/lib/ai/stages/expand";
import { findRecentRun, getRunBySlug, insertRun, newId } from "@/lib/db";
import { RunRow } from "@/lib/db/schema";
import { toRunView } from "@/lib/view";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/**
 * POST /api/runs - stages 0 through 3: normalize, harvest, clean/dedupe, rule
 * signals. No model call here on purpose: the run row is persisted the moment
 * harvest finishes, and the client's redirect to /w/[id] hands the AI intent
 * stage to the board, which drives it through POST /api/runs/[id]/stages like
 * every other desk. That's what makes a reload mid-intent-call resumable
 * instead of restarting from zero.
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
    return NextResponse.json({ run: toRunView(existing), reused: true });
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
    const expanded = await runStage(expandStage, { intake });
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
    stageStartedAt: null,
    createdAt: new Date(),
  };

  await insertRun(row);
  return NextResponse.json({ run: toRunView(row), reused: false }, { status: 201 });
}
