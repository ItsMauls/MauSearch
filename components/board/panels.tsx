"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { Intent } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { SCORE_FORMULA } from "@/lib/pipeline/score";
import { Badge, cx, DeskNote, SectionHeader, ShareBar } from "@/components/ui";
import { Provenance } from "@/components/provenance";
import { ProgressBar, useElapsedSeconds } from "./progress";

/** Scrolls to and briefly highlights the Opportunity Card(s) for a cluster —
 *  the shared destination for Demand Read / Topic Clusters / Audience & Fit
 *  rows that reference a cluster, so clicking them reads as "show me where
 *  this went" instead of a dead hover state. */
function scrollToOpportunity(clusterId: string) {
  const els = document.querySelectorAll<HTMLElement>(`[data-cluster-id="${clusterId}"]`);
  if (els.length === 0) return;
  const details = els[0].closest("details");
  if (details) details.open = true;
  els[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  els.forEach((el) => {
    el.classList.add("ring-2", "ring-brand");
    setTimeout(() => el.classList.remove("ring-2", "ring-brand"), 1500);
  });
}

/** Sits in each collapsible panel's header action slot; rotates via the `group-open:` variant on the panel's `<details>`. */
function CollapseChevron() {
  return (
    <span
      className="ml-1 shrink-0 text-faint transition-transform group-open:rotate-180"
      aria-hidden
    >
      ▾
    </span>
  );
}

export const INTENT_COLOR: Record<Intent, string> = {
  transactional: "#4f46e5",
  commercial: "#7c3aed",
  local: "#0891b2",
  informational: "#059669",
  navigational: "#b45309",
};

function IntentTag({ intent, muted }: { intent: Intent | null; muted?: boolean }) {
  if (!intent) return <span className="text-faint">—</span>;
  return (
    <span
      className={cx("text-[11px] font-medium", muted && "opacity-70")}
      style={{ color: INTENT_COLOR[intent] }}
    >
      {intent}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Demand Read - stages 1 through 5                                           */
/* -------------------------------------------------------------------------- */

export function DemandReadPanel({ run }: { run: RunView }) {
  const { intent } = run;

  // The model's mix.evidence is a one-line sample quote, not the full set -
  // group by each keyword's actual classification so every query behind a
  // share shows up here, not just whichever one the model happened to cite.
  const keywordsByIntent = useMemo(() => {
    const map = new Map<Intent, string[]>();
    for (const k of run.keywords) {
      if (!k.aiIntent) continue;
      const arr = map.get(k.aiIntent);
      if (arr) arr.push(k.keyword);
      else map.set(k.aiIntent, [k.keyword]);
    }
    return map;
  }, [run.keywords]);

  if (!intent) return null;

  return (
    <details open className="group animate-land overflow-hidden rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <SectionHeader
          index="01"
          title="Demand Read"
          role="Search Desk — SEO Strategist"
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <span>{run.metrics.keywordCount} queries harvested</span>
              <span className="text-faint">·</span>
              <span>
                {run.suggest.seedsSucceeded}/{run.suggest.seedsAttempted} seeds returned
              </span>
              <span className="text-faint">·</span>
              <span>{run.metrics.ruleClassifiedShare}% rule-classified before any model ran</span>
            </span>
          }
          action={
            <span className="flex items-center gap-1.5">
              <Badge tone="accent">confidence {Math.round(intent.confidence * 100)}%</Badge>
              <CollapseChevron />
            </span>
          }
        />
      </summary>

      <div className="space-y-5 p-5">
        {/* Intent mix */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
              Intent mix
            </h3>
            <Provenance source="ai" title="Nemotron's classification, reasoning over real Suggest queries and deterministic rule matches." />
          </div>
          <ShareBar
            segments={intent.mix.map((m) => ({
              label: m.type,
              value: m.share,
              color: INTENT_COLOR[m.type],
            }))}
          />
          <ul className="mt-3 space-y-2">
            {intent.mix.map((m) => (
              <li key={m.type} className="flex gap-2.5 text-xs">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: INTENT_COLOR[m.type] }}
                />
                <span className="min-w-0">
                  <span className="font-medium text-ink">
                    {m.type} <span className="tabular font-mono">{m.share}%</span>
                  </span>
                  <span className="block text-muted">
                    {(keywordsByIntent.get(m.type) ?? []).join(", ") ||
                      m.evidence.replace(/\s*\(rank \d+,\s*\d+ seeds?\)/gi, "")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* SERP read */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-canvas p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              SERP archetype
            </p>
            <p className="mt-1 text-sm text-ink">{intent.serpArchetype}</p>
          </div>
          <div className="rounded-lg border border-line bg-canvas p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              Expected SERP features
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {intent.expectedSerpFeatures.map((feature) => (
                <Badge key={feature}>{feature}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Where the model overruled the lexicon - the audit trail that makes
            the rule layer meaningful rather than decorative. */}
        {intent.ruleDisagreements.length > 0 && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                Where the model overruled the rules
              </h3>
              <Provenance source="rule" />
              <span className="text-faint">→</span>
              <Provenance source="ai" />
            </div>
            <ul className="space-y-2">
              {intent.ruleDisagreements.map((d) => (
                <li key={d.keyword} className="text-xs">
                  <span className="font-mono text-[11px] text-ink">{d.keyword}</span>{" "}
                  <span className="text-faint">{d.ruleSaid}</span>
                  <span className="text-faint"> → </span>
                  <IntentTag intent={d.modelSays} />
                  <span className="block text-muted">{d.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <KeywordTable run={run} />
      </div>

      <DeskNote role="Strategist note">{intent.strategistNote}</DeskNote>
    </details>
  );
}

type KeywordSortKey = "keyword" | "rank" | "coverage" | "demandSignal";

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
  extra,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
  extra?: ReactNode;
}) {
  return (
    <th className={cx("font-medium text-faint", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cx("flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {label}
        {extra}
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function KeywordTable({ run }: { run: RunView }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: KeywordSortKey; dir: "asc" | "desc" } | null>(null);

  const toggleSort = (key: KeywordSortKey) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = q ? run.keywords.filter((k) => k.keyword.toLowerCase().includes(q)) : run.keywords;
    if (sort) {
      const { key, dir } = sort;
      filtered = [...filtered].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return filtered;
  }, [run.keywords, query, sort]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Keyword universe
        </h3>
        <span className="text-[11px] text-muted">
          Rank is Google&apos;s own ordering. Seeds is how many expansions surfaced it. Neither is
          a volume estimate.
        </span>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search keywords…"
        className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none placeholder:text-faint focus:border-brand"
      />
      <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr className="border-b border-line">
              <SortHeader
                label="Query"
                className="px-3 py-2"
                active={sort?.key === "keyword"}
                dir={sort?.dir ?? "asc"}
                onClick={() => toggleSort("keyword")}
              />
              <SortHeader
                label="Rank"
                className="px-2 py-2"
                active={sort?.key === "rank"}
                dir={sort?.dir ?? "asc"}
                onClick={() => toggleSort("rank")}
                extra={<Provenance source="google_suggest" />}
              />
              <SortHeader
                label="Seeds"
                className="px-2 py-2"
                active={sort?.key === "coverage"}
                dir={sort?.dir ?? "asc"}
                onClick={() => toggleSort("coverage")}
              />
              <SortHeader
                label="Demand"
                className="px-2 py-2"
                active={sort?.key === "demandSignal"}
                dir={sort?.dir ?? "asc"}
                onClick={() => toggleSort("demandSignal")}
                extra={<Provenance source="mauscore" />}
              />
              <th className="px-3 py-2 font-medium text-faint">
                <span className="flex items-center gap-1">
                  Intent <Provenance source="ai" /> <Provenance source="rule" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-faint">
                  No keywords match &quot;{query}&quot;
                </td>
              </tr>
            )}
            {rows.map((k) => {
              const cluster = run.clusters.find((c) => c.members.includes(k.keyword));
              return (
              <tr
                key={k.keyword}
                onClick={cluster ? () => scrollToOpportunity(cluster.id) : undefined}
                className={cluster ? "cursor-pointer hover:bg-canvas" : undefined}
              >
                <td className="px-3 py-1.5">
                  <span className="font-medium text-ink">{k.keyword}</span>
                  {k.ruleMatches.length > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] text-faint">
                      {k.ruleMatches.join(" ")}
                    </span>
                  )}
                </td>
                <td className="tabular px-2 py-1.5 font-mono text-faint">#{k.rank}</td>
                <td className="tabular px-2 py-1.5 font-mono text-faint">{k.coverage}</td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-8 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full bg-mauscore"
                        style={{ width: `${k.demandSignal}%` }}
                      />
                    </span>
                    <span className="tabular font-mono text-[11px] text-ink">{k.demandSignal}</span>
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <IntentTag intent={k.aiIntent} />
                    {k.ruleIntent && k.ruleIntent !== k.aiIntent && (
                      <span className="text-[10px] text-faint">(rule: {k.ruleIntent})</span>
                    )}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Clusters                                                                    */
/* -------------------------------------------------------------------------- */

export function ClustersPanel({ run }: { run: RunView }) {
  if (run.clusters.length === 0) return null;

  return (
    <details open className="group animate-land overflow-hidden rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <SectionHeader
          index="02"
          title="Topic Clusters"
          role="Search Desk — SEO Strategist"
          meta={`${run.clusters.length} clusters · demand averaged from real Suggest ranking`}
          action={
            <span className="flex items-center gap-1.5">
              <Provenance source="mauscore" full />
              <CollapseChevron />
            </span>
          }
        />
      </summary>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {run.clusters.map((cluster) => (
          <div
            key={cluster.id}
            onClick={() => scrollToOpportunity(cluster.id)}
            className="cursor-pointer rounded-lg border border-line p-3.5 transition-colors hover:border-brand"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{cluster.name}</p>
                <p className="font-mono text-[10px] text-faint">{cluster.id}</p>
              </div>
              <span className="text-right">
                <span className="tabular block font-mono text-lg font-semibold text-mauscore">
                  {cluster.demandSignal}
                </span>
                <span className="block text-[10px] text-faint">demand</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">{cluster.theme}</p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              <Badge tone="brand">{cluster.funnelStage}</Badge>
              <Badge>{cluster.dominantIntent}</Badge>
              <Badge mono>{cluster.memberCount} queries</Badge>
            </div>
            <p className="mt-2.5 border-t border-line pt-2 text-xs text-muted italic">
              {cluster.note}
            </p>
          </div>
        ))}
      </div>

      {run.coverageGaps.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
            Coverage gaps — questions this market implies but nobody answers
          </h3>
          <ul className="mt-2 space-y-1.5">
            {run.coverageGaps.map((gap) => (
              <li key={gap} className="flex gap-2 text-xs text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.entities.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            Entities to cover
          </h3>
          <div className="flex flex-wrap gap-1">
            {run.entities.map((entity) => (
              <Badge key={entity}>{entity}</Badge>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/* Audience & Fit - stage 6                                                    */
/* -------------------------------------------------------------------------- */

export function AudiencePanel({ run }: { run: RunView }) {
  const planning = run.planning;
  if (!planning) return null;

  return (
    <details open className="group animate-land overflow-hidden rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <SectionHeader
          index="03"
          title="Audience & Fit"
          role="Planning Desk — Content Strategist"
          meta={`${planning.audiences.length} personas · ${planning.funnelMap.length} clusters mapped to the funnel`}
          action={
            <span className="flex items-center gap-1.5">
              <Provenance source="ai" full />
              <CollapseChevron />
            </span>
          }
        />
      </summary>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {planning.audiences.map((audience) => (
            <div key={audience.persona} className="rounded-lg border border-line p-3.5">
              <p className="text-sm font-semibold text-ink">{audience.persona}</p>
              <p className="mt-0.5 text-[11px] text-faint">{audience.role}</p>
              <p className="mt-2 text-xs text-muted">{audience.jobToBeDone}</p>

              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Objections
              </p>
              <ul className="mt-1 space-y-1">
                {audience.objections.map((objection) => (
                  <li key={objection} className="flex gap-1.5 text-xs text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger" />
                    {objection}
                  </li>
                ))}
              </ul>

              <p className="mt-3 rounded-md bg-positive-soft px-2 py-1.5 text-xs text-positive">
                <span className="font-semibold">Trigger: </span>
                {audience.decisionTrigger}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
              Funnel map
            </h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-line">
              {planning.funnelMap.map((entry) => {
                const cluster = run.clusters.find((c) => c.id === entry.clusterId);
                return (
                  <div
                    key={entry.clusterId}
                    onClick={() => scrollToOpportunity(entry.clusterId)}
                    className="cursor-pointer border-b border-line p-3 transition-colors last:border-0 hover:bg-canvas"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{entry.stage}</Badge>
                      <span className="text-xs font-medium text-ink">
                        {cluster?.name ?? entry.clusterId}
                      </span>
                      <span className="ml-auto text-[11px] text-muted">{entry.contentFormat}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{entry.goal}</p>
                    <p className="mt-1 text-xs text-faint italic">{entry.whyThisFormat}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
              Format fit
            </h3>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {planning.formatFit.map((format) => (
                <div key={format.format} className="rounded-lg border border-line p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">{format.format}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={format.effort === "high" ? "warn" : "neutral"}>
                        {format.effort} effort
                      </Badge>
                      <span className="tabular font-mono text-xs font-semibold text-brand">
                        {format.fitScore}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full bg-brand" style={{ width: `${format.fitScore}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full rounded-lg border border-line bg-canvas p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Build order
          </p>
          <p className="mt-1 text-xs text-muted">{planning.portfolioAdvice}</p>
          <p className="mt-2 text-xs text-ink">
            <span className="font-semibold">Success metric: </span>
            {planning.contentGoals.successMetric}
          </p>
        </div>
      </div>

      <DeskNote role="Planner note">{planning.plannerNote}</DeskNote>
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/* Angle Room - stage 7                                                        */
/* -------------------------------------------------------------------------- */

export function AngleRoom({
  run,
  onGenerateBrief,
  generatingId,
  generatedOpportunityIds,
}: {
  run: RunView;
  onGenerateBrief?: (opportunityId: string) => void;
  generatingId?: string | null;
  generatedOpportunityIds?: string[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<"left" | "right" | null>(null);
  const scrollByPage = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * scrollRef.current.clientWidth * 0.95, behavior: "smooth" });
  };
  const handleScroll = () => setCanScrollLeft((scrollRef.current?.scrollLeft ?? 0) > 4);

  if (run.opportunities.length === 0) return null;

  return (
    <details open className="group animate-land overflow-hidden rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <SectionHeader
          index="04"
          title="Angle Room"
          role="Creative Desk — Creative Director"
          meta={`${run.opportunities.length} opportunities, ranked · ${run.killList.length} ideas killed`}
          action={
            <span className="flex items-center gap-1.5">
              <span
                className="cursor-help text-[11px] text-muted"
                title={`Opportunity Score = ${SCORE_FORMULA}`}
              >
                ranked by Opportunity Score ⓘ
              </span>
              <CollapseChevron />
            </span>
          }
        />
      </summary>

      <p className="bg-transparent px-5 pt-4 text-[11px] text-faint">Slide or use the arrows to compare opportunities</p>

      <div className="relative bg-transparent">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth bg-transparent py-5 pt-2"
        >
          {/* Chromium drops start-side padding on a scrolling flex container once content
              overflows, so the left gutter has to be a real spacer element instead. */}
          <div aria-hidden className="w-5 shrink-0" />
          {run.opportunities.map((opportunity, index) => {
            const edge = index === 0 ? "left" : index === run.opportunities.length - 1 ? "right" : undefined;
            return (
              <div
                key={opportunity.id}
                data-cluster-id={opportunity.clusterId}
                onMouseEnter={() => edge && setHoverEdge(edge)}
                onMouseLeave={() => edge && setHoverEdge((current) => (current === edge ? null : current))}
                className="w-[85vw] shrink-0 snap-start rounded-xl sm:w-[calc(50%-0.375rem)]"
              >
                <OpportunityCard
                  opportunity={opportunity}
                  recommended={index === 0}
                  cluster={run.clusters.find((c) => c.id === opportunity.clusterId)?.name}
                  onGenerateBrief={onGenerateBrief}
                  generating={generatingId === opportunity.id}
                  disabled={Boolean(generatingId)}
                  alreadyGenerated={generatedOpportunityIds?.includes(opportunity.id)}
                />
              </div>
            );
          })}
          <div aria-hidden className="w-5 shrink-0" />
        </div>

        {canScrollLeft && (
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center bg-linear-to-r from-purple-400/8 to-transparent pl-2 opacity-0 transition-opacity duration-300 ${hoverEdge === "left" ? "opacity-100" : ""}`}
          >
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              onMouseEnter={() => setHoverEdge("left")}
              onMouseLeave={() => setHoverEdge((current) => (current === "left" ? null : current))}
              aria-label="Previous opportunities"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl text-muted shadow-sm transition-colors hover:border-brand hover:text-brand"
            >
              ‹
            </button>
          </div>
        )}
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-linear-to-l from-purple-400/8 to-transparent pr-2 opacity-0 transition-opacity duration-300 ${hoverEdge === "right" ? "opacity-100" : ""}`}
        >
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            onMouseEnter={() => setHoverEdge("right")}
            onMouseLeave={() => setHoverEdge((current) => (current === "right" ? null : current))}
            aria-label="Next opportunities"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl text-muted shadow-sm transition-colors hover:border-brand hover:text-brand"
          >
            ›
          </button>
        </div>
      </div>

      {/* The signature detail: agencies earn their fee by saying no. */}
      <div className="border-t border-line bg-canvas/60 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Kill list — what this desk refused to make
        </h3>
        <ul className="mt-2.5 space-y-2">
          {run.killList.map((killed) => (
            <li
              key={killed.idea}
              className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-soft/10 p-3"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger/10 font-mono text-xs text-danger">
                ✕
              </span>
              <span className="min-w-0 text-xs">
                <span className="block font-medium text-ink line-through decoration-danger/40">
                  {killed.idea}
                </span>
                <span className="block text-muted">{killed.whyKilled}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {run.directorNote && <DeskNote role="Director note">{run.directorNote}</DeskNote>}
    </details>
  );
}

/** The brief takes 15-40s and a card that just says "writing…" for that long
 *  reads as stuck, so it gets the same progress bar as every other stage. */
function BriefProgress() {
  const elapsed = useElapsedSeconds();
  return (
    <ProgressBar caption={`${elapsed}s elapsed — Editorial Desk is writing the brief, usually 15–40s`} />
  );
}

function OpportunityCard({
  opportunity,
  recommended,
  cluster,
  onGenerateBrief,
  generating,
  disabled,
  alreadyGenerated,
}: {
  opportunity: RunView["opportunities"][number];
  recommended: boolean;
  cluster?: string;
  onGenerateBrief?: (id: string) => void;
  generating?: boolean;
  disabled?: boolean;
  alreadyGenerated?: boolean;
}) {
  const { signals } = opportunity;
  const breakdown = [
    { label: "Demand", value: opportunity.demandSignal, weight: "30%", source: "mauscore" as const },
    { label: "Intent value", value: signals.intentValue, weight: "30%", source: "ai" as const },
    { label: "Differentiation", value: signals.differentiation, weight: "25%", source: "ai" as const },
    { label: "Low effort", value: 100 - signals.effort, weight: "15%", source: "ai" as const },
  ];

  return (
    <div
      className={cx(
        "h-full rounded-xl border bg-surface p-5 shadow-sm transition-all hover:shadow-md",
        recommended ? "border-brand/40 bg-brand-soft/30" : "border-line",
        generating && "border-brand/60"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={opportunity.priority === "P0" ? "brand" : "neutral"} mono>
              {opportunity.priority}
            </Badge>
            <Badge>{opportunity.funnelStage}</Badge>
            <Badge>{opportunity.format}</Badge>
            {cluster && <Badge tone="accent">{cluster}</Badge>}
            {recommended && <Badge tone="positive">Recommended</Badge>}
          </div>
          <h3 className="text-base font-semibold leading-snug tracking-tight text-ink">
            {opportunity.title}
          </h3>
          <p className="mt-1.5 text-sm text-muted">{opportunity.promise}</p>
        </div>

        <div
          className="shrink-0 cursor-help rounded-lg border border-line bg-surface px-4 py-2.5 text-center"
          title={`Opportunity Score = ${SCORE_FORMULA}`}
        >
          <span className="tabular block font-mono text-2xl font-semibold text-brand">
            {opportunity.opportunityScore}
          </span>
          <span className="block text-[10px] text-faint">score ⓘ</span>
        </div>
      </div>

      {/* Score breakdown with per-input provenance: 30% of this rank is real
          Google data, and the card says exactly which 30%. */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {breakdown.map((part) => (
          <div key={part.label} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-faint">{part.label}</span>
              <Provenance source={part.source} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="tabular font-mono text-base font-semibold text-ink">{part.value}</span>
              <span className="font-mono text-[10px] text-faint">×{part.weight}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Hook</p>
        <p className="mt-1.5 text-sm text-ink">{opportunity.angle.hook}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">Contrarian take: </span>
          {opportunity.angle.contrarianTake}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">Why it is not generic: </span>
          {opportunity.angle.whyNotGeneric}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            SEO titles
          </p>
          <ul className="mt-2 space-y-2.5">
            {opportunity.seoTitles.map((title) => (
              <li key={title.title} className="text-xs">
                <span className="block font-medium text-ink">{title.title}</span>
                <span className="tabular font-mono text-[10px] text-faint">
                  {title.title.length} chars
                </span>
                <span className="block text-muted">{title.rationale}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Proof required
          </p>
          <ul className="mt-2 space-y-1.5">
            {opportunity.proofRequired.map((proof) => (
              <li key={proof} className="flex gap-1.5 text-xs text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                {proof}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-muted">
            <span className="font-medium text-ink">Target: </span>
            <span className="font-mono">{opportunity.targetKeyword}</span>
          </p>
        </div>
      </div>

      {onGenerateBrief && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGenerateBrief(opportunity.id)}
          className={cx(
            "mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70",
            recommended
              ? "bg-brand text-white hover:bg-brand/90"
              : "border border-line bg-surface text-ink hover:border-brand hover:text-brand"
          )}
        >
          {generating
            ? "Editorial Desk is writing the brief…"
            : alreadyGenerated
              ? "Generate again"
              : "Generate production brief"}
        </button>
      )}
      {generating && <BriefProgress />}
    </div>
  );
}
