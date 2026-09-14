"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LENSES, MARKETS, Lens, MarketCode } from "@/lib/schema";
import { Card, cx } from "@/components/ui";

const SAMPLES: { keyword: string; market: MarketCode; lens: Lens; note: string }[] = [
  { keyword: "photobooth jakarta", market: "ID", lens: "local_service", note: "Local service, Bahasa" },
  { keyword: "jasa pembuatan website", market: "ID", lens: "b2b_demand", note: "Agency-competitive" },
  {
    keyword: "enterprise cloud migration roadmap",
    market: "US",
    lens: "b2b_demand",
    note: "B2B, long consideration",
  },
  { keyword: "sepatu lari terbaik", market: "ID", lens: "ecommerce", note: "Product comparison" },
  {
    keyword: "best project management software",
    market: "SG",
    lens: "thought_leadership",
    note: "Category authority",
  },
  { keyword: "wedding photographer jakarta", market: "ID", lens: "local_service", note: "Local service" },
  { keyword: "how does compound interest work", market: "GB", lens: "general", note: "Broad informational" },
  { keyword: "skincare rutin remaja", market: "ID", lens: "ecommerce", note: "Consumer, Bahasa" },
];

const LENS_DESCRIPTIONS: Record<Lens, string> = {
  general: "No slant — balanced mix of informational, commercial, and navigational queries.",
  local_service: "For businesses serving a city or region: bookings, quotes, \"near me\" intent.",
  b2b_demand: "For longer B2B sales cycles: solution research, comparisons, procurement signals.",
  ecommerce: "For online stores: product, price, and comparison queries that lead to a purchase.",
  thought_leadership: "For building category authority: broad, high-level questions your brand can own.",
};

/**
 * Stage 0 in the UI. Submitting runs the deterministic harvest plus the first
 * model call server-side, then hands off to the board, which drives the
 * remaining desks one request at a time.
 */
export function IntakeForm({ freeTierModel }: { freeTierModel: boolean }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [market, setMarket] = useState<MarketCode>("ID");
  const [lens, setLens] = useState<Lens>("general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(intake?: { keyword: string; market: MarketCode; lens: Lens }) {
    const payload = intake ?? { keyword, market, lens };
    if (payload.keyword.trim().length < 2) {
      setError("Enter a keyword or topic to analyse.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Intake failed");
      router.push(`/w/${data.run.slug ?? data.run.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">New Intake</h2>
        <p className="mt-0.5 text-xs text-muted">
          A keyword enters as a brief. Four desks work it into a strategy.
        </p>
      </div>

      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
              Keyword or topic
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              disabled={busy}
              placeholder="photobooth jakarta"
              maxLength={80}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-brand disabled:opacity-60"
            />
          </label>

          <label className="sm:w-44">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
              Market
            </span>
            <select
              value={market}
              onChange={(event) => setMarket(event.target.value as MarketCode)}
              disabled={busy}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
            >
              {Object.entries(MARKETS).map(([code, info]) => (
                <option key={code} value={code}>
                  {info.label} ({info.language})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
            Strategic lens
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(LENSES).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                title={LENS_DESCRIPTIONS[value as Lens]}
                onClick={() => setLens(value as Lens)}
                className={cx(
                  "cursor-help rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
                  lens === value
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-surface text-muted hover:border-line-strong"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-faint">{LENS_DESCRIPTIONS[lens]}</p>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-wait disabled:opacity-80"
        >
          {busy ? "Search Desk is working…" : "Analyse keyword"}
        </button>

        {busy ? (
          <IntakeProgress freeTierModel={freeTierModel} />
        ) : (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
              Or start from a sample
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.keyword}
                  type="button"
                  onClick={() => {
                    setKeyword(sample.keyword);
                    setMarket(sample.market);
                    setLens(sample.lens);
                    void submit(sample);
                  }}
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-left text-xs transition-colors hover:border-brand hover:bg-brand-soft"
                >
                  <span className="block font-medium text-ink">{sample.keyword}</span>
                  <span className="block text-[10px] text-faint">{sample.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

/**
 * The wait is the product story, so it says what is actually happening rather
 * than spinning. These are the four deterministic stages plus the first desk.
 */
const INTAKE_STEPS = [
  "Normalising the intake",
  "Harvesting Google Suggest across 10 seed expansions",
  "Cleaning and de-duplicating the keyword universe",
  "Matching intent rules against every query",
  "Search Desk is classifying intent",
];

/** Roughly how long each step takes relative to the others, so the estimated bar lands close to real timing. */
const INTAKE_STEP_WEIGHTS = [1, 3, 1, 1, 4];

function useSimulatedStep(weights: number[]): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= weights.length - 1) return;
    const id = setTimeout(() => setStep((s) => s + 1), weights[step] * 900);
    return () => clearTimeout(id);
  }, [step, weights]);
  return step;
}

function IntakeProgress({ freeTierModel }: { freeTierModel: boolean }) {
  const activeIndex = useSimulatedStep(INTAKE_STEP_WEIGHTS);
  const percent = Math.round(((activeIndex + 1) / INTAKE_STEPS.length) * 100);

  return (
    <div className="border-t border-line pt-4">
      <div className="mb-2.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-brand">{INTAKE_STEPS[activeIndex]}…</span>
        <span className="text-faint">
          {activeIndex + 1}/{INTAKE_STEPS.length}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-3 space-y-1.5">
        {INTAKE_STEPS.map((step, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "working" : "pending";
          return (
            <li
              key={step}
              className={cx(
                "flex items-center gap-2 text-xs transition-colors",
                state === "pending" ? "text-faint" : state === "done" ? "text-muted" : "text-ink"
              )}
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  state === "done" && "bg-positive",
                  state === "working" && "bg-brand animate-working",
                  state === "pending" && "bg-line-strong"
                )}
              />
              {step}
            </li>
          );
        })}
      </ol>
      {freeTierModel && (
        <p className="mt-2 text-[11px] text-faint">
          Running on a free-tier model, which queues behind paid traffic — this can take up to
          a couple of minutes rather than seconds.
        </p>
      )}
    </div>
  );
}
