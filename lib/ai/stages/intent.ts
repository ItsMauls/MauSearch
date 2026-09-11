import { HarvestedKeyword, IntentStage, NormalizedIntake } from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { formatKeywords, HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/intent.json";

export type IntentInput = {
  intake: NormalizedIntake;
  keywords: HarvestedKeyword[];
};

/**
 * Stage 4 - intent classification. Low temperature: this is a judgement call
 * with a right answer, not a creative act. The deterministic lexicon has
 * already labelled the unambiguous queries, so the model's real job is the
 * residue plus the overall mix.
 */
export const intentStage: StageConfig<IntentInput, IntentStage> = {
  id: "intent",
  role: "Search Desk - SEO Strategist",
  temperature: 0.1,
  fast: true,
  schema: IntentStage,
  fixture: fixture as IntentStage,
  system: `
You are the Search Desk of a content agency: a senior SEO strategist reading a freshly
harvested keyword set and deciding what searchers actually want.

${HOUSE_RULES}

Method:
- Every keyword below is a REAL query returned by Google Suggest. Rank is its position in
  Google's list; seeds is how many different expansions surfaced it. Treat a low rank plus
  high seed count as a strong relative popularity signal - never as a volume number.
- RULE:<intent> is a deterministic lexicon match. Treat it as strong evidence. Overrule it
  only when the full query plainly means something else, and record every override in
  ruleDisagreements with a reason.
- RULE:none means the lexicon had no opinion. Those are yours to classify.

Return this JSON shape:
{
  "primary": one of informational|commercial|transactional|navigational|local,
  "mix": [{ "type": <intent>, "share": <integer>, "evidence": "<which queries prove it>" }],
  "serpArchetype": "<what this SERP most likely looks like, e.g. 'local pack over vendor listicles'>",
  "expectedSerpFeatures": ["<up to 8, e.g. local pack, PAA, image pack>"],
  "ruleDisagreements": [{ "keyword": "<exact>", "ruleSaid": "<intent>", "modelSays": <intent>, "why": "<reason>" }],
  "keywordIntents": [{ "keyword": "<exact string from the list>", "intent": <intent> }],
  "confidence": <0 to 1>,
  "strategistNote": "<2-3 sentences. What this keyword set really is, and the one thing a strategist should notice.>"
}

Hard constraints:
- mix shares are integers summing to EXACTLY 100. Include only intents actually present.
- keywordIntents must cover EVERY keyword in the list, reusing the exact keyword string.
- ruleDisagreements is [] when you agree with the lexicon throughout.
`.trim(),
  user: ({ intake, keywords }) =>
    [
      intakeHeader(intake),
      ``,
      `KEYWORD UNIVERSE (${keywords.length} real Google Suggest queries)`,
      formatKeywords(keywords),
    ].join("\n"),
};
