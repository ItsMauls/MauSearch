"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageId, STAGE_IDS } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { Banner, Card } from "@/components/ui";
import { AngleRoom, AudiencePanel, ClustersPanel, DemandReadPanel } from "./panels";
import { PanelSkeleton, StageRail } from "./stage-rail";

/**
 * Drives the desk pipeline from the client, one request per stage.
 *
 * Deliberately not SSE or streaming: each stage returns one complete, validated
 * document, so a plain sequential fetch gives the same progressive UI with none
 * of the partial-parse machinery - and every stage is persisted server-side the
 * moment it lands, which is what makes a mid-run reload harmless.
 */
export function StrategyBoard({
  initialRun,
  freeTierModel,
}: {
  initialRun: RunView;
  freeTierModel: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [working, setWorking] = useState<StageId | null>(null);
  const [workingSince, setWorkingSince] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const briefErrorRef = useRef<HTMLDivElement>(null);
  const driven = useRef(false);

  // The banner renders above the Angle Room, which can be well below the
  // fold by the time a brief finishes generating - without this, a failure
  // shows up off-screen and reads as "nothing happened".
  useEffect(() => {
    if (briefError) briefErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [briefError]);

  const advance = useCallback(async (runId: string, stage: StageId): Promise<RunView | null> => {
    // Persisted so a reload mid-stage resumes the elapsed count from the real
    // start time instead of restarting at 0 - the stage itself keeps running
    // server-side regardless of what the client does.
    const startKey = `mausearch:stage-start:${runId}:${stage}`;
    const stored = Number(window.localStorage.getItem(startKey));
    const startedAt = stored || Date.now();
    if (!stored) window.localStorage.setItem(startKey, String(startedAt));

    setWorking(stage);
    setWorkingSince(startedAt);
    try {
      const response = await fetch(`/api/runs/${runId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await response.json();
      // A failed stage still returns the run, carrying its recorded error, so
      // every completed panel stays on screen.
      if (data.run) setRun(data.run);
      return response.ok ? (data.run as RunView) : null;
    } catch {
      return null;
    } finally {
      window.localStorage.removeItem(startKey);
      setWorking(null);
      setWorkingSince(null);
    }
  }, []);

  /**
   * Walks the remaining stages in order, stopping at the first failure.
   *
   * Free-tier calls occasionally miss the stage deadline from queue latency
   * alone, not a real problem with the request - one automatic retry clears
   * most of those without the user ever seeing the error banner.
   */
  const drive = useCallback(
    async (from: RunView) => {
      let current = from;
      for (const stage of STAGE_IDS) {
        if (current.stages[stage] === "done") continue;
        if (current.stages[stage] === "failed") return; // wait for an explicit retry
        let next = await advance(current.id, stage);
        if (!next) next = await advance(current.id, stage);
        if (!next) return;
        current = next;
      }
    },
    [advance]
  );

  useEffect(() => {
    // Ref guard: StrictMode double-invokes effects in dev, and each stage is a
    // paid model call.
    if (driven.current) return;
    driven.current = true;
    void drive(initialRun);
  }, [drive, initialRun]);

  const retry = useCallback(
    async (stage: StageId) => {
      const next = await advance(run.id, stage);
      if (next) void drive(next);
    },
    [advance, drive, run.id]
  );

  async function generateBrief(opportunityId: string, attempt = 0) {
    setGeneratingId(opportunityId);
    setBriefError(null);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, opportunityId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Brief generation failed");
      router.push(`/brief/${data.brief.id}`);
    } catch (err) {
      // /api/briefs is idempotent (a repeat call returns the already-written
      // brief), so a dropped connection after the server finished is recovered
      // by retrying instead of shown as a hard failure.
      if (attempt < 2) {
        setTimeout(() => generateBrief(opportunityId, attempt + 1), 1500);
        return;
      }
      setBriefError((err as Error).message);
      setGeneratingId(null);
    }
  }

  const nextPending = STAGE_IDS.find((id) => run.stages[id] !== "done");

  const jumpToPanel = useCallback((stage: StageId) => {
    document.getElementById(`panel-${stage}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 md:px-8">
      {run.suggest.isAiFallback && (
        <div className="mb-5">
          <Banner title="Google Suggest was unavailable for this run">
            The keyword universe below was expanded by the model instead of harvested. Every
            affected row is labelled <strong>AI</strong> rather than <strong>Suggest</strong> —
            these are plausible queries, not observed ones.
          </Banner>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
              Desk pipeline
            </p>
            <StageRail
              run={run}
              working={working}
              workingSince={workingSince}
              onRetry={retry}
              onJump={jumpToPanel}
              freeTierModel={freeTierModel}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {briefError && (
            <div ref={briefErrorRef}>
              <Banner tone="danger" title="Brief generation failed">{briefError}</Banner>
            </div>
          )}

          {run.stages.intent === "done" && (
            <div id="panel-intent">
              <DemandReadPanel run={run} />
            </div>
          )}
          {run.stages.clusters === "done" && (
            <div id="panel-clusters">
              <ClustersPanel run={run} />
            </div>
          )}
          {run.stages.planning === "done" && (
            <div id="panel-planning">
              <AudiencePanel run={run} />
            </div>
          )}
          {run.stages.creative === "done" && (
            <div id="panel-creative">
              <AngleRoom
                run={run}
                onGenerateBrief={generateBrief}
                generatingId={generatingId}
              />
            </div>
          )}

          {working && <PanelSkeleton stage={working} since={workingSince} />}

          {!working && nextPending && run.stages[nextPending] === "failed" && (
            <Banner tone="danger" title={`The ${nextPending} desk could not complete`}>
              {run.stageErrors[nextPending]} — everything above it is saved. Use “Retry this desk”
              in the pipeline rail.
            </Banner>
          )}
        </div>
      </div>
    </div>
  );
}
