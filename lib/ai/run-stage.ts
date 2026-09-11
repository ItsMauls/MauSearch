import { ZodType } from "zod";
import { aiClient, FAST_MODEL, hasLiveModel, MODEL } from "./client";

/**
 * One runner, every AI stage. Each stage supplies a persona, a temperature, a
 * prompt builder and a zod schema; nothing else in the codebase talks to the
 * model directly.
 *
 * There is deliberately no "one giant prompt" path. Every stage sees only the
 * structured output of the stages before it, which keeps prompts small, makes
 * each step independently retryable, and means a failure degrades one panel
 * instead of the whole run.
 */

export type StageConfig<TInput, TOutput> = {
  id: string;
  /** The agency desk this stage speaks as - surfaced in the UI. */
  role: string;
  temperature: number;
  schema: ZodType<TOutput>;
  system: string;
  user: (input: TInput) => string;
  /** Committed output used when no API key is configured. */
  fixture: TOutput;
  /** Classification stages can take the cheaper route. */
  fast?: boolean;
  /** Output token ceiling. Without one, some providers default to the whole
   *  context window, which a low-credit account can't afford to request. */
  maxOutputTokens: number;
};

export class StageError extends Error {
  constructor(readonly stageId: string, message: string) {
    super(message);
    this.name = "StageError";
  }
}

/**
 * Models wrap JSON in prose or fences often enough to be worth handling, and
 * rarely enough not to be worth a parser dependency.
 */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in model response");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

async function complete(
  config: StageConfig<never, unknown>,
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
  correction?: string
): Promise<{ content: string; truncated: boolean }> {
  const messages = [
    { role: "system" as const, content: config.system },
    { role: "user" as const, content: prompt },
  ];
  if (correction) {
    messages.push({
      role: "user" as const,
      content:
        `Your previous response did not satisfy the schema: ${correction}\n` +
        `Return the corrected JSON object only. No prose, no markdown fences.`,
    });
  }

  const response = await aiClient().chat.completions.create(
    {
      model: config.fast ? FAST_MODEL : MODEL,
      temperature: config.temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
      // Reasoning models (several free-tier Nemotron variants) otherwise spend the
      // whole token budget on hidden chain-of-thought and never reach the JSON.
      // `enabled` alone is sometimes ignored by models that can't fully turn
      // reasoning off; `exclude` + a max_tokens cap bounds it either way.
      // OpenRouter-specific; harmless no-op on routers that ignore unknown fields.
      ...({ reasoning: { enabled: false, exclude: true, max_tokens: 1 } } as Record<string, unknown>),
    },
    // Per-call override: the client's default timeout is sized for a single
    // call, but a stage can now make up to three, so each one gets a slice of
    // what's left of the route's own deadline instead of the full default.
    { timeout: timeoutMs }
  );
  const choice = response.choices?.[0];
  return { content: choice?.message?.content ?? "", truncated: choice?.finish_reason === "length" };
}

// However generous a stage's own ceiling is, some runs (a wordier cluster, a
// longer angle) still won't fit it. Rather than fail outright, double the
// budget and try again, up to a hard ceiling that keeps a runaway retry from
// requesting an unreasonable response size.
const TOKEN_CEILING = 32_000;

// Every route calling runStage caps at maxDuration=300s. Left unchecked, three
// sequential model calls (a truncation retry plus a schema-correction retry)
// can add up to more than that, and the platform kills the function outright
// with an opaque 504 - no error is recorded, no partial run state is saved.
// Stopping ourselves comfortably inside that ceiling means a slow run still
// gets a real StageError response instead of a platform timeout.
const STAGE_DEADLINE_MS = 260_000;

// A single attempt is capped well below the full deadline so a hung or
// slow-queueing call (the free tier's real failure mode) can't burn the
// entire budget on attempt one and leave nothing for a retry to work with.
const PER_ATTEMPT_TIMEOUT_MS = 100_000;

/**
 * Runs one stage: prompt -> model -> JSON -> schema. Two failure modes get one
 * retry each: a truncated response (finish_reason "length") retries with a
 * doubled token budget and no correction text, since the fix is room, not
 * wording; a schema failure retries once with the validation error fed back.
 * Every attempt also respects a shared deadline so the whole stage - retries
 * included - finishes (or fails) before the route's own timeout does.
 */
export async function runStage<TInput, TOutput>(
  config: StageConfig<TInput, TOutput>,
  input: TInput
): Promise<TOutput> {
  if (!hasLiveModel()) return config.fixture;

  const prompt = config.user(input);
  const cfg = config as unknown as StageConfig<never, unknown>;
  const deadline = Date.now() + STAGE_DEADLINE_MS;
  let lastError = "";
  let correction: string | undefined;
  let tokenBudget = config.maxOutputTokens;

  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) {
      lastError = lastError || "timed out before the model responded";
      break;
    }
    const timeoutMs = Math.min(remaining, PER_ATTEMPT_TIMEOUT_MS);
    try {
      const { content, truncated } = await complete(cfg, prompt, tokenBudget, timeoutMs, correction);
      if (truncated) {
        tokenBudget = Math.min(tokenBudget * 2, TOKEN_CEILING);
        lastError = `response was cut off at the token limit (retried at ${tokenBudget} tokens)`;
        correction = undefined;
        continue;
      }
      const parsed = config.schema.safeParse(extractJson(content));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      correction = lastError;
    } catch (err) {
      // A network/timeout error isn't "your previous response" the model can
      // correct - feeding it back as a schema correction just confuses the
      // next attempt, so retry plain instead.
      lastError = (err as Error).message;
      correction = undefined;
    }
  }

  throw new StageError(config.id, `${config.role} stage failed validation: ${lastError}`);
}
