import { listBriefsWithLens } from "@/lib/db";
import { toBriefView } from "@/lib/view";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink } from "@/components/ui";
import { BriefsList } from "@/components/briefs/briefs-list";

export const dynamic = "force-dynamic";

export default async function BriefsLibrary() {
  const rows = await listBriefsWithLens();
  const briefs = rows.map((row) => ({ ...toBriefView(row), lens: row.lens }));

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="brand">LIBRARY</Badge>}
        title="Content Briefs"
        subtitle="Every brief the Editorial Desk has produced. Each one links back to the board it came from."
        actions={<ButtonLink href="/">New intake</ButtonLink>}
      />

      <div className="mx-auto max-w-6xl px-6 py-6 md:px-8">
        <BriefsList briefs={briefs} />
      </div>
    </>
  );
}
