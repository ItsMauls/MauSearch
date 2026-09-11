"use client";

import { useEffect, useState } from "react";
import { StageId, STAGE_IDS } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { cx } from "@/components/ui";

/**
 * The waiting state is the product story, so the rail says which desk is
 * working and what it is doing right now. A bare spinner would throw away the
 * most legible moment in the whole product.
 */
export const STAGE_META: Record<
  StageId,
  { label: string; role: string; working: string; etaSeconds: [number, number] }
> = {
  intent: {
    label: "Intent Classification",
    role: "Search Desk",
    working: "Reading what these searchers actually want, rule matches first",
    etaSeconds: [10, 25],
  },
  clusters: {
    label: "Topic Clustering",
    role: "Search Desk",
    working: "Grouping queries by the job the searcher is doing",
    etaSeconds: [10, 20],
  },
  planning: {
    label: "Audience & Fit",
    role: "Planning Desk",
    working: "Deriving personas and mapping each cluster to the funnel",
    etaSeconds: [10, 20],
  },
  creative: {
    label: "Angle Room",
    role: "Creative Desk",
    working: "Finding angles worth publishing — and killing the ones that are not",
    etaSeconds: [15, 35],
  },
};

/**
 * Counts seconds while a stage is in flight. Keyed by `since` at the call site
 * so a new stage starting remounts (and resets) it instead of needing an
 * effect-driven reset.
 */
function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

/** "0:07 elapsed - usually 10-25s, up to a couple of minutes on the free tier" */
function WorkingTimer({ eta, freeTierModel }: { eta: [number, number]; freeTierModel: boolean }) {
  const elapsed = useElapsedSeconds();
  return (
    <p className="text-[10px] text-faint">
      {formatMinSec(elapsed)} elapsed — usually {formatMinSec(eta[0])}–{formatMinSec(eta[1])}
      {freeTierModel && ", up to a couple of minutes on the free tier"}
    </p>
  );
}

/** The deterministic stages always precede the desks and always succeed or degrade. */
function HarvestStep({ run }: { run: RunView }) {
  const { suggest } = run;
  const tone = suggest.isAiFallback ? "warn" : "positive";
  return (
    <li className="flex items-start gap-3">
      <Dot state={suggest.isAiFallback ? "warn" : "done"} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink">
          Harvest, Clean & Rule Signals
          <span className="ml-1.5 text-[10px] font-normal text-faint">Stages 0–3 · no model</span>
        </p>
        <p className={cx("text-[11px]", tone === "warn" ? "text-warn" : "text-muted")}>
          {suggest.isAiFallback
            ? "Google Suggest unavailable — keyword universe was AI-expanded"
            : `${run.metrics.keywordCount} real queries from ${suggest.seedsSucceeded}/${suggest.seedsAttempted} seeds`}
        </p>
      </div>
    </li>
  );
}

export function StageRail({
  run,
  working,
  workingSince,
  onRetry,
  freeTierModel,
}: {
  run: RunView;
  working: StageId | null;
  workingSince?: number | null;
  onRetry?: (stage: StageId) => void;
  freeTierModel: boolean;
}) {
  return (
    <ol className="space-y-3">
      <HarvestStep run={run} />
      {STAGE_IDS.map((id) => {
        const meta = STAGE_META[id];
        const state = working === id ? "working" : run.stages[id];
        return (
          <li key={id} className="flex items-start gap-3">
            <Dot state={state} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink">
                {meta.label}
                <span className="ml-1.5 text-[10px] font-normal text-faint">{meta.role}</span>
              </p>
              {state === "working" && (
                <div>
                  <p className="text-[11px] text-brand animate-working">{meta.working}</p>
                  <WorkingTimer key={workingSince ?? id} eta={meta.etaSeconds} freeTierModel={freeTierModel} />
                </div>
              )}
              {state === "pending" && <p className="text-[11px] text-faint">Queued</p>}
              {state === "failed" && (
                <div className="mt-0.5">
                  <p className="text-[11px] text-danger">{run.stageErrors[id]}</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(id)}
                      className="mt-1 rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger hover:bg-danger/10"
                    >
                      Retry this desk
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ state }: { state: "done" | "pending" | "failed" | "working" | "warn" }) {
  const styles = {
    done: "bg-positive border-positive",
    warn: "bg-warn border-warn",
    working: "bg-brand border-brand animate-working",
    pending: "bg-surface border-line-strong",
    failed: "bg-danger border-danger",
  };
  return (
    <span
      className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2", styles[state])}
      aria-hidden
    />
  );
}

/** Shaped like the panel that is coming, so the layout does not jump. */
export function PanelSkeleton({ stage }: { stage: StageId }) {
  const meta = STAGE_META[stage];
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand animate-working" />
        <p className="text-sm font-medium text-ink">{meta.label}</p>
        <span className="text-[11px] text-faint">{meta.role}</span>
      </div>
      <p className="mt-1 text-xs text-muted animate-working">{meta.working}</p>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-full rounded bg-canvas" />
        <div className="h-2.5 w-4/5 rounded bg-canvas" />
        <div className="h-2.5 w-2/3 rounded bg-canvas" />
      </div>
    </div>
  );
}
