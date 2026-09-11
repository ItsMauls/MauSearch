import OpenAI from "openai";

/**
 * The whole model integration: the official OpenAI SDK pointed at a router.
 *
 * 9router and OpenRouter are both OpenAI-compatible, so switching between them -
 * or to any other compatible endpoint - is two environment variables and no code
 * change. That is the entire point of routing through a layer rather than
 * binding to one vendor's SDK.
 *
 *   OpenRouter   AI_BASE_URL=https://openrouter.ai/api/v1
 *   9router      AI_BASE_URL=https://api.9router.com/v1
 */
const BASE_URL = process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1";

/** Nemotron is the reasoning model for every stage. */
export const MODEL = process.env.AI_MODEL ?? "nvidia/nemotron-nano-9b-v2";

/** Optional cheaper route for the low-temperature classification stage. */
export const FAST_MODEL = process.env.AI_MODEL_FAST ?? MODEL;

/** Which router we are actually pointed at, for display in the UI. */
export const PROVIDER_LABEL = BASE_URL.includes("openrouter")
  ? "OpenRouter"
  : BASE_URL.includes("9router")
    ? "9router"
    : "custom router";

/**
 * Without a key the whole app runs on committed fixtures. That is deliberate:
 * whoever reviews this repo can clone it and see the full product working
 * before they go looking for credentials.
 */
export const hasLiveModel = (): boolean => Boolean(process.env.AI_API_KEY);

let cached: OpenAI | null = null;

export function aiClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: process.env.AI_API_KEY ?? "no-key",
      baseURL: BASE_URL,
      timeout: 55_000,
      maxRetries: 0, // retries are handled in runStage, where we can correct the prompt
      // OpenRouter attributes traffic with these; harmless elsewhere.
      defaultHeaders: {
        "HTTP-Referer": process.env.AI_SITE_URL ?? "https://mausearch.vercel.app",
        "X-Title": "MauSearch",
      },
    });
  }
  return cached;
}
