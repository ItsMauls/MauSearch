"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toCsv, downloadBlob, downloadXlsx } from "./asset-utils";
import type { MapPoint } from "./map-view";

const MapView = dynamic(() => import("./map-view"), { ssr: false });

type GridResult = { kind: "grid"; columns: string[]; rows: string[][] };
type MapResult = { kind: "map"; points: MapPoint[] };
type Result = GridResult | MapResult;

/**
 * One generator for every "required asset" a section can name. The backend
 * decides the shape: a real geocoded map for "peta interaktif" / map, or a
 * table scaffold with AI-drafted content for everything else (table,
 * screenshot, chart, infographic, ...). This component only renders whichever
 * comes back.
 */
export function AssetGenerator({
  mandatoryAsset,
  h3s,
  talkingPoints,
}: {
  mandatoryAsset: string;
  h3s: string[];
  talkingPoints: string[];
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [stamp, setStamp] = useState("");
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
      setResult(await res.json());
      // A fresh id per generation so re-downloading the same asset never
      // overwrites the browser's previous download of it.
      setStamp(Date.now().toString(36));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const slug = mandatoryAsset.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
  const filename = `${slug}-${stamp}`;

  return (
    <div className="mt-2.5">
      {!result ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-md border border-ai/20 bg-ai-soft px-2.5 py-1.5 text-xs font-semibold text-ai transition-colors hover:bg-ai/10 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Generating…" : `Generate: ${mandatoryAsset}`}
        </button>
      ) : result.kind === "map" ? (
        result.points.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-line">
            <MapView points={result.points} />
            <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-2.5 py-2">
              <p className="text-[11px] text-faint">
                {result.points.length} location{result.points.length === 1 ? "" : "s"} from the outline
              </p>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-[11px] font-medium text-faint hover:text-muted"
              >
                Hide
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-line bg-canvas/60 px-2.5 py-1.5 text-[11px] text-muted">
            No named locations in this section&apos;s outline to map. Add a place name to the talking points first.
          </p>
        )
      ) : (
        <div className="overflow-hidden rounded-md border border-line">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-ai-soft">
                  {result.columns.map((cell) => (
                    <th
                      key={cell}
                      className="border-b border-ai/20 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ai"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-surface" : "bg-canvas/60"}>
                    {row.map((cell, j) => (
                      <td key={j} className="border-b border-line px-2.5 py-2 align-top text-ink last:border-r-0">
                        {cell || <span className="italic text-faint">Not specified in outline</span>}
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
              onClick={() =>
                downloadBlob(new Blob([toCsv([result.columns, ...result.rows])], { type: "text/csv" }), `${filename}.csv`)
              }
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => downloadXlsx([result.columns, ...result.rows], "Asset", `${filename}.xlsx`)}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-line-strong"
            >
              Download XLSX
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="ml-auto text-[11px] font-medium text-faint hover:text-muted"
            >
              Hide
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] text-danger">Couldn&apos;t generate that asset. Try again.</p>}
    </div>
  );
}
