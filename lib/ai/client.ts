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
 * Nemotron is the reasoning model for every stage. Default is a free OpenRouter
 * tier by deliberate choice - be aware of the tradeoff: measured at ~80s for a
 * single stage under real load, against the queue-time nvidia provisions for
 * unpaid traffic, not anything this app controls. That is comfortably past a
 * typical serverless budget for four sequential stages. A paid tier such as
 * nvidia/nemotron-3-nano-30b-a3b costs roughly $0.01 for a full run and
 * responds in single-digit seconds - swap AI_MODEL (and add AI_API_KEY credit)
 * if reliability matters more than the free tier's price.
 */
export const MODEL = env("AI_MODEL") ?? "nvidia/nemotron-3-ultra-550b-a55b:free";

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

let cached: OpenAI | null = null;

export function aiClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: env("AI_API_KEY") ?? "no-key",
      baseURL: BASE_URL,
      // Fallback only - runStage passes a per-call timeout sized to what's
      // left of its own deadline, since a stage can make several sequential
      // calls and each needs less than the whole route budget.
      timeout: 290_000,
      maxRetries: 0, // retries are handled in runStage, where we can correct the prompt
      // OpenRouter attributes traffic with these; harmless elsewhere.
      defaultHeaders: {
        "HTTP-Referer": env("AI_SITE_URL") ?? "https://mausearch.vercel.app",
        "X-Title": "MauSearch",
      },
    });
  }
  return cached;
}
