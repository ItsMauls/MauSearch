import { BriefRow, RunRow } from "@/lib/db/schema";
import { clusterDemand, rankOpportunities } from "@/lib/pipeline/score";
import {
  BriefStage,
  ClustersStage,
  HarvestedKeyword,
  Intent,
  IntentStage,
  PlanningStage,
  ScoredOpportunity,
  StageErrors,
  StageId,
  STAGE_IDS,
  SuggestStatus,
} from "@/lib/schema";

/**
 * The frontend-friendly response model.
 *
 * Every derived number the UI shows is computed here, once, from stored stage
 * output - so an API response and a server-rendered page can never disagree,
 * and no component has to know how a score is calculated.
 */

export type StageState = "done" | "pending" | "failed";

export type ClusterView = ClustersStage["clusters"][number] & {
  /** MAUSCORE, averaged over this cluster's real Suggest members. */
  demandSignal: number;
  memberCount: number;
};

export type RunView = {
  id: string;
  slug: string | null;
  keyword: string;
  normalizedKeyword: string;
  market: string;
  language: string;
  lens: string;
  createdAt: string;
  /** Epoch ms the currently in-flight stage began, or null when none is running. */
  stageStartedAt: number | null;

  suggest: {
    status: SuggestStatus;
    seedsAttempted: number;
    seedsSucceeded: number;
    /** True when Suggest was entirely unavailable and the universe is AI-expanded. */
    isAiFallback: boolean;
  };

  keywords: HarvestedKeyword[];
  intent: IntentStage | null;
  clusters: ClusterView[];
  entities: string[];
  coverageGaps: string[];
  planning: PlanningStage | null;
  opportunities: ScoredOpportunity[];
  killList: { idea: string; whyKilled: string }[];
  directorNote: string | null;

  metrics: {
    keywordCount: number;
    clusterCount: number;
    opportunityCount: number;
    topScore: number | null;
    ruleClassifiedShare: number;
  };

  stages: Record<StageId, StageState>;
  stageErrors: StageErrors;
  /** True once every stage has produced output. */
  complete: boolean;
};

const stageState = (payload: unknown, error: string | undefined): StageState =>
  payload ? "done" : error ? "failed" : "pending";

export function toRunView(row: RunRow): RunView {
  const errors = row.stageErrors ?? {};
  const keywords = row.keywords ?? [];

  const clusters: ClusterView[] = (row.clusters?.clusters ?? []).map((cluster) => ({
    ...cluster,
    demandSignal: clusterDemand(cluster.members, keywords),
    memberCount: cluster.members.length,
  }));

  const opportunities = row.angles
    ? rankOpportunities(row.angles.opportunities, row.clusters?.clusters ?? [], keywords)
    : [];

  const stages: Record<StageId, StageState> = {
    intent: stageState(row.intent, errors.intent),
    clusters: stageState(row.clusters, errors.clusters),
    planning: stageState(row.audienceFit, errors.planning),
    creative: stageState(row.angles, errors.creative),
  };

  const ruleClassified = keywords.filter((k) => k.ruleIntent !== null).length;

  return {
    id: row.id,
    slug: row.slug,
    keyword: row.keyword,
    normalizedKeyword: row.normalizedKeyword,
    market: row.market,
    language: row.language,
    lens: row.lens,
    createdAt: row.createdAt.toISOString(),
    stageStartedAt: row.stageStartedAt ? row.stageStartedAt.getTime() : null,

    suggest: {
      status: row.suggestStatus,
      seedsAttempted: row.seedsAttempted,
      seedsSucceeded: row.seedsSucceeded,
      isAiFallback: row.suggestStatus === "unavailable",
    },

    keywords,
    intent: row.intent,
    clusters,
    entities: row.clusters?.entities ?? [],
    coverageGaps: row.clusters?.coverageGaps ?? [],
    planning: row.audienceFit,
    opportunities,
    killList: row.angles?.killList ?? [],
    directorNote: row.angles?.directorNote ?? null,

    metrics: {
      keywordCount: keywords.length,
      clusterCount: clusters.length,
      opportunityCount: opportunities.length,
      topScore: opportunities[0]?.opportunityScore ?? null,
      ruleClassifiedShare: keywords.length
        ? Math.round((ruleClassified / keywords.length) * 100)
        : 0,
    },

    stages,
    stageErrors: errors,
    complete: STAGE_IDS.every((id) => stages[id] === "done"),
  };
}

export type BriefView = {
  id: string;
  runId: string;
  opportunityId: string;
  title: string;
  keyword: string;
  market: string;
  createdAt: string;
  brief: BriefStage;
};

export function toBriefView(row: BriefRow): BriefView {
  return {
    id: row.id,
    runId: row.runId,
    opportunityId: row.opportunityId,
    title: row.title,
    keyword: row.keyword,
    market: row.market,
    createdAt: row.createdAt.toISOString(),
    brief: row.payload,
  };
}

/**
 * Merges the intent stage's per-keyword verdicts back onto the harvested rows.
 * Unknown keywords are ignored rather than trusted - the model occasionally
 * paraphrases a query, and a paraphrase is not a keyword we observed.
 */
export function applyKeywordIntents(
  keywords: HarvestedKeyword[],
  intents: { keyword: string; intent: Intent }[]
): HarvestedKeyword[] {
  const byKeyword = new Map(intents.map((i) => [i.keyword, i.intent]));
  return keywords.map((k) => ({ ...k, aiIntent: byKeyword.get(k.keyword) ?? null }));
}
