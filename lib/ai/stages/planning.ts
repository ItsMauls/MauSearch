import { ClustersStage, IntentStage, NormalizedIntake, PlanningStage } from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/planning.json";

export type PlanningInput = {
  intake: NormalizedIntake;
  intent: IntentStage;
  clusters: ClustersStage;
};

/**
 * Stage 6 - the Planning Desk. Note what it does NOT receive: the raw keyword
 * list. A content strategist reasons about audiences and formats from the
 * clustered picture, and withholding the noise keeps the output at the right
 * altitude.
 */
export const planningStage: StageConfig<PlanningInput, PlanningStage> = {
  id: "planning",
  role: "Planning Desk - Content Strategist",
  temperature: 0.3,
  maxOutputTokens: 2500,
  schema: PlanningStage,
  fixture: fixture as PlanningStage,
  system: `
You are the Planning Desk of a content agency: a content strategist who takes the Search
Desk's read and decides who we are writing for, what each cluster is for, and what format
earns its keep.

${HOUSE_RULES}

Method:
- Personas are specific people with a job to do, not demographic sketches. "Bride planning a
  300-guest reception in 6 weeks" beats "millennial consumer".
- Objections are the reasons this person does NOT convert. Name real ones.
- Format fit is about the job, not fashion. A comparison table can beat a 2,000-word essay.
- Say what to build FIRST and what can wait. A plan without an order is a wish list.

Return this JSON shape:
{
  "audiences": [{
    "persona": "<short label>", "role": "<who they are>",
    "jobToBeDone": "<what they are trying to accomplish>",
    "painPoints": ["..."], "objections": ["<why they hesitate>"],
    "decisionTrigger": "<the moment they commit>"
  }],
  "funnelMap": [{ "clusterId": "cluster_N", "stage": "TOFU"|"MOFU"|"BOFU",
                  "goal": "<what this content must achieve>",
                  "contentFormat": "<e.g. local landing page, comparison guide>",
                  "whyThisFormat": "<one sentence>" }],
  "formatFit": [{ "format": "...", "fitScore": <0-100>, "bestForClusterIds": ["cluster_N"],
                  "effort": "low"|"medium"|"high" }],
  "contentGoals": { "primary": "...", "secondary": "...", "successMetric": "<something measurable>" },
  "portfolioAdvice": "<2-3 sentences: build order and why>",
  "plannerNote": "<the one thing a strategist should notice>"
}

Hard constraints:
- 1 to 3 audiences. Every cluster appears exactly once in funnelMap.
- clusterId values must match the cluster ids given below.
`.trim(),
  user: ({ intake, intent, clusters }) =>
    [
      intakeHeader(intake),
      ``,
      `SEARCH DESK READ`,
      `Primary intent: ${intent.primary} (confidence ${intent.confidence})`,
      `Mix: ${intent.mix.map((m) => `${m.type} ${m.share}%`).join(", ")}`,
      `SERP archetype: ${intent.serpArchetype}`,
      `Strategist note: ${intent.strategistNote}`,
      ``,
      `CLUSTERS`,
      ...clusters.clusters.map(
        (c) =>
          `- ${c.id} "${c.name}" [${c.dominantIntent}, ${c.funnelStage}, ${c.members.length} keywords]\n` +
          `  theme: ${c.theme}\n  example queries: ${c.members.slice(0, 5).join(", ")}`
      ),
      ``,
      `ENTITIES: ${clusters.entities.join(", ")}`,
      `COVERAGE GAPS: ${clusters.coverageGaps.join("; ")}`,
    ].join("\n"),
};
