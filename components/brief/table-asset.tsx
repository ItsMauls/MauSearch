"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/**
 * Only a scaffold: talking points as rows, a blank cell for the writer to
 * fill in. No AI call - the outline already has everything this needs.
 */
function buildRows(talkingPoints: string[]): string[][] {
  const points = talkingPoints.length > 0 ? talkingPoints : [""];
  return [["Talking point", "Detail"], ...points.map((point) => [point, ""])];
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
  mandatoryAsset,
  talkingPoints,
}: {
  mandatoryAsset: string;
  talkingPoints: string[];
}) {
  const [open, setOpen] = useState(false);
  const rows = buildRows(talkingPoints);

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
        {open ? "Hide table" : "Generate table"} · {mandatoryAsset}
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
