import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

/**
 * The handful of primitives this product actually needs. A component library
 * would have been overridden into unrecognisability by the design anyway.
 */

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cx("rounded-xl border border-line bg-surface", className)}>{children}</Tag>
  );
}

/** Numbered section chip + title, the spine of both the board and the brief. */
export function SectionHeader({
  index,
  title,
  role,
  meta,
  action,
}: {
  index?: string;
  title: string;
  role?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {index && (
          <span className="mt-0.5 rounded-md bg-brand-soft px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {index}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {role && (
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-faint">
              {role}
            </p>
          )}
          {meta && <div className="mt-1 text-xs text-muted">{meta}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: "bg-canvas text-muted border-line",
  brand: "bg-brand-soft text-brand border-brand/20",
  positive: "bg-positive-soft text-positive border-positive/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  accent: "bg-ai-soft text-ai border-ai/20",
} as const;

export function Badge({
  children,
  tone = "neutral",
  mono,
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        mono && "font-mono",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
        {tone}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** A horizontal share bar - used for the intent mix and format fit. */
export function ShareBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-canvas">
      {segments.map((s) => (
        <div
          key={s.label}
          className="h-full"
          style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          title={`${s.label}: ${s.value}%`}
        />
      ))}
    </div>
  );
}

/** Plain-language helper: a "?" that reveals a jargon term's meaning on hover/tap. */
export function Info({ children }: { children: string }) {
  return (
    <span
      title={children}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line bg-canvas text-[10px] font-semibold text-faint align-middle"
    >
      ?
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function Banner({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "brand" | "danger";
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    warn: "border-warn/25 bg-warn-soft text-warn",
    brand: "border-brand/20 bg-brand-soft text-brand",
    danger: "border-danger/20 bg-danger-soft text-danger",
  };
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-0.5 opacity-90">{children}</div>}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        variant === "primary"
          ? "bg-brand text-white hover:bg-brand/90"
          : "border border-line bg-surface text-ink hover:border-line-strong"
      )}
    >
      {children}
    </Link>
  );
}

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

/** Italic desk sign-off. The attribution is what sells "agency" over "AI output". */
export function DeskNote({ role, children }: { role: string; children: ReactNode }) {
  return (
    <div className="border-t border-line bg-canvas/60 px-5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{role}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted italic">{children}</p>
    </div>
  );
}
