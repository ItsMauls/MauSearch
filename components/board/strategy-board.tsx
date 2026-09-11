"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageId, STAGE_IDS } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { Banner, Card } from "@/components/ui";
import { ProvenanceLegend } from "@/components/provenance";
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
    setWorking(stage);
    setWorkingSince(Date.now());
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
      setWorking(null);
      setWorkingSince(null);
    }
  }, []);

  /** Walks the remaining stages in order, stopping at the first failure. */
  const drive = useCallback(
    async (from: RunView) => {
      let current = from;
      for (const stage of STAGE_IDS) {
        if (current.stages[stage] === "done") continue;
        if (current.stages[stage] === "failed") return; // wait for an explicit retry
        const next = await advance(current.id, stage);
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

  async function generateBrief(opportunityId: string) {
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
      setBriefError((err as Error).message);
      setGeneratingId(null);
    }
  }

  const nextPending = STAGE_IDS.find((id) => run.stages[id] !== "done");

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 md:px-8">
      {run.suggest.isAiFallback && (
        <div className="mb-5">
          <Banner title="Google Suggest was unavailable for this run">
            The keyword universe below was expanded by the model instead of harvested. Every
            affected row is labelled <strong>AI</strong> rather than <strong>Suggest</strong> —
            these are plausible queries, not observed ones.
          </Banner>
        </div>
      )}

      <div className="mb-5">
        <ProvenanceLegend />
      </div>

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

          {run.stages.intent === "done" && <DemandReadPanel run={run} />}
          {run.stages.clusters === "done" && <ClustersPanel run={run} />}
          {run.stages.planning === "done" && <AudiencePanel run={run} />}
          {run.stages.creative === "done" && (
            <AngleRoom
              run={run}
              onGenerateBrief={generateBrief}
              generatingId={generatingId}
            />
          )}

          {working && <PanelSkeleton stage={working} />}

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
