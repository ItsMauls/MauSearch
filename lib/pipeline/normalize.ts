import { IntakeInput, MARKETS, NormalizedIntake, MarketCode } from "@/lib/schema";

/**
 * Stage 0 - normalize input.
 *
 * The normalized form is what we send to Google, what we cache on, and what we
 * hand the model. Keeping it in one place means a run is reproducible from the
 * stored `normalized` string alone.
 */
export function normalize(input: IntakeInput): NormalizedIntake {
  const market = MARKETS[input.market as MarketCode];
  const normalized = input.keyword
    .toLowerCase()
    .normalize("NFKC")
    // Keep letters, digits, spaces and intra-word hyphens; drop punctuation
    // that Google Suggest treats as noise anyway.
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    keyword: input.keyword.trim(),
    normalized,
    market: input.market,
    language: market.language,
    country: market.country,
    lens: input.lens,
  };
}
