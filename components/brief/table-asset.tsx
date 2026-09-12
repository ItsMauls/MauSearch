"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const stripPunctuation = (s: string) => s.replace(/^[^\w]+|[^\w]+$/g, "");

/**
 * Picks up on "X vs Y" phrasing (works for both "morning vs afternoon" and
 * Indonesian "pagi hari vs siang hari") so the generated columns actually
 * name what's being compared instead of a generic "Detail" column.
 */
function detectComparisonColumns(texts: string[]): [string, string] | null {
  for (const text of texts) {
    const match = text.match(/(\S+(?:\s+\S+)?)\s+vs\.?\s+(\S+(?:\s+\S+)?)/i);
    if (!match) continue;
    const a = stripPunctuation(match[1]);
    const b = stripPunctuation(match[2]);
    if (a && b) return [titleCase(a), titleCase(b)];
  }
  return null;
}

/**
 * Scaffold, not real data: h3s (the section's actual itemized subjects) as
 * rows, and a comparison pair detected from the talking points as columns
 * when there is one. No AI call - everything here is already in the outline.
 */
function buildRows(h3s: string[], talkingPoints: string[]): string[][] {
  const rowLabels = h3s.length > 0 ? h3s : talkingPoints.length > 0 ? talkingPoints : [""];
  const comparison = detectComparisonColumns(talkingPoints);
  const header = comparison ? ["Item", ...comparison] : ["Item", "Detail"];
  const blankCells = comparison ? ["", ""] : [""];
  return [header, ...rowLabels.map((label) => [label, ...blankCells])];
}

function toCsv(rows: string[][]): string {
  const escape = (cell: string) =>
    /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function TableAsset({
  h3s,
  talkingPoints,
}: {
  h3s: string[];
  talkingPoints: string[];
}) {
  const [open, setOpen] = useState(false);
  const rows = buildRows(h3s, talkingPoints);

  function downloadCsv() {
    downloadBlob(new Blob([toCsv(rows)], { type: "text/csv" }), "table.csv");
  }

  async function downloadXlsx() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Table");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "table.xlsx"
    );
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "rounded-md border border-brand/20 bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
        )}
      >
        {open ? "Hide table" : "Generate table"}
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-md border border-line">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-canvas">
                  {rows[0].map((cell) => (
                    <th key={cell} className="border-b border-line px-2.5 py-1.5 text-left font-semibold text-ink">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2.5 py-1.5 text-muted">
                        {cell || <span className="text-faint">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 border-t border-line bg-canvas/60 px-2.5 py-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={downloadXlsx}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download XLSX
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
