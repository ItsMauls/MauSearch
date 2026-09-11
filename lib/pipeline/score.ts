import { HarvestedKeyword, Opportunity, ScoredOpportunity } from "@/lib/schema";

/**
 * MAUSCORE - every number in this file is computed in TypeScript from inputs we
 * can point at. Nothing here is a model output, and nothing here stands in for
 * search volume, CPC or keyword difficulty, which we have no source for.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Modifier seeds ("harga {k}", "{k} a") return their own ranked list, so a
 * rank-0 hit there is a weaker signal than a rank-0 hit on the bare keyword.
 * Penalising them keeps the base seed's ordering dominant.
 */
export const MODIFIER_SEED_PENALTY = 5;

/**
 * Demand signal from real Suggest ordering.
 *
 *   rank 0  -> 100     each position costs 3, floored at 20 positions
 *   coverage -> up to +15 for surfacing under several independent seeds
 *
 * Shown to the user with this formula in the tooltip. It is a *relative*
 * popularity signal, not a volume estimate, and the UI says so.
 */
export function demandSignal(rank: number, coverage: number): number {
  const fromRank = 100 - Math.min(rank, 20) * 3;
  const fromCoverage = Math.min(coverage - 1, 3) * 5;
  return clamp(fromRank + fromCoverage);
}

/** Mean demand signal of a cluster's members. */
export function clusterDemand(members: string[], keywords: HarvestedKeyword[]): number {
  const index = new Map(keywords.map((k) => [k.keyword, k.demandSignal]));
  const found = members.map((m) => index.get(m)).filter((v): v is number => v !== undefined);
  if (found.length === 0) return 0;
  return Math.round(found.reduce((a, b) => a + b, 0) / found.length);
}

export const SCORE_WEIGHTS = {
  demandSignal: 0.3,
  intentValue: 0.3,
  differentiation: 0.25,
  lowEffort: 0.15,
} as const;

export const SCORE_FORMULA =
  "0.30 x demand signal (Google Suggest) + 0.30 x intent value (AI) + " +
  "0.25 x differentiation (AI) + 0.15 x (100 - effort) (AI)";

/**
 * The model scores three dimensions it is genuinely good at judging. It never
 * produces the ranking itself - LLMs are inconsistent at arithmetic across a
 * list, and a user asking "why is this first?" deserves an answer we can show.
 * 30% of every rank is grounded in real Google data.
 */
export function scoreOpportunity(
  opportunity: Opportunity,
  demand: number
): ScoredOpportunity {
  const { intentValue, differentiation, effort } = opportunity.signals;
  const score =
    SCORE_WEIGHTS.demandSignal * demand +
    SCORE_WEIGHTS.intentValue * intentValue +
    SCORE_WEIGHTS.differentiation * differentiation +
    SCORE_WEIGHTS.lowEffort * (100 - effort);

  const opportunityScore = Math.round(clamp(score));
  return {
    ...opportunity,
    demandSignal: demand,
    opportunityScore,
    priority: opportunityScore >= 75 ? "P0" : opportunityScore >= 60 ? "P1" : "P2",
  };
}

/** Scores every opportunity against its cluster's demand, best first. */
export function rankOpportunities(
  opportunities: Opportunity[],
  clusters: { id: string; members: string[] }[],
  keywords: HarvestedKeyword[]
): ScoredOpportunity[] {
  const demandByCluster = new Map(
    clusters.map((c) => [c.id, clusterDemand(c.members, keywords)])
  );
  return opportunities
    .map((o) => scoreOpportunity(o, demandByCluster.get(o.clusterId) ?? 50))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}
