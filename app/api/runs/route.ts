import { NextRequest, NextResponse } from "next/server";
import { IntakeInput } from "@/lib/schema";
import { normalize, runHarvest } from "@/lib/pipeline";
import { runStage, StageError } from "@/lib/ai/run-stage";
import { intentStage } from "@/lib/ai/stages/intent";
import { expandStage, toHarvestedKeywords } from "@/lib/ai/stages/expand";
import { findRecentRun, insertRun, newId } from "@/lib/db";
import { RunRow } from "@/lib/db/schema";
import { applyKeywordIntents, toRunView } from "@/lib/view";

export const maxDuration = 300;

/**
 * POST /api/runs - stages 0 through 4.
 *
 *   normalize -> Google Suggest harvest -> clean/dedupe -> rule signals -> AI intent
 *
 * Exactly one model call, so the request stays far inside the serverless
 * timeout. If the intent stage fails, the run is still persisted with its real
 * keyword harvest and a recorded error: the board renders what we have and
 * offers a retry rather than throwing the harvest away.
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
  const harvest = await runHarvest(intake);

  // Total Suggest outage is the only case that falls back to AI expansion, and
  // everything derived from it is relabelled `ai` for the user.
  let keywords = harvest.keywords;
  if (harvest.status === "unavailable") {
    const expanded = await runStage(expandStage, { intake });
    keywords = toHarvestedKeywords(expanded, intake);
  }

  // Stage 4: the first model call.
  let intent: RunRow["intent"] = null;
  let stageErrors: RunRow["stageErrors"] = {};
  try {
    intent = await runStage(intentStage, { intake, keywords });
    keywords = applyKeywordIntents(keywords, intent.keywordIntents);
  } catch (err) {
    stageErrors = { intent: err instanceof StageError ? err.message : String(err) };
  }

  const row: RunRow = {
    id: newId(),
    keyword: intake.keyword,
    normalizedKeyword: intake.normalized,
    market: intake.market,
    language: intake.language,
    lens: intake.lens,
    suggestStatus: harvest.status,
    seedsAttempted: harvest.seedsAttempted,
    seedsSucceeded: harvest.seedsSucceeded,
    keywords,
    intent,
    clusters: null,
    audienceFit: null,
    angles: null,
    stageErrors,
    createdAt: new Date(),
  };

  await insertRun(row);
  return NextResponse.json({ run: toRunView(row), reused: false }, { status: 201 });
}
