import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiClient, MODEL, hasLiveModel } from "@/lib/ai/client";

/**
 * Turns any section's "required asset" (map, screenshot, chart, infographic,
 * ...) into a table-shaped scaffold the writer/designer can fill in - the same
 * grid UI as the deterministic table generator, just with AI choosing columns
 * that fit the asset type.
 *
 * AI is support, not the source of truth: it's told to use only what's already
 * in the outline (h3 subjects, talking points) and leave a cell blank rather
 * than invent a coordinate, name, or number that isn't there. If there's no
 * live model, or the model's answer doesn't fit the schema, the deterministic
 * fallback below still gives a usable scaffold.
 */

const requestSchema = z.object({
  mandatoryAsset: z.string().min(1),
  h3s: z.array(z.string()),
  talkingPoints: z.array(z.string()),
});

const gridSchema = z.object({
  columns: z.array(z.string().min(1)).min(1).max(4),
  rows: z.array(z.array(z.string())).min(1).max(20),
});

function columnsFor(mandatoryAsset: string): string[] {
  const asset = mandatoryAsset.toLowerCase();
  if (/peta|map/.test(asset)) return ["Location", "Why it matters"];
  if (/screenshot|tangkapan.?layar/.test(asset)) return ["Shot", "What to capture"];
  if (/chart|grafik|diagram/.test(asset)) return ["Category", "Value"];
  if (/infograf/.test(asset)) return ["Step", "Detail"];
  return ["Item", "Detail"];
}

function fallbackGrid(mandatoryAsset: string, h3s: string[], talkingPoints: string[]) {
  const columns = columnsFor(mandatoryAsset);
  const rowLabels = h3s.length > 0 ? h3s : talkingPoints.length > 0 ? talkingPoints : [""];
  return { columns, rows: rowLabels.map((label) => [label, ...Array(columns.length - 1).fill("")]) };
}

export async function POST(req: NextRequest) {
  const parsedBody = requestSchema.safeParse(await req.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { mandatoryAsset, h3s, talkingPoints } = parsedBody.data;
  const fallback = fallbackGrid(mandatoryAsset, h3s, talkingPoints);

  if (!hasLiveModel()) return NextResponse.json(fallback);

  try {
    const response = await aiClient().chat.completions.create(
      {
        model: MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You structure a content brief's required production asset into a precise table scaffold. " +
              "Use ONLY facts already present in the given outline (h3 subjects and talking points) - never " +
              "invent numbers, coordinates, names, or statistics that aren't already there. Leave a cell as " +
              'an empty string if the outline does not specify a value; do not guess. Return JSON only: ' +
              '{"columns": string[] (max 4, short headers fitting the asset type), "rows": string[][] ' +
              "(one row per h3/talking point, each row length matches columns length)}.",
          },
          {
            role: "user",
            content:
              `Required asset: ${mandatoryAsset}\n` +
              `Section subjects (h3s): ${h3s.join("; ") || "none"}\n` +
              `Talking points: ${talkingPoints.join("; ") || "none"}`,
          },
        ],
        ...({ reasoning: { enabled: false, exclude: true, max_tokens: 1 } } as Record<string, unknown>),
      },
      { timeout: 60_000 }
    );

    const raw = response.choices?.[0]?.message?.content ?? "";
    const parsed = gridSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json(fallback);
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json(fallback);
  }
}
