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

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-8">
        {!hasLiveModel() && (
          <Banner title="Running on sample data">
            No <code className="font-mono text-xs">AI_API_KEY</code> is configured, so the
            desks return committed fixtures. Google Suggest harvesting is still live and real.
          </Banner>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
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

        <Card>
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
            <ul className="divide-y divide-line">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/w/${run.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-canvas"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {run.keyword}
                      </span>
                      <span className="block text-xs text-muted">
                        {run.market} · {run.metrics.keywordCount} keywords ·{" "}
                        {run.metrics.clusterCount} clusters
                      </span>
                    </span>
                    {run.intent && <Badge tone="accent">{run.intent.primary}</Badge>}
                    {run.metrics.topScore !== null && (
                      <span className="tabular font-mono text-sm font-semibold text-brand">
                        {run.metrics.topScore}
                      </span>
                    )}
                    <Badge tone={run.complete ? "positive" : "warn"}>
                      {run.complete ? "Complete" : "In progress"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
