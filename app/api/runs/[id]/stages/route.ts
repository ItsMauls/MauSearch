import { NextRequest, NextResponse } from "next/server";
import { StageRequest } from "@/lib/schema";
import { startDrive } from "@/lib/ai/drive";
import { getRun, updateRun } from "@/lib/db";
import { toRunView } from "@/lib/view";

export const maxDuration = 300;

/**
 * POST /api/runs/[id]/stages - "make sure this run is being worked, and tell me
 * where it is".
 *
 * It never runs a stage in the request itself: it claims the run and hands the
 * remaining desks to a background worker (see lib/ai/drive), then answers with
 * the current state. That makes it cheap enough to double as the board's poll,
 * and re-issuing it is how a run whose worker was killed mid-pipeline gets
 * picked back up - the claim decides whether anything actually starts.
 *
 * An optional `stage` is a retry: it clears that desk's recorded failure so the
 * worker treats it as owed again.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const parsed = StageRequest.safeParse((await request.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  }

  let run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const retry = parsed.data.stage;
  if (retry && run.stageErrors?.[retry]) {
    const stageErrors = { ...run.stageErrors };
    delete stageErrors[retry];
    await updateRun(run.id, { stageErrors });
    run = { ...run, stageErrors };
  }

  return NextResponse.json({ run: toRunView(await startDrive(run)) });
}
