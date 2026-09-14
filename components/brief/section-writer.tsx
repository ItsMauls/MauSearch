"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, cx } from "@/components/ui";
import { downloadBlob } from "./asset-utils";

type Section = {
  h2: string;
  purpose: string;
  estWords: number;
  h3s: string[];
  talkingPoints: string[];
  mandatoryAsset: string | null;
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The outline heading, clickable: opens a drafting modal for that one section.
 *
 * The draft is editable two ways - type in it directly, or send the AI a prompt
 * to revise what's there. Edits live in localStorage per brief+section, same as
 * the writer checklist, so closing the modal never loses work.
 */
export function SectionWriter({
  briefId,
  index,
  section,
}: {
  briefId: string;
  index: number;
  section: Section;
}) {
  const storageKey = `mausearch:section-draft:${briefId}:${index}`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState<"write" | "refine" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    // Browser-only store, so it can't be a lazy initializer without an SSR mismatch.
    if (loaded.current) return;
    loaded.current = true;
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft(saved);
    } catch {
      // unavailable storage just means the draft starts empty
    }
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function save(next: string) {
    setDraft(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // ignore
    }
  }

  async function generate(mode: "write" | "refine") {
    setLoading(mode);
    setError("");
    try {
      const res = await fetch("/api/brief/write-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId,
          sectionIndex: index,
          instruction: instruction.trim() || undefined,
          draft: mode === "refine" ? draft : undefined,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { markdown?: string };
      if (!data.markdown) throw new Error("empty");
      save(data.markdown);
      setInstruction("");
    } catch {
      setError("Couldn't draft that section. Try again.");
    } finally {
      setLoading(null);
    }
  }

  const words = countWords(draft);
  const onTarget = words >= section.estWords * 0.8 && words <= section.estWords * 1.25;
  const slug =
    section.h2
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "section";

  return (
    <>
      <h3 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-ink">
        <span className="font-mono text-[11px] text-faint">
          H2 · {String(index + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Draft this section with AI"
          className="group min-w-0 text-left underline decoration-dotted decoration-line-strong underline-offset-4 transition-colors hover:text-ai hover:decoration-ai"
        >
          {section.h2}
          <span className="ml-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-faint transition-colors group-hover:text-ai">
            {draft ? "✎ draft" : "✎ write"}
          </span>
        </button>
      </h3>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          aria-hidden
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ai">
                  Section {index + 1} · AI draft
                </p>
                <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-ink">
                  {section.h2}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Written against this brief&apos;s objective, editorial directive and writer
                  checklist · target ~{section.estWords} words
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!draft && !loading ? (
                <div className="rounded-xl border border-dashed border-line p-6 text-center">
                  <p className="text-sm text-muted">
                    Draft this section in SEO format — H2/H3 structure, answer-first paragraphs,
                    tables where they read better than prose.
                  </p>
                  <button
                    type="button"
                    onClick={() => generate("write")}
                    className="mt-3 rounded-lg border border-ai/20 bg-ai-soft px-3.5 py-2 text-sm font-semibold text-ai transition-colors hover:bg-ai/10"
                  >
                    Generate with AI
                  </button>
                  <p className="mt-3 text-[11px] text-faint">
                    {section.talkingPoints.length} talking point
                    {section.talkingPoints.length === 1 ? "" : "s"}
                    {section.h3s.length > 0 && ` · ${section.h3s.length} H3`}
                    {section.mandatoryAsset && ` · required asset: ${section.mandatoryAsset}`}
                  </p>
                </div>
              ) : (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => save(e.target.value)}
                    spellCheck={false}
                    placeholder={loading === "write" ? "Drafting…" : ""}
                    className="h-[42vh] w-full resize-y rounded-xl border border-line bg-canvas p-4 font-mono text-xs leading-relaxed text-ink outline-none focus:border-ai/40"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={onTarget ? "positive" : "warn"} mono>
                      {words} words
                    </Badge>
                    <span className="text-[11px] text-faint">
                      target ~{section.estWords} · counted here, not estimated by the model
                    </span>
                  </div>
                </>
              )}

              {loading && (
                <p className="mt-3 text-xs text-ai">
                  {loading === "write" ? "Drafting the section…" : "Revising your draft…"}
                </p>
              )}
              {error && <p className="mt-3 text-xs text-danger">{error}</p>}
            </div>

            <div className="space-y-3 border-t border-line bg-canvas/60 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) generate(draft ? "refine" : "write");
                  }}
                  placeholder="Tell the AI what to change — add a comparison table, cut the intro, more examples…"
                  className="min-w-[240px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none placeholder:text-faint focus:border-ai/40"
                />
                <button
                  type="button"
                  onClick={() => generate(draft ? "refine" : "write")}
                  disabled={loading !== null}
                  className="rounded-lg border border-ai/20 bg-ai-soft px-3 py-2 text-xs font-semibold text-ai transition-colors hover:bg-ai/10 disabled:cursor-wait disabled:opacity-70"
                >
                  {draft ? "Apply prompt" : "Generate"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => generate("write")}
                  disabled={loading !== null}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-70"
                >
                  Rewrite from brief
                </button>
                <button
                  type="button"
                  disabled={!draft}
                  onClick={() => {
                    navigator.clipboard.writeText(draft);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-50"
                >
                  {copied ? "Copied" : "Copy markdown"}
                </button>
                <button
                  type="button"
                  disabled={!draft}
                  onClick={() =>
                    downloadBlob(new Blob([draft], { type: "text/markdown" }), `${slug}.md`)
                  }
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-50"
                >
                  Download .md
                </button>
                <button
                  type="button"
                  disabled={!draft}
                  onClick={() => save("")}
                  className={cx(
                    "text-[11px] font-medium text-faint transition-colors hover:text-danger",
                    !draft && "opacity-50"
                  )}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-surface transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
