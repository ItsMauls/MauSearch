import { Intent } from "@/lib/schema";
import { RunView } from "@/lib/view";
import { SCORE_FORMULA } from "@/lib/pipeline/score";
import { Badge, Card, cx, DeskNote, SectionHeader, ShareBar } from "@/components/ui";
import { Provenance } from "@/components/provenance";

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
  if (!intent) return null;

  return (
    <Card className="animate-land overflow-hidden">
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
        action={<Badge tone="accent">confidence {Math.round(intent.confidence * 100)}%</Badge>}
      />

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
                  <span className="block text-muted">{m.evidence}</span>
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
    </Card>
  );
}

function KeywordTable({ run }: { run: RunView }) {
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
      <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium text-faint">Query</th>
              <th className="px-2 py-2 font-medium text-faint">
                <span className="flex items-center gap-1">Rank <Provenance source="google_suggest" /></span>
              </th>
              <th className="px-2 py-2 font-medium text-faint">Seeds</th>
              <th className="px-2 py-2 font-medium text-faint">
                <span className="flex items-center gap-1">Demand <Provenance source="mauscore" /></span>
              </th>
              <th className="px-2 py-2 font-medium text-faint">
                <span className="flex items-center gap-1">Rule <Provenance source="rule" /></span>
              </th>
              <th className="px-3 py-2 font-medium text-faint">
                <span className="flex items-center gap-1">Model <Provenance source="ai" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {run.keywords.map((k) => (
              <tr key={k.keyword} className="hover:bg-canvas">
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
                <td className="px-2 py-1.5"><IntentTag intent={k.ruleIntent} muted /></td>
                <td className="px-3 py-1.5"><IntentTag intent={k.aiIntent} /></td>
              </tr>
            ))}
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
    <Card className="animate-land overflow-hidden">
      <SectionHeader
        index="02"
        title="Topic Clusters"
        role="Search Desk — SEO Strategist"
        meta={`${run.clusters.length} clusters · demand averaged from real Suggest ranking`}
        action={<Provenance source="mauscore" full />}
      />
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {run.clusters.map((cluster) => (
          <div key={cluster.id} className="rounded-lg border border-line p-3.5">
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
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Audience & Fit - stage 6                                                    */
/* -------------------------------------------------------------------------- */

export function AudiencePanel({ run }: { run: RunView }) {
  const planning = run.planning;
  if (!planning) return null;

  return (
    <Card className="animate-land overflow-hidden">
      <SectionHeader
        index="03"
        title="Audience & Fit"
        role="Planning Desk — Content Strategist"
        meta={`${planning.audiences.length} personas · ${planning.funnelMap.length} clusters mapped to the funnel`}
        action={<Provenance source="ai" full />}
      />

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
            <div className="overflow-hidden rounded-lg border border-line">
              {planning.funnelMap.map((entry) => {
                const cluster = run.clusters.find((c) => c.id === entry.clusterId);
                return (
                  <div key={entry.clusterId} className="border-b border-line p-3 last:border-0">
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
            <div className="space-y-2">
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

            <div className="mt-3 rounded-lg border border-line bg-canvas p-3">
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
        </div>
      </div>

      <DeskNote role="Planner note">{planning.plannerNote}</DeskNote>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Angle Room - stage 7                                                        */
/* -------------------------------------------------------------------------- */

export function AngleRoom({
  run,
  onGenerateBrief,
  generatingId,
}: {
  run: RunView;
  onGenerateBrief?: (opportunityId: string) => void;
  generatingId?: string | null;
}) {
  if (run.opportunities.length === 0) return null;

  return (
    <Card className="animate-land overflow-hidden">
      <SectionHeader
        index="04"
        title="Angle Room"
        role="Creative Desk — Creative Director"
        meta={`${run.opportunities.length} opportunities, ranked · ${run.killList.length} ideas killed`}
        action={
          <span
            className="cursor-help text-[11px] text-muted"
            title={`Opportunity Score = ${SCORE_FORMULA}`}
          >
            ranked by Opportunity Score ⓘ
          </span>
        }
      />

      <div className="space-y-3 p-5">
        {run.opportunities.map((opportunity, index) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            recommended={index === 0}
            cluster={run.clusters.find((c) => c.id === opportunity.clusterId)?.name}
            onGenerateBrief={onGenerateBrief}
            generating={generatingId === opportunity.id}
            disabled={Boolean(generatingId)}
          />
        ))}
      </div>

      {/* The signature detail: agencies earn their fee by saying no. */}
      <div className="border-t border-line bg-canvas/60 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Kill list — what this desk refused to make
        </h3>
        <ul className="mt-2.5 space-y-2.5">
          {run.killList.map((killed) => (
            <li key={killed.idea} className="flex gap-2.5">
              <span className="mt-0.5 font-mono text-xs text-danger">✕</span>
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
    </Card>
  );
}

function OpportunityCard({
  opportunity,
  recommended,
  cluster,
  onGenerateBrief,
  generating,
  disabled,
}: {
  opportunity: RunView["opportunities"][number];
  recommended: boolean;
  cluster?: string;
  onGenerateBrief?: (id: string) => void;
  generating?: boolean;
  disabled?: boolean;
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
        "rounded-xl border p-4",
        recommended ? "border-brand/40 bg-brand-soft/30" : "border-line"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={opportunity.priority === "P0" ? "brand" : "neutral"} mono>
              {opportunity.priority}
            </Badge>
            <Badge>{opportunity.funnelStage}</Badge>
            <Badge>{opportunity.format}</Badge>
            {cluster && <Badge tone="accent">{cluster}</Badge>}
            {recommended && <Badge tone="positive">Recommended</Badge>}
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">
            {opportunity.title}
          </h3>
          <p className="mt-1 text-xs text-muted">{opportunity.promise}</p>
        </div>

        <div
          className="shrink-0 cursor-help rounded-lg border border-line bg-surface px-3 py-2 text-center"
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
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {breakdown.map((part) => (
          <div key={part.label} className="rounded-lg border border-line bg-surface p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-faint">{part.label}</span>
              <Provenance source={part.source} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="tabular font-mono text-sm font-semibold text-ink">{part.value}</span>
              <span className="font-mono text-[10px] text-faint">×{part.weight}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-line bg-surface p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Hook</p>
        <p className="mt-1 text-sm text-ink">{opportunity.angle.hook}</p>
        <p className="mt-2 text-xs text-muted">
          <span className="font-medium text-ink">Contrarian take: </span>
          {opportunity.angle.contrarianTake}
        </p>
        <p className="mt-1.5 text-xs text-muted">
          <span className="font-medium text-ink">Why it is not generic: </span>
          {opportunity.angle.whyNotGeneric}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            SEO titles
          </p>
          <ul className="mt-1.5 space-y-1.5">
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
          <ul className="mt-1.5 space-y-1">
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
            "mt-3.5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70",
            recommended
              ? "bg-brand text-white hover:bg-brand/90"
              : "border border-line bg-surface text-ink hover:border-brand hover:text-brand"
          )}
        >
          {generating ? "Editorial Desk is writing the brief…" : "Generate production brief"}
        </button>
      )}
    </div>
  );
}
