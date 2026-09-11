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
  correction?: string
): Promise<string> {
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

  const response = await aiClient().chat.completions.create({
    model: config.fast ? FAST_MODEL : MODEL,
    temperature: config.temperature,
    response_format: { type: "json_object" },
    messages,
  });
  return response.choices[0]?.message?.content ?? "";
}

/**
 * Runs one stage: prompt -> model -> JSON -> schema. A schema failure gets
 * exactly one corrective retry with the validation error fed back; a second
 * failure throws so the caller can mark just this stage failed and leave every
 * completed panel on screen.
 */
export async function runStage<TInput, TOutput>(
  config: StageConfig<TInput, TOutput>,
  input: TInput
): Promise<TOutput> {
  if (!hasLiveModel()) return config.fixture;

  const prompt = config.user(input);
  const cfg = config as unknown as StageConfig<never, unknown>;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await complete(cfg, prompt, attempt === 0 ? undefined : lastError);
      const parsed = config.schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (err) {
      lastError = (err as Error).message;
    }
  }

  throw new StageError(config.id, `${config.role} stage failed validation: ${lastError}`);
}
