import { HarvestedKeyword, LENSES, MARKETS, NormalizedIntake, Lens, MarketCode } from "@/lib/schema";

/**
 * Rules every desk inherits. The fabrication ban is the important one: the
 * model is told plainly that it has no source for volume or difficulty and that
 * the product will not render them, which is far more reliable than filtering
 * invented numbers out afterwards.
 */
export const HOUSE_RULES = `
MauSearch house rules (non-negotiable):
- Return ONLY a single JSON object. No prose before or after it, no markdown fences.
- NEVER state or estimate search volume, CPC, keyword difficulty, traffic, or competitor
  metrics. You have no source for them and MauSearch does not display them. Reason from
  the evidence you are given: real Google Suggest queries, their ranking, and rule matches.
- You are one desk in a pipeline. Work only from the evidence handed to you; do not
  re-litigate an earlier desk's conclusions.
- Write for practitioners. No filler openings, no "in today's digital landscape",
  no restating the question back.
`.trim();

/**
 * Analysis prose stays in English because the workspace is English. Anything
 * destined for a SERP is written in the market's language, because that is
 * where it has to rank. This is how bilingual agencies actually operate.
 */
export function languageRule(intake: NormalizedIntake): string {
  const market = MARKETS[intake.market as MarketCode];
  if (market.language === "en") return "Write everything in English.";
  return (
    `Analysis prose (notes, rationale, reasoning fields) in English.\n` +
    `Anything that will be published and must rank - SEO titles, meta title, meta ` +
    `description, H1, H2/H3 headings, FAQ questions - MUST be written in ` +
    `${market.label}'s language (${market.language}), because that is the language of the SERP.`
  );
}

export function intakeHeader(intake: NormalizedIntake): string {
  return [
    `INTAKE`,
    `Keyword: "${intake.normalized}"`,
    `Market: ${MARKETS[intake.market as MarketCode].label} (${intake.market})`,
    `Strategic lens: ${LENSES[intake.lens as Lens]}`,
    ``,
    languageRule(intake),
  ].join("\n");
}

/**
 * The keyword universe as evidence. Each row carries its real Suggest rank, how
 * many seeds surfaced it, and what the deterministic lexicon concluded - so the
 * model is refining a rule-based read rather than guessing from scratch.
 */
export function formatKeywords(keywords: HarvestedKeyword[], limit = 60): string {
  return keywords
    .slice(0, limit)
    .map((k) => {
      const rule = k.ruleIntent
        ? `RULE:${k.ruleIntent} [${k.ruleMatches.join(", ")}]`
        : "RULE:none";
      return `- "${k.keyword}" (rank ${k.rank}, ${k.coverage} seed${k.coverage > 1 ? "s" : ""}, ${rule})`;
    })
    .join("\n");
}
