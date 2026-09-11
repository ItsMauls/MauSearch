import Link from "next/link";
import { listBriefs } from "@/lib/db";
import { toBriefView } from "@/lib/view";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, EmptyState, SectionHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BriefsLibrary() {
  const briefs = (await listBriefs()).map(toBriefView);

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="brand">LIBRARY</Badge>}
        title="Content Briefs"
        subtitle="Every brief the Editorial Desk has produced. Each one links back to the board it came from."
        actions={<ButtonLink href="/">New intake</ButtonLink>}
      />

      <div className="mx-auto max-w-6xl px-6 py-6 md:px-8">
        <Card>
          <SectionHeader
            title="All briefs"
            meta={`${briefs.length} brief${briefs.length === 1 ? "" : "s"}`}
          />
          {briefs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No briefs yet"
                body="Every brief starts as an intake. Analyse a keyword, pick the opportunity worth pursuing, and the Editorial Desk writes the brief."
                action={<ButtonLink href="/">Start an intake</ButtonLink>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {briefs.map((brief) => (
                <li key={brief.id}>
                  <Link
                    href={`/brief/${brief.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-canvas"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {brief.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {brief.brief.contentType} · {brief.brief.outline.length} sections ·{" "}
                        {brief.brief.wordCount.min}–{brief.brief.wordCount.max} words
                      </span>
                    </span>
                    <Badge mono>{brief.keyword}</Badge>
                    <Badge>{brief.market}</Badge>
                    <span className="text-xs text-faint">
                      {new Date(brief.createdAt).toISOString().slice(0, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
