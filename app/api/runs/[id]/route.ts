import { NextRequest, NextResponse } from "next/server";
import { deleteRun } from "@/lib/db";

/** DELETE /api/runs/[id] - drop a run (and its briefs, via cascade). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteRun(id);
  return NextResponse.json({ ok: true });
}
