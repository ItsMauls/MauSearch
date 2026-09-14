import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiClient, MODEL, hasLiveModel } from "@/lib/ai/client";
import { getBrief } from "@/lib/db";
import { toBriefView } from "@/lib/view";
import { HOUSE_RULES } from "@/lib/ai/prompts";
import { sectionScaffold, stripCodeFence } from "@/lib/markdown";
import { MARKETS, MarketCode } from "@/lib/schema";

/**
 * Drafts one outline section as publish-ready SEO markdown.
 *
 * The brief is re-read server-side from its id rather than posted by the
 * client, so the draft is always grounded in the same objective, editorial
 * directive and writer checklist the page is showing - a section written
 * against a stale or hand-edited copy of the brief would quietly break the
 * one promise this feature makes.
 *
 * `instruction` (optional) is the user's own prompt, applied to `draft` when
 * one is sent - that is the "refine by prompt" path. Without a live model a
 * deterministic scaffold is returned so fixture mode still shows the flow.
 */

const requestSchema = z.object({
  briefId: z.string().min(1),
  sectionIndex: z.number().int().min(0),
  instruction: z.string().max(2000).optional(),
  draft: z.string().max(20_000).optional(),
});

export async function POST(req: NextRequest) {
  const parsedBody = requestSchema.safeParse(await req.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { briefId, sectionIndex, instruction, draft } = parsedBody.data;

  const row = await getBrief(briefId);
  if (!row) return NextResponse.json({ error: "brief not found" }, { status: 404 });

  const view = toBriefView(row);
  const b = view.brief;
  const section = b.outline[sectionIndex];
  if (!section) return NextResponse.json({ error: "section not found" }, { status: 404 });

  if (!hasLiveModel()) {
    return NextResponse.json({ markdown: sectionScaffold(section) });
  }

  const market = MARKETS[view.market as MarketCode] ?? MARKETS.ID;
  const context = [
    `BRIEF: ${b.workingTitle} (${b.contentType}, target keyword "${view.keyword}")`,
    `H1: ${b.metadata.h1}`,
    `Meta title: ${b.metadata.metaTitle}`,
    `Meta description: ${b.metadata.metaDescription}`,
    ``,
    `OBJECTIVE`,
    `- Business goal: ${b.objective.businessGoal}`,
    `- Reader outcome: ${b.objective.readerOutcome}`,
    `- Primary CTA: ${b.objective.primaryCTA}`,
    `- Conversion path: ${b.objective.conversionPath}`,
    ``,
    `EDITORIAL DIRECTIVE`,
    `- Mandated hook: ${b.editorialDirective.mandatedHook}`,
    `- Tone and voice: ${b.editorialDirective.toneAndVoice.join("; ") || "none"}`,
    `- Must avoid: ${b.editorialDirective.mustAvoid.join("; ") || "none"}`,
    `- Differentiation rule: ${b.editorialDirective.differentiationRule}`,
    ``,
    `WRITER CHECKLIST (this section must not violate any of these)`,
    ...b.writerChecklist.map((item) => `- ${item}`),
    ``,
    `E-E-A-T SIGNALS: ${b.eeatSignals.join("; ") || "none"}`,
    `ENTITIES TO COVER (use the ones that fit this section): ${b.entitiesToCover.join(", ") || "none"}`,
    `INTERNAL LINKS AVAILABLE: ${b.internalLinks.map((l) => `"${l.anchor}" -> ${l.targetType} (${l.placement})`).join("; ") || "none"}`,
    ``,
    `SECTION TO WRITE (${sectionIndex + 1} of ${b.outline.length})`,
    `- H2: ${section.h2}`,
    `- Purpose: ${section.purpose}`,
    `- Target length: ~${section.estWords} words`,
    `- H3 subheadings: ${section.h3s.join("; ") || "none - use none or invent none"}`,
    `- Talking points: ${section.talkingPoints.join("; ") || "none"}`,
    `- Required asset: ${section.mandatoryAsset ?? "none"}`,
    ``,
    `OTHER SECTIONS (do not write these, do not repeat them): ${b.outline
      .filter((_, i) => i !== sectionIndex)
      .map((s) => s.h2)
      .join(" | ")}`,
  ].join("\n");

  const system = [
    HOUSE_RULES.replace(
      "- Return ONLY a single JSON object. No prose before or after it, no markdown fences.",
      "- Return ONLY the section's markdown. No preamble, no commentary, no ```fences."
    ),
    ``,
    `You are the staff writer working this brief. Draft ONE section of the article, publish-ready.`,
    ``,
    `SEO format rules:`,
    `- Open with the section's own H2 as "## ${section.h2}" - keep that heading text exactly.`,
    `- Each listed H3 becomes a "### " subheading, in the given order.`,
    `- Lead with the answer: the first sentence under a heading resolves it, no throat-clearing.`,
    `- Short paragraphs (2-4 sentences). Use bullet lists and markdown tables where they genuinely`,
    `  read better than prose - a comparison or a step sequence is a table or a list, not a paragraph.`,
    `- Work the target keyword and related entities in naturally; never stuff, never repeat a heading verbatim in its own body.`,
    `- Hit roughly ${section.estWords} words. Cover every talking point given.`,
    `- Where the brief names a required asset, mark its place with a one-line "> Required asset: ..." callout instead of describing an image you cannot make.`,
    `- Cite nothing you were not given. Where a real figure, price or date is needed, write a bracketed`,
    `  fill-in for the writer, e.g. [verify: 2026 tuition fee], rather than inventing it.`,
    ``,
    market.language === "en"
      ? `Write in English.`
      : `Write the section in ${market.label}'s language (${market.language}) - it has to rank in that SERP.`,
  ].join("\n");

  const user = draft
    ? `${context}\n\nCURRENT DRAFT OF THIS SECTION:\n${draft}\n\nREVISE IT. The editor's instruction:\n${instruction || "Tighten it and improve the SEO structure without losing any covered talking point."}\n\nReturn the full revised section markdown, not a diff or a note.`
    : instruction
      ? `${context}\n\nExtra instruction from the editor: ${instruction}\n\nWrite the section now.`
      : `${context}\n\nWrite the section now.`;

  try {
    const response = await aiClient().chat.completions.create(
      {
        model: MODEL,
        temperature: 0.6,
        max_tokens: 3000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...({ reasoning: { enabled: false, exclude: true, max_tokens: 1 } } as Record<string, unknown>),
      },
      { timeout: 120_000 }
    );
    const markdown = stripCodeFence(response.choices?.[0]?.message?.content ?? "");
    if (!markdown) return NextResponse.json({ markdown: sectionScaffold(section) });
    return NextResponse.json({ markdown });
  } catch {
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }
}
