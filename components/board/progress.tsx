"use client";

import { useEffect, useRef, useState } from "react";

/** Counts seconds since `since` (default: mount time), computed from the
 *  wall clock rather than a tick count - so a page reload mid-stage, given
 *  the real start timestamp, resumes the count instead of restarting at 0. */
export function useElapsedSeconds(since?: number): number {
  const mountedAt = useRef(Date.now());
  const start = since ?? mountedAt.current;
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - start) / 1000));
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
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
