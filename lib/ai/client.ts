import OpenAI from "openai";

/**
 * 9router is an OpenAI-compatible routing layer, so the official SDK pointed at
 * a different base URL is the whole integration - no bespoke HTTP wrapper to
 * maintain. Swapping models, or letting 9router fail over between them, is an
 * environment change and never a code change.
 */
export const MODEL = process.env.MAUSEARCH_MODEL ?? "nvidia/nemotron-nano-9b-v2";

/** Optional cheaper route for the low-temperature classification stage. */
export const FAST_MODEL = process.env.MAUSEARCH_MODEL_FAST ?? MODEL;

/**
 * Without a key the whole app runs on committed fixtures. That is deliberate:
 * whoever reviews this repo can clone it and see the full product working
 * before they go looking for credentials.
 */
export const hasLiveModel = (): boolean => Boolean(process.env.NINEROUTER_API_KEY);

let cached: OpenAI | null = null;

export function aiClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: process.env.NINEROUTER_API_KEY ?? "no-key",
      baseURL: process.env.NINEROUTER_BASE_URL ?? "https://api.9router.com/v1",
      timeout: 55_000,
      maxRetries: 0, // retries are handled in runStage, where we can correct the prompt
    });
  }
  return cached;
}
