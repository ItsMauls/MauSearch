"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Card, cx, EmptyState, SectionHeader } from "@/components/ui";
import type { RunView } from "@/lib/view";

const STRIP_LIMIT = 10;

function RunCard({ run, compact }: { run: RunView; compact?: boolean }) {
  return (
    <Link
      href={`/w/${run.slug ?? run.id}`}
      className={
        compact
          ? "flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas/60 px-3.5 py-2.5 transition-colors hover:border-brand/40 hover:bg-canvas"
          : "flex w-36 shrink-0 flex-col gap-1 rounded-lg border border-line bg-canvas/60 p-2 transition-colors hover:border-brand/40 hover:bg-canvas"
      }
    >
      {compact ? (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{run.keyword}</span>
            <span className="block truncate text-xs text-muted">
              {run.market} · {run.metrics.keywordCount} keywords
            </span>
          </span>
          {run.intent && <Badge tone="accent">{run.intent.primary}</Badge>}
          {run.metrics.topScore !== null && (
            <span className="tabular font-mono text-sm font-semibold text-brand">
              {run.metrics.topScore}
            </span>
          )}
          <Badge tone={run.complete ? "positive" : "warn"}>
            {run.complete ? "Done" : "Running"}
          </Badge>
        </>
      ) : (
        <>
          <span className="flex items-start justify-between gap-1">
            <span className="truncate text-[11px] font-medium text-ink">{run.keyword}</span>
            <Badge tone={run.complete ? "positive" : "warn"}>
              {run.complete ? "Done" : "Running"}
            </Badge>
          </span>
          <span className="truncate text-[10px] text-muted">
            {run.market} · {run.metrics.keywordCount} keywords
          </span>
          <span className="flex items-center gap-1">
            {run.intent && <Badge tone="accent">{run.intent.primary}</Badge>}
            {run.metrics.topScore !== null && (
              <span className="tabular ml-auto font-mono text-[11px] font-semibold text-brand">
                {run.metrics.topScore}
              </span>
            )}
          </span>
        </>
      )}
    </Link>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M4 6.5 8 10l4-3.5" />
    </svg>
  );
}

export function RecentIntakesSection({ runs }: { runs: RunView[] }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  };

  const strip = runs.slice(0, STRIP_LIMIT);

  return (
    <Card className="order-2 md:order-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-t-2xl text-left transition-colors hover:bg-canvas/60"
      >
        <SectionHeader
          title="Recent Intakes"
          meta={`${runs.length} run${runs.length === 1 ? "" : "s"} in this workspace`}
        />
        <span className="mr-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-faint">
          <ChevronIcon open={open} />
        </span>
      </button>

      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          {runs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No intakes yet"
                body="Enter a keyword above, or start from one of the samples. The Search Desk harvests real Google Suggest data before any model runs."
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-2.5">
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scroll(-1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand/40 hover:text-brand"
              >
                ‹
              </button>

              <div
                ref={scrollerRef}
                className="flex flex-1 gap-2 overflow-x-auto scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden"
              >
                {strip.map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}

                {runs.length > STRIP_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    <span>View all</span>
                    <span className="text-[11px] text-faint">{runs.length} total</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scroll(1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand/40 hover:text-brand"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {showAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAll(false)}
          aria-hidden
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                  All Recent Intakes
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {runs.length} run{runs.length === 1 ? "" : "s"} in this workspace
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowAll(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} compact />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
