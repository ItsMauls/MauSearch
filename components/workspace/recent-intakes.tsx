"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import type { RunView } from "@/lib/view";

export function RecentIntakesSection({ runs }: { runs: RunView[] }) {
  const [open, setOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  };

  return (
    <Card className="order-2 md:order-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left"
      >
        <SectionHeader
          title="Recent Intakes"
          meta={`${runs.length} run${runs.length === 1 ? "" : "s"} in this workspace · click to ${open ? "hide" : "show"}`}
          action={
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border border-line text-muted transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              ⌄
            </span>
          }
        />
      </button>

      {open &&
        (runs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No intakes yet"
              body="Enter a keyword above, or start from one of the samples. The Search Desk harvests real Google Suggest data before any model runs."
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-5 py-3">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scroll(-1)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand/40 hover:text-brand"
            >
              ‹
            </button>

            <div
              ref={scrollerRef}
              className="flex flex-1 gap-2.5 overflow-x-auto scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/w/${run.slug ?? run.id}`}
                  className="flex w-44 shrink-0 flex-col gap-1.5 rounded-lg border border-line bg-canvas/60 p-2.5 transition-colors hover:border-brand/40 hover:bg-canvas"
                >
                  <span className="flex items-start justify-between gap-1.5">
                    <span className="truncate text-xs font-medium text-ink">{run.keyword}</span>
                    <Badge tone={run.complete ? "positive" : "warn"}>
                      {run.complete ? "Done" : "Running"}
                    </Badge>
                  </span>
                  <span className="truncate text-[11px] text-muted">
                    {run.market} · {run.metrics.keywordCount} keywords
                  </span>
                  <span className="flex items-center gap-1.5">
                    {run.intent && <Badge tone="accent">{run.intent.primary}</Badge>}
                    {run.metrics.topScore !== null && (
                      <span className="tabular ml-auto font-mono text-xs font-semibold text-brand">
                        {run.metrics.topScore}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>

            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scroll(1)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-brand/40 hover:text-brand"
            >
              ›
            </button>
          </div>
        ))}
    </Card>
  );
}
