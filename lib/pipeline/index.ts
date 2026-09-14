import { HarvestResult, NormalizedIntake, SuggestStatus } from "@/lib/schema";
import { harvestSuggestions } from "./suggest";
import { dedupeAndSignal } from "./dedupe";

export { normalize } from "./normalize";
export { ruleSignals } from "./rules";
export * from "./score";

/**
 * Stages 0-3 end to end: normalize -> Google Suggest -> clean/dedupe -> rules.
 *
 * Entirely deterministic and model-free. A run that reaches here has real data
 * or an honest `unavailable` status; the caller decides whether to fall back to
 * AI expansion, and the UI relabels provenance accordingly.
 */
export async function runHarvest(
  intake: NormalizedIntake,
  signal?: AbortSignal
): Promise<HarvestResult> {
  const { results, seedsAttempted, seedsSucceeded } = await harvestSuggestions(intake, signal);

  const status: SuggestStatus =
    seedsSucceeded === 0 ? "unavailable" : seedsSucceeded < seedsAttempted ? "partial" : "ok";

  return {
    keywords: seedsSucceeded === 0 ? [] : dedupeAndSignal(results, intake),
    status,
    seedsAttempted,
    seedsSucceeded,
  };
}
