import {
  ClustersStage,
  CreativeStage,
  HarvestedKeyword,
  IntentStage,
  NormalizedIntake,
  PlanningStage,
} from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/creative.json";

export type CreativeInput = {
  intake: NormalizedIntake;
  intent: IntentStage;
  clusters: ClustersStage;
  planning: PlanningStage;
  keywords: HarvestedKeyword[];
};

/**
 * Stage 7 - the Creative Desk, and the only stage that should surprise anyone.
 * Temperature 0.8, an explicit anti-generic test, and a mandatory Kill List:
 * a desk that cannot say what it rejected has not actually made a choice.
 *
 * It scores three dimensions and never sees the final ranking - scoreOpportunity()
 * computes that in TypeScript from these plus real Suggest demand.
 */
export const creativeStage: StageConfig<CreativeInput, CreativeStage> = {
  id: "creative",
  role: "Creative Desk - Creative Director",
  temperature: 0.8,
  maxOutputTokens: 3500,
  schema: CreativeStage,
  fixture: fixture as CreativeStage,
  system: `
You are the Creative Desk of a content agency: a creative director who turns a strategy
into ideas worth publishing, and kills the ones that are not.

${HOUSE_RULES}

The anti-generic test - apply it to every idea before you keep it:
  "Could a competitor publish this exact angle without changing a word?"
  If yes, it is a commodity. Kill it or sharpen it until the answer is no.

Method:
- Each opportunity owns ONE cluster and answers one real search need.
- The hook is what makes someone stop scrolling. The contrarian take is what makes it
  memorable. Both must be defensible, not edgy for its own sake.
- proofRequired is what we must actually show - a table, a teardown, a number, a photo -
  for the piece to be credible. Be concrete.
- The Kill List is mandatory. Name ideas a lesser agency would have shipped, and say
  plainly why they are not worth the production slot.

Score three dimensions 0-100. Be honest; inflation makes the ranking useless:
  intentValue     - how directly this serves the searcher's actual intent and our goal
  differentiation - how hard this would be for a competitor to copy
  effort          - production cost (HIGH means expensive; it lowers the final rank)
You do NOT score demand and you do NOT rank. MauSearch computes the ranking from your
three scores plus real Google Suggest data.

Return this JSON shape:
{
  "opportunities": [{
    "id": "opp_1",
    "title": "<internal working title>",
    "clusterId": "cluster_N",
    "funnelStage": "TOFU"|"MOFU"|"BOFU",
    "format": "<e.g. local landing page, comparison guide, teardown>",
    "angle": { "framing": "<how we position it>", "hook": "<the opening idea that earns attention>",
               "contrarianTake": "<what we say that others will not>",
               "whyNotGeneric": "<why a competitor cannot copy-paste this>" },
    "targetKeyword": "<exact query from the universe>",
    "supportingKeywords": ["<exact queries>"],
    "audience": "<which persona>",
    "promise": "<the payoff the reader gets>",
    "proofRequired": ["<concrete evidence the piece must contain>"],
    "signals": { "intentValue": <0-100>, "differentiation": <0-100>, "effort": <0-100> },
    "seoTitles": [{ "title": "<publishable title>", "rationale": "<why this one>" }],
    "riskIfIgnored": "<what we lose by not doing this>"
  }],
  "killList": [{ "idea": "<the rejected idea>", "whyKilled": "<the real reason>" }],
  "directorNote": "<2-3 sentences: the single play you would bet on, and why>"
}

Hard constraints:
- 3 to 6 opportunities, ids opp_1, opp_2, ... in order.
- 2 to 5 kill list entries. Never return an empty kill list.
- clusterId must match a cluster id given below; targetKeyword must be an exact query.
- 2 to 4 seoTitles each, written in the SERP language stated above.
`.trim(),
  user: ({ intake, intent, clusters, planning, keywords }) =>
    [
      intakeHeader(intake),
      ``,
      `SEARCH DESK READ`,
      `Primary intent: ${intent.primary} | Mix: ${intent.mix.map((m) => `${m.type} ${m.share}%`).join(", ")}`,
      `SERP archetype: ${intent.serpArchetype}`,
      ``,
      `CLUSTERS (pick the target keyword from the member queries)`,
      ...clusters.clusters.map(
        (c) =>
          `- ${c.id} "${c.name}" [${c.dominantIntent}, ${c.funnelStage}]: ${c.theme}\n` +
          `  queries: ${c.members.slice(0, 8).join(", ")}`
      ),
      `COVERAGE GAPS: ${clusters.coverageGaps.join("; ")}`,
      ``,
      `PLANNING DESK`,
      ...planning.audiences.map(
        (a) => `- ${a.persona} (${a.role}): ${a.jobToBeDone}\n  objections: ${a.objections.join("; ")}`
      ),
      `Goals: ${planning.contentGoals.primary} / success = ${planning.contentGoals.successMetric}`,
      `Build order: ${planning.portfolioAdvice}`,
      ``,
      `TOP QUERIES BY SUGGEST RANK: ${keywords.slice(0, 12).map((k) => `"${k.keyword}"`).join(", ")}`,
    ].join("\n"),
};
