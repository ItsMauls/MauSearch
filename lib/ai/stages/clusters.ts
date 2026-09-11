import { ClustersStage, HarvestedKeyword, IntentStage, NormalizedIntake } from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { formatKeywords, HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/clusters.json";

export type ClustersInput = {
  intake: NormalizedIntake;
  keywords: HarvestedKeyword[];
  intent: IntentStage;
};

/**
 * Stage 5 - semantic clustering. Separate from intent classification on purpose:
 * different temperature, different failure mode, and a clustering retry should
 * never force a re-run of the intent read.
 */
export const clustersStage: StageConfig<ClustersInput, ClustersStage> = {
  id: "clusters",
  role: "Search Desk - SEO Strategist",
  temperature: 0.3,
  schema: ClustersStage,
  fixture: fixture as ClustersStage,
  system: `
You are the Search Desk of a content agency, now grouping a classified keyword set into
the topics a content plan would actually be built around.

${HOUSE_RULES}

Method:
- Cluster by what the searcher is trying to accomplish, not by shared words. "harga X" and
  "biaya X" belong together; "X murah" and "X premium" usually do not.
- A cluster must be big enough to justify its own page. Two keywords is not a cluster.
- Keywords that fit nowhere are left out. Forcing them in produces a page about nothing.

Return this JSON shape:
{
  "clusters": [{
    "id": "cluster_1",
    "name": "<short, specific, 2-4 words>",
    "theme": "<one sentence: the job this cluster's searchers are doing>",
    "members": ["<exact keyword strings from the list>"],
    "dominantIntent": informational|commercial|transactional|navigational|local,
    "funnelStage": "TOFU"|"MOFU"|"BOFU",
    "note": "<one sentence a strategist would say about this cluster>"
  }],
  "entities": ["<semantic entities any content here must cover to read as authoritative>"],
  "coverageGaps": ["<questions this keyword set implies but nobody is obviously answering>"]
}

Hard constraints:
- 2 to 6 clusters. ids are cluster_1, cluster_2, ... in order.
- Every member must be an EXACT string from the keyword universe.
- A keyword appears in at most one cluster.
`.trim(),
  user: ({ intake, keywords, intent }) =>
    [
      intakeHeader(intake),
      ``,
      `SEARCH DESK READ (previous stage)`,
      `Primary intent: ${intent.primary}`,
      `Mix: ${intent.mix.map((m) => `${m.type} ${m.share}%`).join(", ")}`,
      `SERP archetype: ${intent.serpArchetype}`,
      ``,
      `KEYWORD UNIVERSE`,
      formatKeywords(keywords),
    ].join("\n"),
};
