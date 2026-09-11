import { notFound } from "next/navigation";
import { getRun } from "@/lib/db";
import { toRunView } from "@/lib/view";
import { MARKETS, MarketCode, LENSES, Lens } from "@/lib/schema";
import { PageHeader } from "@/components/shell";
import { Badge } from "@/components/ui";
import { StrategyBoard } from "@/components/board/strategy-board";

export const dynamic = "force-dynamic";

/**
 * Reads straight from Postgres in a Server Component - no API round trip. Every
 * stage was persisted the moment it returned, so a mid-run reload rehydrates
 * whatever has completed and the client simply resumes from there.
 */
export default async function StrategyBoardPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const row = await getRun(runId);
  if (!row) notFound();

  const run = toRunView(row);
  const market = MARKETS[run.market as MarketCode];

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="brand">STRATEGY BOARD</Badge>
            <Badge mono>{run.id}</Badge>
            <Badge tone={run.complete ? "positive" : "warn"}>
              {run.complete ? "All desks complete" : "Desks working"}
            </Badge>
          </>
        }
        title={run.keyword}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {market?.label ?? run.market} ({run.language})
            </span>
            <span className="text-faint">·</span>
            <span>{LENSES[run.lens as Lens] ?? run.lens} lens</span>
            <span className="text-faint">·</span>
            <span>{run.metrics.keywordCount} queries harvested</span>
            {run.metrics.topScore !== null && (
              <>
                <span className="text-faint">·</span>
                <span>top opportunity scores {run.metrics.topScore}</span>
              </>
            )}
          </span>
        }
      />
      <StrategyBoard initialRun={run} />
    </>
  );
}
