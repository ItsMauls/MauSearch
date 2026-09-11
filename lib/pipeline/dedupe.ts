import { HarvestedKeyword, NormalizedIntake } from "@/lib/schema";
import { SeedResult } from "./suggest";
import { ruleSignals } from "./rules";
import { demandSignal, MODIFIER_SEED_PENALTY } from "./score";

/**
 * Stage 2 - clean and deduplicate.
 *
 * Seeds overlap heavily by design, so the same query arrives several times at
 * different ranks. We keep the best rank, count how many distinct seeds found
 * it (a real breadth signal), and drop drift that shares no vocabulary with the
 * intake.
 */

const MAX_KEYWORDS = 60;
const MAX_KEYWORD_LENGTH = 90;

function cleanQuery(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return s.split(" ").filter((t) => t.length > 2);
}

export function dedupeAndSignal(
  results: SeedResult[],
  intake: NormalizedIntake
): HarvestedKeyword[] {
  const baseTokens = new Set(tokens(intake.normalized));
  const merged = new Map<
    string,
    { rank: number; seeds: Set<string> }
  >();

  for (const result of results) {
    result.suggestions.forEach((raw, position) => {
      const keyword = cleanQuery(raw);
      if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) return;
      // Drop drift: a suggestion that shares no substantive token with the
      // intake is a different topic, not a long-tail of this one.
      if (baseTokens.size > 0 && !tokens(keyword).some((t) => baseTokens.has(t))) return;

      // A rank-0 hit under a modifier seed is a weaker signal than a rank-0
      // hit on the bare keyword, so modifier seeds carry a rank penalty.
      const rank = position + (result.isBase ? 0 : MODIFIER_SEED_PENALTY);
      const existing = merged.get(keyword);
      if (existing) {
        existing.rank = Math.min(existing.rank, rank);
        existing.seeds.add(result.seed);
      } else {
        merged.set(keyword, { rank, seeds: new Set([result.seed]) });
      }
    });
  }

  return [...merged.entries()]
    .map(([keyword, { rank, seeds }]) => {
      const { intent, matched } = ruleSignals(keyword, intake.language);
      return {
        keyword,
        rank,
        coverage: seeds.size,
        seeds: [...seeds],
        demandSignal: demandSignal(rank, seeds.size),
        ruleIntent: intent,
        ruleMatches: matched,
        aiIntent: null,
        source: "google_suggest" as const,
      };
    })
    .sort((a, b) => b.demandSignal - a.demandSignal || a.keyword.localeCompare(b.keyword))
    .slice(0, MAX_KEYWORDS);
}
