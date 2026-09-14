"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageId, STAGE_IDS } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { Banner, Card } from "@/components/ui";
import { AngleRoom, AudiencePanel, ClustersPanel, DemandReadPanel } from "./panels";
import { PanelSkeleton, StageRail } from "./stage-rail";

/** Four desks, a couple of minutes at worst - this is a status light, not a stream. */
const POLL_MS = 3000;

/**
 * Watches the desk pipeline; it no longer drives it.
 *
 * The desks run in a server-side worker (lib/ai/drive), so closing this tab
 * does not stop the run and reopening it does not restart one. All this does is
 * poll the same "keep it moving" endpoint: each poll reports progress, and if
 * the worker was killed mid-pipeline the poll is also what hands the run to a
 * fresh one. Deliberately not SSE - a 3s poll of a document that changes maybe
 * four times needs none of that machinery.
 */
export function StrategyBoard({
  initialRun,
  freeTierModel,
  generatedOpportunityIds,
}: {
  initialRun: RunView;
  freeTierModel: boolean;
  /** Opportunities that already have a brief, so their card can say "Generate again". */
  generatedOpportunityIds: string[];
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const briefErrorRef = useRef<HTMLDivElement>(null);
  /** Bumped by a retry, to restart a poll loop that stopped at a failure. */
  const [resumeKey, setResumeKey] = useState(0);
  const retryRef = useRef<StageId | null>(null);

  // The banner renders above the Angle Room, which can be well below the
  // fold by the time a brief finishes generating - without this, a failure
  // shows up off-screen and reads as "nothing happened".
  useEffect(() => {
    if (briefError) briefErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [briefError]);

  useEffect(() => {
    if (initialRun.complete) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll(stage?: StageId) {
      try {
        const response = await fetch(`/api/runs/${initialRun.id}/stages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stage ? { stage } : {}),
        });
        const next = (await response.json()).run as RunView | undefined;
        if (stopped) return;
        if (next) {
          setRun(next);
          // Nothing left to wait for: finished, or parked on a failure that
          // needs an explicit retry.
          if (next.complete || STAGE_IDS.some((id) => next.stages[id] === "failed")) return;
        }
      } catch {
        // A dropped poll says nothing about the run - the worker carries on
        // either way, so just try again.
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    }

    void poll(retryRef.current ?? undefined);
    retryRef.current = null;
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [initialRun.id, initialRun.complete, resumeKey]);

  const retry = useCallback((stage: StageId) => {
    retryRef.current = stage;
    setResumeKey((k) => k + 1);
  }, []);

  async function generateBrief(opportunityId: string, attempt = 0) {
    setGeneratingId(opportunityId);
    setBriefError(null);

    let response: Response;
    try {
      response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, opportunityId }),
      });
    } catch (err) {
      // The fetch itself failed - a real dropped connection, not an answer
      // from the server. /api/briefs is idempotent (a repeat call returns the
      // already-written brief), so retrying picks the wait back up instead of
      // losing it.
      if (attempt < 2) {
        setTimeout(() => generateBrief(opportunityId, attempt + 1), 1500);
        return;
      }
      setBriefError((err as Error).message);
      setGeneratingId(null);
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      router.push(`/brief/${data.brief.id}`);
      return;
    }
    // The server answered - a genuine failure, not a dropped connection. The
    // Editorial Desk already retries internally (up to ~280s of its own), so
    // retrying that silently here is what used to turn one failed generation
    // into several minutes of "still generating" with no visible reason. Show
    // it now; the button lets the user retry deliberately instead.
    setBriefError(data.error ?? "Brief generation failed");
    setGeneratingId(null);
  }

  const failedStage = STAGE_IDS.find((id) => run.stages[id] === "failed") ?? null;
  // No local "working" state any more: while a desk is owed and none has
  // failed, the worker is on it by definition. `stageStartedAt` is its real
  // start, so the elapsed timer survives a reload.
  const working = failedStage ? null : STAGE_IDS.find((id) => run.stages[id] === "pending") ?? null;
  const workingSince = run.stageStartedAt;

  const jumpToPanel = useCallback((stage: StageId) => {
    const el = document.getElementById(`panel-${stage}`);
    const details = el?.querySelector("details");
    if (details) details.open = true;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
                generatedOpportunityIds={generatedOpportunityIds}
              />
            </div>
          )}

          {working && <PanelSkeleton stage={working} since={workingSince} />}

          {failedStage && (
            <Banner tone="danger" title={`The ${failedStage} desk could not complete`}>
              {run.stageErrors[failedStage]} — everything above it is saved. Use “Retry this desk”
              in the pipeline rail.
            </Banner>
          )}
        </div>
      </div>
    </div>
  );
}
