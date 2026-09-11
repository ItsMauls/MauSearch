import { z } from "zod";
import { HarvestedKeyword, NormalizedIntake } from "@/lib/schema";
import { StageConfig } from "../run-stage";
import { demandSignal } from "@/lib/pipeline/score";
import { ruleSignals } from "@/lib/pipeline/rules";
import { HOUSE_RULES, intakeHeader } from "../prompts";
import fixture from "../fixtures/expand.json";

const ExpandStage = z.object({
  keywords: z.array(z.string()).min(10).max(40),
});
type ExpandStage = z.infer<typeof ExpandStage>;

/**
 * Fallback for a total Google Suggest outage only.
 *
 * These are plausible queries, not observed ones, so everything derived from
 * them is relabelled `ai` in the UI and the board shows a banner saying so.
 * Degrading the provenance rather than the availability is the whole point:
 * the run still completes, and nobody is misled about what they are looking at.
 */
export const expandStage: StageConfig<{ intake: NormalizedIntake }, ExpandStage> = {
  id: "expand",
  role: "Search Desk - fallback expansion",
  temperature: 0.5,
  schema: ExpandStage,
  fixture: fixture as ExpandStage,
  system: `
You are the Search Desk of a content agency. Google Suggest is unavailable, so you must
reconstruct a plausible query set from domain knowledge alone.

${HOUSE_RULES}

Produce queries a real person would type - including misspellings of intent, not of words.
Span the full intent range: informational, commercial, transactional, and local where the
topic warrants it. Write them in the market's language.

Return: { "keywords": ["<query>", ...] }  - 10 to 40 entries, lowercase, no duplicates.
`.trim(),
  user: ({ intake }) => `${intakeHeader(intake)}\n\nExpand: "${intake.normalized}"`,
};

/**
 * Shapes AI-expanded queries like harvested ones so every downstream stage is
 * unchanged - but with `source: "ai"` and a synthetic rank, since there is no
 * real ordering to report.
 */
export function toHarvestedKeywords(
  expanded: ExpandStage,
  intake: NormalizedIntake
): HarvestedKeyword[] {
  return expanded.keywords.map((keyword, index) => {
    const { intent, matched } = ruleSignals(keyword, intake.language);
    return {
      keyword,
      rank: index,
      coverage: 1,
      seeds: [],
      demandSignal: demandSignal(index, 1),
      ruleIntent: intent,
      ruleMatches: matched,
      aiIntent: null,
      source: "ai" as const,
    };
  });
}
