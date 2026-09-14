import Link from "next/link";
import { listBriefs, listRuns } from "@/lib/db";
import { toRunView } from "@/lib/view";
import { hasLiveModel, isFreeTierModel } from "@/lib/ai/client";
import { IntakeForm } from "@/components/workspace/intake-form";
import { PageHeader } from "@/components/shell";
import { Badge, Banner, Card, EmptyState, Metric, SectionHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkspaceHome() {
  const [runRows, briefRows] = await Promise.all([listRuns(8), listBriefs(50)]);
  const runs = runRows.map(toRunView);

  const opportunityCount = runs.reduce((sum, run) => sum + run.metrics.opportunityCount, 0);
  const scored = runs.map((run) => run.metrics.topScore).filter((s): s is number => s !== null);
  const avgTopScore = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="brand">WORKSPACE</Badge>
            <Badge mono>4-DESK PIPELINE</Badge>
          </>
        }
        title="Content Planning Workspace"
        subtitle="A keyword goes in as an intake brief. A strategy comes out — evidenced, prioritized, and ready to hand to a writer."
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 md:px-8">
        {!hasLiveModel() && (
          <Banner title="Running on sample data">
            No <code className="font-mono text-xs">AI_API_KEY</code> is configured, so the
            desks return committed fixtures. Google Suggest harvesting is still live and real.
          </Banner>
        )}

        <Card className="order-2 md:order-1">
          <SectionHeader
            index="01"
            title="Recent Intakes"
            meta={`${runs.length} run${runs.length === 1 ? "" : "s"} in this workspace`}
          />
          {runs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No intakes yet"
                body="Enter a keyword above, or start from one of the samples. The Search Desk harvests real Google Suggest data before any model runs."
              />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-5 py-4">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/w/${run.slug ?? run.id}`}
                  className="flex w-64 shrink-0 flex-col gap-2 rounded-xl border border-line bg-canvas/60 p-3.5 transition-colors hover:border-brand/40 hover:bg-canvas"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{run.keyword}</span>
                    <Badge tone={run.complete ? "positive" : "warn"}>
                      {run.complete ? "Done" : "Running"}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted">
                    {run.market} · {run.metrics.keywordCount} kw · {run.metrics.clusterCount} clusters
                  </span>
                  <span className="flex items-center gap-2">
                    {run.intent && <Badge tone="accent">{run.intent.primary}</Badge>}
                    {run.metrics.topScore !== null && (
                      <span className="tabular ml-auto font-mono text-sm font-semibold text-brand">
                        {run.metrics.topScore}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="order-1 grid gap-6 md:order-2 lg:grid-cols-[1.35fr_1fr]">
          <IntakeForm freeTierModel={isFreeTierModel()} />

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Runs analysed" value={runs.length} hint="Keywords through the pipeline" />
              <Metric
                label="Opportunities"
                value={opportunityCount}
                hint="Scored and prioritized"
              />
              <Metric label="Briefs generated" value={briefRows.length} hint="Writer-ready" />
              <Metric
                label="Avg top score"
                value={avgTopScore ?? "—"}
                hint="Best opportunity per run"
              />
            </div>

            <Card className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
                How the desks work
              </p>
              <ol className="mt-2.5 space-y-2">
                {DESKS.map((desk, index) => (
                  <li key={desk.role} className="flex gap-2.5 text-xs">
                    <span className="mt-0.5 font-mono text-[10px] font-semibold text-brand">
                      0{index + 1}
                    </span>
                    <span>
                      <span className="block font-medium text-ink">{desk.role}</span>
                      <span className="block text-muted">{desk.does}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                href="/how-it-works"
                className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
              >
                See the full pipeline →
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

const DESKS = [
  { role: "Search Desk", does: "Harvests real queries, reads intent, builds clusters" },
  { role: "Planning Desk", does: "Derives audiences, maps funnel, picks formats" },
  { role: "Creative Desk", does: "Scores opportunities, and says what to kill" },
  { role: "Editorial Desk", does: "Writes the brief for the one you choose" },
];
