"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BriefView } from "@/lib/view";
import { Badge, ButtonLink, Card, EmptyState, SectionHeader } from "@/components/ui";

export type BriefListRow = BriefView & { lens: string };

const selectClass =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-faint";

export function BriefsList({ briefs }: { briefs: BriefListRow[] }) {
  const [market, setMarket] = useState("");
  const [lens, setLens] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const markets = useMemo(() => [...new Set(briefs.map((b) => b.market))].sort(), [briefs]);
  const lenses = useMemo(
    () => [...new Set(briefs.map((b) => b.lens).filter(Boolean))].sort(),
    [briefs]
  );

  const filtered = useMemo(
    () =>
      briefs.filter((b) => {
        if (market && b.market !== market) return false;
        if (lens && b.lens !== lens) return false;
        const date = b.createdAt.slice(0, 10);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      }),
    [briefs, market, lens, from, to]
  );

  const hasFilters = Boolean(market || lens || from || to);
  const clearFilters = () => {
    setMarket("");
    setLens("");
    setFrom("");
    setTo("");
  };

  return (
    <Card>
      <SectionHeader
        title="All briefs"
        meta={`${filtered.length} of ${briefs.length} brief${briefs.length === 1 ? "" : "s"}`}
      />

      {briefs.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
          <label>
            <span className={labelClass}>Market</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)} className={selectClass}>
              <option value="">All</option>
              {markets.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Lens</span>
            <select value={lens} onChange={(e) => setLens(e.target.value)} className={selectClass}>
              <option value="">All</option>
              {lenses.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
          </label>
          <label>
            <span className={labelClass}>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-brand hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title={briefs.length === 0 ? "No briefs yet" : "No briefs match these filters"}
            body={
              briefs.length === 0
                ? "Every brief starts as an intake. Analyse a keyword, pick the opportunity worth pursuing, and the Editorial Desk writes the brief."
                : "Try widening the market, lens, or date range."
            }
            action={briefs.length === 0 ? <ButtonLink href="/">Start an intake</ButtonLink> : undefined}
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((brief) => (
            <li key={brief.id}>
              <Link
                href={`/brief/${brief.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-canvas"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{brief.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {brief.brief.contentType} · {brief.brief.outline.length} sections ·{" "}
                    {brief.brief.wordCount.min}–{brief.brief.wordCount.max} words
                  </span>
                </span>
                <Badge mono>{brief.keyword}</Badge>
                <Badge>{brief.market}</Badge>
                {brief.lens && <Badge tone="accent">{brief.lens}</Badge>}
                <span className="text-xs text-faint">{brief.createdAt.slice(0, 10)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
