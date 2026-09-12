"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

export function WriterChecklist({ items, briefId }: { items: string[]; briefId: string }) {
  const storageKey = `mausearch:checklist:${briefId}`;
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Hydrating from a browser-only store after mount - server has no localStorage,
      // so this can't be a lazy initializer without mismatching the SSR markup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(new Set(JSON.parse(raw)));
    } catch {
      // ignore corrupt/unavailable storage, checklist just starts unchecked
    }
  }, [storageKey]);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <ul className="space-y-2 p-4">
      {items.map((item, index) => (
        <li key={index}>
          <label className="flex cursor-pointer gap-2 text-xs">
            <input
              type="checkbox"
              checked={checked.has(index)}
              onChange={() => toggle(index)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line-strong text-brand accent-current"
            />
            <span className={cx(checked.has(index) ? "text-faint line-through" : "text-muted")}>
              {item}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
