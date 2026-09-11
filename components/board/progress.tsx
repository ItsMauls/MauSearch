"use client";

import { useEffect, useState } from "react";

/** Counts seconds since mount. Callers remount this by conditionally
 *  rendering it (or keying it), so the clock restarts each time generation starts. */
export function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

/** Indeterminate progress bar + short caption of what's generating right now. */
export function ProgressBar({ caption }: { caption: string }) {
  return (
    <div className="mt-4">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-canvas">
        <div className="animate-progress absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand" />
      </div>
      <p className="mt-1.5 text-[11px] text-faint">{caption}</p>
    </div>
  );
}
