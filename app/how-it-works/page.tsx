import { MODEL, PROVIDER_LABEL } from "@/lib/ai/client";
import { SCORE_FORMULA } from "@/lib/pipeline/score";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, SectionHeader } from "@/components/ui";
import { Provenance, ProvenanceLegend } from "@/components/provenance";

export const metadata = { title: "How It Works — MauSearch" };

type Stage = {
  n: string;
  name: string;
  kind: "deterministic" | "ai" | "storage";
  desk: string;
  detail: string;
};

const STAGES: Stage[] = [
  { n: "00", name: "Normalize input", kind: "deterministic", desk: "—", detail: "Lowercase, collapse whitespace, strip punctuation Google treats as noise, resolve market to language and country." },
  { n: "01", name: "Harvest", kind: "deterministic", desk: "Search Desk", detail: "Google Suggest, keyless and server-side, fanned out across ~10 seed expansions in parallel. Partial failure is dropped silently; only a total outage falls back to AI expansion." },
  { n: "02", name: "Clean & dedupe", kind: "deterministic", desk: "Search Desk", detail: "Merge duplicates keeping the best rank, count how many seeds surfaced each query, penalise ranks from modifier seeds, drop drift that shares no token with the intake." },
  { n: "03", name: "Rule signals", kind: "deterministic", desk: "Search Desk", detail: "A bilingual intent lexicon labels the unambiguous queries in code, before any model runs. These labels are handed to the model as evidence, not as a suggestion." },
  { n: "04", name: "Intent classification", kind: "ai", desk: "SEO Strategist", detail: "Temperature 0.1. Produces the intent mix, the SERP archetype, and a record of every query where it overruled the lexicon — with reasons." },
  { n: "05", name: "Topic clustering", kind: "ai", desk: "SEO Strategist", detail: "Temperature 0.3. Groups queries by the job the searcher is doing, not by shared words. Queries that fit nowhere are left out." },
  { n: "06", name: "Audience & fit", kind: "ai", desk: "Content Strategist", detail: "Temperature 0.3. Receives clusters, not raw keywords — withholding the noise keeps the output at the right altitude." },
  { n: "07", name: "Opportunity cards", kind: "ai", desk: "Creative Director", detail: "Temperature 0.8. Scores three dimensions and produces a mandatory Kill List. It never sees or produces the ranking." },
  { n: "08", name: "Content brief", kind: "ai", desk: "Content Lead", detail: "Temperature 0.4, on demand, for the one opportunity you select. Generating all of them would burn budget on work that gets discarded." },
  { n: "09", name: "Validate, retry, persist", kind: "storage", desk: "—", detail: "Every stage is zod-validated. A schema failure gets exactly one corrective retry with the error fed back; a second failure marks that stage failed and leaves every completed panel on screen." },
];

const KIND_TONE = { deterministic: "neutral", ai: "accent", storage: "brand" } as const;

export default function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="brand">THE DESK PIPELINE</Badge>}
        title="How MauSearch Thinks"
        subtitle="Ten stages. Four deterministic, five discrete model calls, one persistence step. No single giant prompt anywhere."
        actions={<ButtonLink href="/">Start an intake</ButtonLink>}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6 md:px-8">
        <ProvenanceLegend />

        <Card className="overflow-hidden">
          <SectionHeader index="01" title="The pipeline" meta="Each stage consumes only the validated output of the stages before it" />
          <ol className="divide-y divide-line">
            {STAGES.map((stage) => (
              <li key={stage.n} className="flex gap-4 px-5 py-3.5">
                <span className="font-mono text-xs font-semibold text-faint">{stage.n}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{stage.name}</p>
                    <Badge tone={KIND_TONE[stage.kind]}>
                      {stage.kind === "ai" ? "Nemotron" : stage.kind}
                    </Badge>
                    {stage.desk !== "—" && (
                      <span className="text-[11px] text-faint">{stage.desk}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{stage.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="02" title="What we refuse to make up" />
          <div className="space-y-3 p-5 text-sm text-muted">
            <p>
              MauSearch has no source for search volume, CPC, keyword difficulty, or competitor
              traffic — so it does not display them. Not as an estimate, not with a disclaimer,
              not at all. A confident fabricated number is worse than an absent one, because you
              would plan around it.
            </p>
            <p>What it shows instead is either measured, deterministic, or labelled as judgment:</p>
            <ul className="space-y-2">
              <li className="flex gap-2.5">
                <Provenance source="google_suggest" />
                <span>
                  <strong className="text-ink">Suggest rank</strong> — the position Google returned
                  the query at, and <strong className="text-ink">seed coverage</strong>, how many
                  expansions surfaced it. Both observed.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="rule" />
                <span>
                  Intent matched by a lexicon in code, with the matched words shown so you can
                  check the work.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="ai" />
                <span>
                  Nemotron&apos;s reasoning over that evidence. Judgment, clearly marked as such.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="mauscore" />
                <span>
                  Computed here, from a formula printed on the page rather than hidden in a model.
                </span>
              </li>
            </ul>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="03" title="Why the model does not rank" />
          <div className="space-y-3 p-5 text-sm text-muted">
            <p>
              The Creative Desk scores three dimensions it genuinely judges well — intent value,
              differentiation, and effort. It never produces the final ranking. LLMs are
              inconsistent at arithmetic across a list, and &ldquo;why is this one first?&rdquo;
              deserves an answer you can audit.
            </p>
            <p className="rounded-lg border border-line bg-canvas p-3 font-mono text-xs text-ink">
              Opportunity Score = {SCORE_FORMULA}
            </p>
            <p>
              Thirty percent of every ranking is grounded in real Google Suggest data, and each
              opportunity card shows exactly which thirty.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="04" title="The engine" />
          <div className="space-y-2 p-5 text-sm text-muted">
            <p>
              All five model stages route through{" "}
              <strong className="text-ink">{PROVIDER_LABEL}</strong>, an OpenAI-compatible layer,
              with <strong className="text-ink">Nemotron</strong> (
              <code className="font-mono text-xs">{MODEL}</code>) as the reasoning model.
            </p>
            <p>
              The router is the point: 9router and OpenRouter speak the same protocol, so moving
              between them — or failing over a model — is two environment variables and no code
              change. Nothing in the codebase binds to a vendor beyond{" "}
              <code className="font-mono text-xs">AI_BASE_URL</code>.
            </p>
            <p>
              Without an API key the desks return committed fixtures so the repository runs with
              zero credentials. Google Suggest harvesting stays live either way — it needs no key.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
