"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/**
 * Copy and download only. A CMS integration would be a day of OAuth for a
 * feature nobody asked for; Markdown pastes into Notion, Docs and every CMS
 * that matters.
 */
export function ExportActions({ markdown, slug }: { markdown: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug || "content-brief"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copy}
        className={cx(
          "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
          copied
            ? "border-positive/30 bg-positive-soft text-positive"
            : "border-line bg-surface text-ink hover:border-line-strong"
        )}
      >
        {copied ? "Copied to clipboard" : "Copy as Markdown"}
      </button>
      <button
        type="button"
        onClick={download}
        className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
      >
        Download .md
      </button>
    </div>
  );
}
