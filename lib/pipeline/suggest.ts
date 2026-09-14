import { NormalizedIntake } from "@/lib/schema";

/**
 * Stage 1 - harvest real queries from Google Suggest.
 *
 * Keyless, server-side, and the only source of measured data in the product.
 * We fan out across ~10 seed expansions so the keyword universe spans intents
 * instead of echoing the head term back at us.
 */

export type SeedResult = {
  seed: string;
  /** True for the bare keyword; modifier seeds are rank-penalised downstream. */
  isBase: boolean;
  suggestions: string[];
};

/** Modifier seeds chosen to pull one informational, one commercial and one
 *  transactional cluster into the harvest for each locale. */
const SEED_TEMPLATES: Record<string, string[]> = {
  en: ["how to {k}", "what is {k}", "{k} price", "best {k}", "{k} vs", "{k} for"],
  id: ["cara {k}", "apa itu {k}", "harga {k}", "{k} terbaik", "sewa {k}", "{k} untuk"],
};

/** Cheap breadth: Google completes "{k} a", "{k} b"... with different tails. */
const ALPHABET_PROBES = ["a", "b", "c"];

const SUGGEST_TIMEOUT_MS = 7000;

function templatesFor(language: string): string[] {
  // Malay shares enough surface vocabulary with Indonesian for these seeds.
  if (language === "id" || language === "ms") return SEED_TEMPLATES.id;
  return SEED_TEMPLATES.en;
}

export function buildSeeds(intake: NormalizedIntake): { seed: string; isBase: boolean }[] {
  const k = intake.normalized;
  return [
    { seed: k, isBase: true },
    ...templatesFor(intake.language).map((t) => ({ seed: t.replace("{k}", k), isBase: false })),
    ...ALPHABET_PROBES.map((c) => ({ seed: `${k} ${c}`, isBase: false })),
  ];
}

async function fetchSeed(
  seed: string,
  language: string,
  country: string,
  signal?: AbortSignal
): Promise<string[]> {
  const url =
    "https://suggestqueries.google.com/complete/search?client=firefox" +
    `&q=${encodeURIComponent(seed)}&hl=${language}&gl=${country}`;

  const timeout = AbortSignal.timeout(SUGGEST_TIMEOUT_MS);
  const res = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MauSearch/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`suggest ${res.status}`);

  // Response shape: [query, [suggestions], [], {metadata}]
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[1])) throw new Error("unexpected suggest shape");
  return (data[1] as unknown[]).filter((s): s is string => typeof s === "string");
}

/**
 * Fans out over every seed. Partial failure is normal and silent - a rate-limited
 * seed simply contributes nothing. Only a total wipeout is escalated to the
 * caller, which then falls back to AI expansion with downgraded provenance.
 */
export async function harvestSuggestions(
  intake: NormalizedIntake,
  signal?: AbortSignal
): Promise<{
  results: SeedResult[];
  seedsAttempted: number;
  seedsSucceeded: number;
}> {
  const seeds = buildSeeds(intake);
  const settled = await Promise.allSettled(
    seeds.map((s) => fetchSeed(s.seed, intake.language, intake.country, signal))
  );

  const results: SeedResult[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled" && outcome.value.length > 0) {
      results.push({ ...seeds[i], suggestions: outcome.value });
    }
  });

  return { results, seedsAttempted: seeds.length, seedsSucceeded: results.length };
}
