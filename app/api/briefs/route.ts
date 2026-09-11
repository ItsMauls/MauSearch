import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runStage, StageError } from "@/lib/ai/run-stage";
import { briefStage } from "@/lib/ai/stages/brief";
import { findBriefForOpportunity, getRun, insertBrief, newId, updateRun } from "@/lib/db";
import { BriefRow } from "@/lib/db/schema";
import { toBriefView, toRunView } from "@/lib/view";

export const maxDuration = 60;

const BriefRequest = z.object({
  runId: z.string().min(1),
  opportunityId: z.string().min(1),
});

/**
 * POST /api/briefs - stage 8, the Editorial Desk.
 *
 * Runs for the ONE opportunity the user selected. Generating briefs for all of
 * them up front would burn the budget on work that gets discarded, and the act
 * of choosing is the product's core interaction.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = BriefRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brief request" }, { status: 400 });
  }
  const { runId, opportunityId } = parsed.data;

  const run = await getRun(runId);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (!run.angles) {
    return NextResponse.json(
      { error: "The Creative Desk must complete before a brief can be written" },
      { status: 409 }
    );
  }

  // Idempotent: a double-click, or a second visit, returns the existing brief
  // instead of paying for the same generation twice.
  const existing = await findBriefForOpportunity(runId, opportunityId);
  if (existing) {
    return NextResponse.json({ brief: toBriefView(existing), reused: true });
  }

  const view = toRunView(run);
  const opportunity = view.opportunities.find((o) => o.id === opportunityId);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found in this run" }, { status: 404 });
  }

  const intake = {
    keyword: run.keyword,
    normalized: run.normalizedKeyword,
    market: run.market,
    language: run.language,
    country: run.market,
    lens: run.lens,
  };

  try {
    const payload = await runStage(briefStage, {
      intake,
      opportunity,
      cluster: run.clusters?.clusters.find((c) => c.id === opportunity.clusterId),
      intent: run.intent!,
      planning: run.audienceFit!,
    });

    const row: BriefRow = {
      id: newId(),
      runId,
      opportunityId,
      title: payload.workingTitle,
      keyword: run.keyword,
      market: run.market,
      payload,
      createdAt: new Date(),
    };
    await insertBrief(row);
    return NextResponse.json({ brief: toBriefView(row), reused: false }, { status: 201 });
  } catch (err) {
    const message = err instanceof StageError ? err.message : `Brief failed: ${String(err)}`;
    await updateRun(runId, { stageErrors: { ...run.stageErrors, brief: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
