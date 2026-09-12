import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiClient, MODEL, hasLiveModel } from "@/lib/ai/client";

/**
 * Turns a section's "required asset" into something usable:
 *  - "peta interaktif" / map -> real geocoded points for an interactive map.
 *  - anything else (table, screenshot, chart, infographic, ...) -> a table
 *    scaffold with AI-drafted cell content.
 *
 * AI is support, not the source of truth: for the map it may only name places
 * already present in the outline (h3s/talking points), never invent one, and
 * coordinates always come from real geocoding, never the model. For the grid
 * it must ground every cell in the given outline text rather than fabricate
 * numbers or claims. If there's no live model, or its answer doesn't fit the
 * schema, a deterministic fallback still renders instead of nothing.
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

const locationsSchema = z.object({
  locations: z
    .array(z.object({ name: z.string().min(1), note: z.string() }))
    .max(10),
});

function isMapAsset(mandatoryAsset: string): boolean {
  return /peta|\bmap\b/i.test(mandatoryAsset);
}

function columnsFor(mandatoryAsset: string): string[] {
  const asset = mandatoryAsset.toLowerCase();
  if (/screenshot|tangkapan.?layar/.test(asset)) return ["Shot", "What to capture"];
  if (/chart|grafik|diagram/.test(asset)) return ["Category", "Value"];
  if (/infograf/.test(asset)) return ["Step", "Detail"];
  return ["Item", "Detail"];
}

function fallbackGrid(mandatoryAsset: string, h3s: string[], talkingPoints: string[]) {
  const columns = columnsFor(mandatoryAsset);
  const rowLabels = h3s.length > 0 ? h3s : talkingPoints.length > 0 ? talkingPoints : [""];
  return { kind: "grid" as const, columns, rows: rowLabels.map((label) => [label, ...Array(columns.length - 1).fill("")]) };
}

async function completeJson(system: string, user: string, maxTokens: number) {
  const response = await aiClient().chat.completions.create(
    {
      model: MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...({ reasoning: { enabled: false, exclude: true, max_tokens: 1 } } as Record<string, unknown>),
    },
    { timeout: 60_000 }
  );
  return JSON.parse(response.choices?.[0]?.message?.content ?? "{}");
}

/** Free OSM geocoder - no key needed at this volume, but requires a real UA and stays sequential to respect it. */
async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "MauSearch/1.0 (content-brief asset generator)" } }
    );
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!results[0]) return null;
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

async function buildMap(h3s: string[], talkingPoints: string[]) {
  const outline = `Section subjects (h3s): ${h3s.join("; ") || "none"}\nTalking points: ${talkingPoints.join("; ") || "none"}`;
  let names: { name: string; note: string }[] = [];

  if (hasLiveModel()) {
    try {
      const parsed = locationsSchema.safeParse(
        await completeJson(
          "Extract only the real, named places (cities, landmarks, venues, addresses) that are already " +
            "explicitly mentioned in the given outline text. Never invent a place that isn't named there. " +
            "If no place is named, return an empty list. For each, add a one-sentence note of why it matters " +
            'drawn only from the given text. Return JSON only: {"locations": [{"name": string, "note": string}]}.',
          outline,
          800
        )
      );
      if (parsed.success) names = parsed.data.locations;
    } catch {
      // fall through with an empty list - handled below
    }
  }

  const points: { name: string; note: string; lat: number; lon: number }[] = [];
  for (const loc of names.slice(0, 8)) {
    const coords = await geocode(loc.name);
    if (coords) points.push({ ...loc, ...coords });
  }

  return { kind: "map" as const, points };
}

async function buildGrid(mandatoryAsset: string, h3s: string[], talkingPoints: string[]) {
  const fallback = fallbackGrid(mandatoryAsset, h3s, talkingPoints);
  if (!hasLiveModel()) return fallback;

  try {
    const parsed = gridSchema.safeParse(
      await completeJson(
        "You draft the actual content of a content brief's required production asset, shaped as a table. " +
          "Write real, useful cell content grounded ONLY in the given outline (h3 subjects and talking points) - " +
          "summarize or rephrase what's there, never invent numbers, names, or claims that aren't in it. Leave a " +
          'cell as an empty string only if the outline truly gives nothing to say. Return JSON only: ' +
          '{"columns": string[] (max 4, short headers fitting the asset type), "rows": string[][] ' +
          "(one row per h3/talking point, each row length matches columns length, cells filled with real content).",
        `Required asset: ${mandatoryAsset}\nSection subjects (h3s): ${h3s.join("; ") || "none"}\nTalking points: ${talkingPoints.join("; ") || "none"}`,
        1500
      )
    );
    if (!parsed.success) return fallback;
    return { kind: "grid" as const, ...parsed.data };
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  const parsedBody = requestSchema.safeParse(await req.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { mandatoryAsset, h3s, talkingPoints } = parsedBody.data;

  const result = isMapAsset(mandatoryAsset)
    ? await buildMap(h3s, talkingPoints)
    : await buildGrid(mandatoryAsset, h3s, talkingPoints);

  return NextResponse.json(result);
}
