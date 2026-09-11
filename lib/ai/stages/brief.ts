import {
  BriefStage,
  ClustersStage,
  IntentStage,
  NormalizedIntake,
  PlanningStage,
  ScoredOpportunity,
} from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/brief.json";

export type BriefInput = {
  intake: NormalizedIntake;
  opportunity: ScoredOpportunity;
  cluster: ClustersStage["clusters"][number] | undefined;
  intent: IntentStage;
  planning: PlanningStage;
};

/**
 * Stage 8 - the Editorial Desk. Runs on demand for the ONE opportunity the user
 * selected, never for all of them: generating six briefs nobody asked for is
 * how you burn a rate limit and a budget on work that gets thrown away.
 */
export const briefStage: StageConfig<BriefInput, BriefStage> = {
  id: "brief",
  role: "Editorial Desk - Content Lead",
  temperature: 0.4,
  // Up to 9 outline sections with talking points/H3s/assets, plus FAQ,
  // entities, internal links, and a checklist - same truncation risk as
  // the Creative Desk, sized the same way.
  maxOutputTokens: 8000,
  schema: BriefStage,
  fixture: fixture as BriefStage,
  system: `
You are the Editorial Desk of a content agency: the content lead who turns an approved
angle into a brief a writer can start from this morning without asking a single question.

${HOUSE_RULES}

Method:
- Every H2 must have a job. If you cannot say what a section is FOR, it does not go in.
- Talking points are instructions to a writer, not sentences for the reader.
- The mandated hook is the approved angle. Do not soften it back into something safe -
  that angle is the entire reason this piece was commissioned.
- mustAvoid is where you pre-empt the generic version: name the cliches this topic attracts.
- Meta title and description must read as something a human would click, and must be
  written in the SERP language stated above. Aim for a meta title around 55-60 characters
  and a description around 150-155, but never truncate a good one to hit a number.
- writerChecklist is what an editor verifies before publishing. Make each item checkable.

Return this JSON shape:
{
  "workingTitle": "...", "slug": "<url-safe, lowercase, hyphens>",
  "contentType": "...", "wordCount": { "min": <int>, "max": <int> },
  "objective": { "businessGoal": "...", "readerOutcome": "...",
                 "primaryCTA": "...", "conversionPath": "..." },
  "editorialDirective": { "mandatedHook": "...", "toneAndVoice": ["..."],
                          "mustAvoid": ["..."], "differentiationRule": "..." },
  "metadata": { "h1": "...", "metaTitle": "...", "metaDescription": "..." },
  "outline": [{ "h2": "...", "purpose": "<what this section is for>", "estWords": <int>,
                "talkingPoints": ["<instructions to the writer>"], "h3s": ["..."],
                "mandatoryAsset": "<table/diagram/screenshot, or null>" }],
  "faq": [{ "question": "<a real query from the cluster>", "answerDirection": "..." }],
  "entitiesToCover": ["..."],
  "internalLinks": [{ "anchor": "...", "targetType": "<what page it points to>", "placement": "<where>" }],
  "assetsNeeded": [{ "type": "...", "description": "..." }],
  "writerChecklist": ["<verifiable before publish>"],
  "eeatSignals": ["<what proves first-hand experience here>"],
  "editorNote": "<the one instruction that matters most>"
}

Hard constraints:
- 4 to 9 outline sections. estWords across sections should roughly match wordCount.
- 5 to 10 checklist items. mandatoryAsset is null when the section needs no asset.
- H1, H2s, H3s, FAQ questions, meta fields: SERP language. Everything else: English.
`.trim(),
  user: ({ intake, opportunity, cluster, intent, planning }) =>
    [
      intakeHeader(intake),
      ``,
      `APPROVED OPPORTUNITY (the only one being briefed)`,
      `Working title: ${opportunity.title}`,
      `Format: ${opportunity.format} | Funnel: ${opportunity.funnelStage}`,
      `Target keyword: "${opportunity.targetKeyword}"`,
      `Supporting keywords: ${opportunity.supportingKeywords.join(", ") || "none"}`,
      `Audience: ${opportunity.audience}`,
      `Promise: ${opportunity.promise}`,
      ``,
      `APPROVED ANGLE - this is binding`,
      `Framing: ${opportunity.angle.framing}`,
      `Hook: ${opportunity.angle.hook}`,
      `Contrarian take: ${opportunity.angle.contrarianTake}`,
      `Why it is not generic: ${opportunity.angle.whyNotGeneric}`,
      `Proof the piece must contain: ${opportunity.proofRequired.join("; ")}`,
      ``,
      `CLUSTER CONTEXT`,
      cluster
        ? `${cluster.name}: ${cluster.theme}\nReal queries to satisfy: ${cluster.members.slice(0, 12).join(", ")}`
        : `(cluster context unavailable)`,
      ``,
      `SEARCH DESK: primary intent ${intent.primary}, SERP archetype ${intent.serpArchetype}`,
      `SERP features expected: ${intent.expectedSerpFeatures.join(", ")}`,
      `PLANNING DESK: goal ${planning.contentGoals.primary}; success = ${planning.contentGoals.successMetric}`,
      `Reader objections to defuse: ${planning.audiences.flatMap((a) => a.objections).join("; ")}`,
    ].join("\n"),
};
