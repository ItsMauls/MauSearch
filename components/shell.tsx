"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "Workspace Home", icon: GridIcon },
  { href: "/briefs", label: "Content Briefs", icon: DocIcon },
  { href: "/how-it-works", label: "How It Works", icon: FlowIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-surface md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-mono text-sm font-bold text-white">
          M
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-ink">MauSearch</span>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-faint">
            Content Planning
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname?.startsWith("/w/")
              : href === "/briefs"
                ? pathname?.startsWith("/briefs") || pathname?.startsWith("/brief/")
                : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-canvas hover:text-ink"
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function GridIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M9 2v3h3M5.5 8.5h5M5.5 11h3" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="4" cy="12" r="2" />
      <path d="M6 5.2 10 7M10 9l-4 1.8" />
    </svg>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-surface px-6 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
