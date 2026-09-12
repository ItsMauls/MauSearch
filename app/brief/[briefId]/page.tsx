import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrief } from "@/lib/db";
import { toBriefView } from "@/lib/view";
import { briefToMarkdown } from "@/lib/markdown";
import { PageHeader } from "@/components/shell";
import { Badge, Card, cx, DeskNote, SectionHeader } from "@/components/ui";
import { Provenance } from "@/components/provenance";
import { ExportActions } from "@/components/brief/export-actions";
import { TableAsset } from "@/components/brief/table-asset";
import { AiAssetGrid } from "@/components/brief/ai-asset-grid";
import { WriterChecklist } from "@/components/brief/writer-checklist";

export const dynamic = "force-dynamic";

export default async function BriefPage({ params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await params;
  const row = await getBrief(briefId);
  if (!row) notFound();

  const view = toBriefView(row);
  const b = view.brief;
  const markdown = briefToMarkdown(view);
  const outlineWords = b.outline.reduce((sum, s) => sum + s.estWords, 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="positive">WRITER-READY</Badge>
            <Badge mono>{view.id}</Badge>
            <Badge tone="accent">Editorial Desk</Badge>
          </>
        }
        title={b.workingTitle}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{b.contentType}</span>
            <span className="text-faint">·</span>
            <span>
              {b.wordCount.min}–{b.wordCount.max} words
            </span>
            <span className="text-faint">·</span>
            <Link href={`/w/${view.runId}`} className="text-brand hover:underline">
              from the “{view.keyword}” board →
            </Link>
          </span>
        }
        actions={<ExportActions markdown={markdown} slug={b.slug} />}
      />

      <div className="mx-auto max-w-6xl px-6 py-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-5">
            {/* 01 Objective */}
            <Card className="overflow-hidden">
              <SectionHeader index="01" title="Objective & Conversion Path" />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="Business goal" value={b.objective.businessGoal} />
                <Field label="Reader outcome" value={b.objective.readerOutcome} />
                <Field label="Primary CTA" value={b.objective.primaryCTA} tone="brand" />
                <Field label="Conversion path" value={b.objective.conversionPath} />
              </div>
            </Card>

            {/* 02 Metadata + SERP preview */}
            <Card className="overflow-hidden">
              <SectionHeader
                index="02"
                title="Metadata & SERP Preview"
                meta="Character counts are measured here, not estimated by the model"
                action={<Provenance source="ai" full />}
              />
              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-line bg-canvas p-4">
                  <p className="font-mono text-[11px] text-muted">
                    example.com › {b.slug}
                  </p>
                  <p className="mt-1 text-lg leading-snug text-[#1a0dab]">{b.metadata.metaTitle}</p>
                  <p className="mt-1 text-sm leading-snug text-[#4d5156]">
                    {b.metadata.metaDescription}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <CharCount
                    label="Meta title"
                    value={b.metadata.metaTitle}
                    ideal={[50, 60]}
                    limit={65}
                  />
                  <CharCount
                    label="Meta description"
                    value={b.metadata.metaDescription}
                    ideal={[140, 158]}
                    limit={165}
                  />
                </div>

                <Field label="H1" value={b.metadata.h1} />
              </div>
            </Card>

            {/* 03 Outline */}
            <Card className="overflow-hidden">
              <SectionHeader
                index="03"
                title="Content Outline"
                meta={`${b.outline.length} sections · ~${outlineWords} words planned`}
              />
              <div className="divide-y divide-line">
                {b.outline.map((section, index) => (
                  <div key={section.h2} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-ink">
                        <span className="font-mono text-[11px] text-faint">
                          H2 · {String(index + 1).padStart(2, "0")}
                        </span>
                        {section.h2}
                      </h3>
                      <Badge mono>~{section.estWords} words</Badge>
                    </div>

                    <p className="mt-1.5 text-xs text-muted italic">{section.purpose}</p>

                    {section.h3s.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {section.h3s.map((h3) => (
                          <Badge key={h3} tone="brand">
                            H3 · {h3}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <ul className="mt-2.5 space-y-1.5">
                      {section.talkingPoints.map((point) => (
                        <li key={point} className="flex gap-2 text-xs text-muted">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                          {point}
                        </li>
                      ))}
                    </ul>

                    {section.mandatoryAsset && (
                      <>
                        <p className="mt-2.5 rounded-md border border-brand/20 bg-brand-soft px-2.5 py-1.5 text-xs text-brand">
                          <span className="font-semibold">Required asset: </span>
                          {section.mandatoryAsset}
                        </p>
                        {/tabel|table/i.test(section.mandatoryAsset) ? (
                          <TableAsset h3s={section.h3s} talkingPoints={section.talkingPoints} />
                        ) : (
                          <AiAssetGrid
                            mandatoryAsset={section.mandatoryAsset}
                            h3s={section.h3s}
                            talkingPoints={section.talkingPoints}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* 04 FAQ */}
            {b.faq.length > 0 && (
              <Card className="overflow-hidden">
                <SectionHeader
                  index="04"
                  title="FAQ — People Also Ask capture"
                  meta="Questions drawn from the cluster's real harvested queries"
                />
                <div className="divide-y divide-line">
                  {b.faq.map((item) => (
                    <div key={item.question} className="px-5 py-3.5">
                      <p className="text-sm font-medium text-ink">{item.question}</p>
                      <p className="mt-1 text-xs text-muted">{item.answerDirection}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 05 Internal links */}
            <Card className="overflow-hidden">
              <SectionHeader index="05" title="Internal Linking & Entities" />
              <div className="space-y-4 p-5">
                <div className="overflow-hidden rounded-lg border border-line">
                  {b.internalLinks.map((link) => (
                    <div key={link.anchor} className="border-b border-line p-3 last:border-0">
                      <p className="font-mono text-xs text-brand">{link.anchor}</p>
                      <p className="mt-0.5 text-xs text-ink">→ {link.targetType}</p>
                      <p className="text-[11px] text-muted">{link.placement}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    Entities to cover
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {b.entitiesToCover.map((entity) => (
                      <Badge key={entity}>{entity}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <SectionHeader title="Editorial Directive" role="Content Lead" />
              <div className="space-y-3 p-4">
                <div className="rounded-lg border border-brand/20 bg-brand-soft p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                    Mandated hook
                  </p>
                  <p className="mt-1 text-xs text-ink">{b.editorialDirective.mandatedHook}</p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    Tone & voice
                  </p>
                  <ul className="mt-1 space-y-1">
                    {b.editorialDirective.toneAndVoice.map((tone) => (
                      <li key={tone} className="flex gap-1.5 text-xs text-muted">
                        <span className="text-positive">✓</span>
                        {tone}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    Must avoid
                  </p>
                  <ul className="mt-1 space-y-1">
                    {b.editorialDirective.mustAvoid.map((avoid) => (
                      <li key={avoid} className="flex gap-1.5 text-xs text-muted">
                        <span className="text-danger">✕</span>
                        {avoid}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="rounded-md bg-canvas p-2.5 text-xs text-muted">
                  <span className="font-semibold text-ink">Differentiation rule: </span>
                  {b.editorialDirective.differentiationRule}
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Writer Checklist" meta={`${b.writerChecklist.length} items`} />
              <WriterChecklist items={b.writerChecklist} briefId={view.id} />
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Production Assets" />
              <div className="space-y-2 p-4">
                {b.assetsNeeded.map((asset) => (
                  <div key={asset.type} className="rounded-lg border border-line p-2.5">
                    <p className="text-xs font-medium text-ink">{asset.type}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{asset.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="E-E-A-T Signals" />
              <ul className="space-y-1.5 p-4">
                {b.eeatSignals.map((signal) => (
                  <li key={signal} className="flex gap-1.5 text-xs text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-positive" />
                    {signal}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="mt-5">
          <Card className="overflow-hidden">
            <DeskNote role="Editor note">{b.editorNote}</DeskNote>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div
      className={cx(
        "rounded-lg border p-3",
        tone === "brand" ? "border-brand/20 bg-brand-soft" : "border-line bg-canvas"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={cx("mt-1 text-sm", tone === "brand" ? "text-brand" : "text-ink")}>{value}</p>
    </div>
  );
}

/** Counted in TypeScript - models are unreliable at counting their own characters. */
function CharCount({
  label,
  value,
  ideal,
  limit,
}: {
  label: string;
  value: string;
  ideal: [number, number];
  limit: number;
}) {
  const length = value.length;
  const withinIdeal = length >= ideal[0] && length <= ideal[1];
  const overLimit = length > limit;

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <Badge tone={overLimit ? "danger" : withinIdeal ? "positive" : "warn"} mono>
          {length} chars
        </Badge>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-canvas">
        <div
          className={cx(
            "h-full",
            overLimit ? "bg-danger" : withinIdeal ? "bg-positive" : "bg-warn"
          )}
          style={{ width: `${Math.min(100, (length / limit) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-faint">
        Ideal {ideal[0]}–{ideal[1]}, truncates past {limit}
      </p>
    </div>
  );
}
