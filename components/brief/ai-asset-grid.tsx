"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { toCsv, downloadBlob, downloadXlsx } from "./asset-utils";

type Grid = { columns: string[]; rows: string[][] };

/**
 * Generic required-asset generator for anything that isn't a plain table
 * (interactive map, screenshot, chart, infographic, ...). Calls the AI-assisted
 * scaffold endpoint on demand rather than at brief-generation time, since most
 * sections don't need one and the model call has a real cost.
 */
export function AiAssetGrid({
  mandatoryAsset,
  h3s,
  talkingPoints,
}: {
  mandatoryAsset: string;
  h3s: string[];
  talkingPoints: string[];
}) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function generate() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/brief/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandatoryAsset, h3s, talkingPoints }),
      });
      if (!res.ok) throw new Error("request failed");
      setGrid(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const filename = mandatoryAsset.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";

  return (
    <div className="mt-2.5">
      {!grid ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={cx(
            "cursor-pointer rounded-md border border-ai/20 bg-ai-soft px-2.5 py-1.5 text-xs font-semibold text-ai transition-colors hover:bg-ai/10 disabled:cursor-wait disabled:opacity-70"
          )}
        >
          {loading ? "Generating…" : `Generate: ${mandatoryAsset}`}
        </button>
      ) : (
        <div className="overflow-hidden rounded-md border border-line">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-canvas">
                  {grid.columns.map((cell) => (
                    <th key={cell} className="border-b border-line px-2.5 py-1.5 text-left font-semibold text-ink">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, i) => (
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
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-2.5 py-2">
            <button
              type="button"
              onClick={() => downloadBlob(new Blob([toCsv([grid.columns, ...grid.rows])], { type: "text/csv" }), `${filename}.csv`)}
              className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => downloadXlsx([grid.columns, ...grid.rows], "Asset", `${filename}.xlsx`)}
              className="cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download XLSX
            </button>
            <button
              type="button"
              onClick={() => setGrid(null)}
              className="cursor-pointer ml-auto text-[11px] font-medium text-faint hover:text-muted"
            >
              Hide
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-[11px] text-danger">Couldn&apos;t generate that asset. Try again.</p>
      )}
    </div>
  );
}
