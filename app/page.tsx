import Link from "next/link";
import { listBriefs, listRuns } from "@/lib/db";
import { toRunView } from "@/lib/view";
import { hasLiveModel, isFreeTierModel } from "@/lib/ai/client";
import { IntakeForm } from "@/components/workspace/intake-form";
import { RecentIntakesSection } from "@/components/workspace/recent-intakes";
import { PageHeader } from "@/components/shell";
import { Badge, Banner, Card, Metric } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkspaceHome() {
  const [runRows, briefRows] = await Promise.all([listRuns(50), listBriefs(50)]);
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

        <RecentIntakesSection runs={runs} />

        <div className="order-1 grid gap-6 md:order-2 lg:grid-cols-[1.35fr_1fr]">
          <IntakeForm freeTierModel={isFreeTierModel()} />

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Metric
                label="Runs analysed"
                value={runs.length}
                hint="Keywords through the pipeline"
                tooltip="Total number of keyword intakes that have gone through the pipeline."
              />
              <Metric
                label="Opportunities"
                value={opportunityCount}
                hint="Scored and prioritized"
                tooltip="Total content opportunities found and scored across all runs."
              />
              <Metric
                label="Briefs generated"
                value={briefRows.length}
                hint="Writer-ready"
                tooltip="Number of writer-ready briefs generated from opportunities."
              />
              <Metric
                label="Avg top score"
                value={avgTopScore ?? "—"}
                hint="Best opportunity per run"
                tooltip="Average of each run's highest-scoring opportunity."
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
