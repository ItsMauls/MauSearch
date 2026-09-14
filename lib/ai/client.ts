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
/** Treats an unset OR blank env var the same way - dashboards (Vercel, Neon)
 *  routinely save an empty string for a field someone left blank, and `??`
 *  alone only catches null/undefined. */
const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

const BASE_URL = env("AI_BASE_URL") ?? "https://openrouter.ai/api/v1";

/**
 * Nemotron is the model for every stage. Default is a free OpenRouter tier by
 * deliberate choice; Super 120B measured faster and more consistent than the
 * Lightning variant it replaced. Swap AI_MODEL (and add AI_API_KEY credit) if
 * a paid tier is preferred for reliability.
 */
export const MODEL = env("AI_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free";

/** Optional cheaper route for the low-temperature classification stage. */
export const FAST_MODEL = env("AI_MODEL_FAST") ?? MODEL;

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
export const hasLiveModel = (): boolean => Boolean(env("AI_API_KEY"));

/** Free-tier routers queue behind paid traffic - the UI sets honest expectations when this is true. */
export const isFreeTierModel = (): boolean => MODEL.endsWith(":free") || FAST_MODEL.endsWith(":free");

/** Second OpenRouter account/key, tried once the primary hits its free-tier
 *  daily cap (429 "free-models-per-day"). Optional - unset means no fallback. */
const FALLBACK_API_KEY = env("AI_API_KEY_FALLBACK");
export const hasFallbackKey = (): boolean => Boolean(FALLBACK_API_KEY);

function makeClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    // Fallback only - runStage passes a per-call timeout sized to what's
    // left of its own deadline, since a stage can make several sequential
    // calls and each needs less than the whole route budget.
    timeout: 280_000,
    maxRetries: 0, // retries are handled in runStage, where we can correct the prompt
    // OpenRouter attributes traffic with these; harmless elsewhere.
    defaultHeaders: {
      "HTTP-Referer": env("AI_SITE_URL") ?? "https://mausearch.vercel.app",
      "X-Title": "MauSearch",
    },
  });
}

let cached: OpenAI | null = null;
let cachedFallback: OpenAI | null = null;

/** `useFallback` switches to AI_API_KEY_FALLBACK - see runStage, which flips
 *  to it for the rest of a stage's attempts after a 429 from the primary key. */
export function aiClient(useFallback = false): OpenAI {
  if (useFallback) {
    if (!cachedFallback) cachedFallback = makeClient(FALLBACK_API_KEY ?? "no-key");
    return cachedFallback;
  }
  if (!cached) cached = makeClient(env("AI_API_KEY") ?? "no-key");
  return cached;
}
