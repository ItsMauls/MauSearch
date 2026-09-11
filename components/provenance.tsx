import { Source } from "@/lib/schema";
import { SCORE_FORMULA } from "@/lib/pipeline/score";
import { cx } from "./ui";

/**
 * The product's honesty guarantee, rendered.
 *
 * Every value on screen carries one of these four chips, so a reader can always
 * tell measurement from judgment. This is a feature, not a disclaimer: it is
 * what makes shipping without a paid SEO API a defensible design decision
 * rather than a gap, and it is the first thing to point at in a demo.
 */
export const PROVENANCE: Record<
  Source,
  { label: string; short: string; className: string; explain: string }
> = {
  google_suggest: {
    label: "Google Suggest",
    short: "SUGGEST",
    className: "bg-suggest-soft text-suggest border-suggest/20",
    explain:
      "Real query data returned by Google's suggest endpoint, including the position Google ranked it at. Measured, not inferred.",
  },
  rule: {
    label: "Rule",
    short: "RULE",
    className: "bg-rule-soft text-rule border-rule/20",
    explain:
      "A deterministic lexicon match made in code before any model ran. No inference involved - the matched words are shown.",
  },
  ai: {
    label: "AI",
    short: "AI",
    className: "bg-ai-soft text-ai border-ai/20",
    explain:
      "Nemotron's judgment, routed through an OpenAI-compatible router. Reasoning over the evidence above - never a measurement.",
  },
  mauscore: {
    label: "MauScore",
    short: "MAUSCORE",
    className: "bg-mauscore-soft text-mauscore border-mauscore/20",
    explain: `Computed in TypeScript from a formula we show you: ${SCORE_FORMULA}`,
  },
};

export function Provenance({
  source,
  full,
  title,
  className,
}: {
  source: Source;
  /** Show the long label; the compact short form is the default in dense tables. */
  full?: boolean;
  title?: string;
  className?: string;
}) {
  const meta = PROVENANCE[source];
  return (
    <span
      title={title ?? meta.explain}
      className={cx(
        "inline-flex cursor-help items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap",
        meta.className,
        className
      )}
    >
      {full ? meta.label.toUpperCase() : meta.short}
    </span>
  );
}

/** Header legend. Without it the chips are decoration; with it they are a claim. */
export function ProvenanceLegend({ note, hideLabel }: { note?: string; hideLabel?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2">
      {!hideLabel && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Where each value came from
        </span>
      )}
      {(Object.keys(PROVENANCE) as Source[]).map((source) => (
        <span key={source} className="flex items-center gap-1.5">
          <Provenance source={source} full />
          <span className="text-[11px] text-muted">{LEGEND_HINT[source]}</span>
        </span>
      ))}
      <span className="text-[11px] text-faint">
        {note ?? "No search volume, CPC, or keyword difficulty anywhere - we have no source for them."}
      </span>
    </div>
  );
}

const LEGEND_HINT: Record<Source, string> = {
  google_suggest: "measured",
  rule: "deterministic",
  ai: "inferred",
  mauscore: "computed",
};
