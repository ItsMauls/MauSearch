/**
 * Tiny inline-SVG mockups of what each stage actually does on screen, so the
 * walkthrough isn't just prose. No image assets — these are cheap to keep in
 * sync with the product and free in both themes.
 */

import { cx } from "@/components/ui";

const frame = "h-full w-full";
const line = "stroke-line-strong";
const faint = "fill-faint";

function Box({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 90" className={frame} role="presentation">
      {children}
    </svg>
  );
}

const ILLUSTRATIONS: Record<string, React.ReactNode> = {
  // 1. Clean up keyword — an input box with the raw text settling into a normalised form.
  "1": (
    <Box>
      <rect x="10" y="34" width="140" height="22" rx="6" className="fill-surface stroke-line" strokeWidth="1.5" />
      <text x="20" y="49" fontSize="10" className="fill-ink font-mono">padel jakarta</text>
      <rect x="14" y="36" width="14" height="18" className="fill-brand/10 animate-sweep" />
      <rect x="122" y="39" width="2" height="12" className="fill-brand animate-working" />
      <text x="10" y="24" fontSize="8" className={faint}>market: id · lens: local_service</text>
    </Box>
  ),
  // 2. Ask Google Suggest — parallel requests fanning out, suggestions landing.
  "2": (
    <Box>
      <rect x="6" y="10" width="70" height="14" rx="4" className="fill-surface stroke-line" strokeWidth="1.5" />
      <text x="12" y="20" fontSize="7" className="fill-ink font-mono">padel jakarta…</text>
      {[0, 1, 2].map((i) => (
        <g key={i} className="animate-land" style={{ animationDelay: `${i * 200}ms` }}>
          <line x1="76" y1="17" x2="86" y2={30 + i * 18} className={cx(line, "animate-flow")} strokeWidth="1.2" />
          <rect x="88" y={22 + i * 18} width="66" height="14" rx="4" className="fill-suggest-soft stroke-suggest" strokeWidth="1" />
          <circle
            cx="96"
            cy={29 + i * 18}
            r="2"
            className="fill-suggest animate-working"
            style={{ animationDelay: `${i * 200}ms` }}
          />
          <text x="102" y={32 + i * 18} fontSize="6.5" className="fill-ink font-mono">sewa lapangan…</text>
        </g>
      ))}
    </Box>
  ),
  // 3. Dedupe & rank — a jumble of bars settling into ranked order.
  "3": (
    <Box>
      {[46, 28, 16, 38].map((h, i) => (
        <rect
          key={i}
          x={16 + i * 34}
          y={70 - h}
          width="22"
          height={h}
          rx="3"
          className="fill-brand-soft stroke-brand animate-grow"
          strokeWidth="1"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <line x1="10" y1="70" x2="150" y2="70" className={line} strokeWidth="1.5" />
      <text x="16" y="82" fontSize="6.5" className={faint}>ranked by frequency</text>
    </Box>
  ),
  // 4. Rule-based buying signal — a word gets pattern-matched and tagged, no AI.
  "4": (
    <Box>
      <rect x="10" y="38" width="90" height="16" rx="4" className="fill-surface stroke-line" strokeWidth="1.5" />
      <text x="16" y="49" fontSize="8" className="fill-ink font-mono">sewa lapangan padel</text>
      <rect x="26" y="38" width="24" height="16" rx="3" className="fill-rule-soft stroke-rule animate-working" strokeWidth="1.2" />
      <line x1="38" y1="54" x2="120" y2="66" className={cx(line, "animate-flow")} strokeWidth="1.2" />
      <rect x="106" y="62" width="44" height="16" rx="8" className="fill-rule-soft stroke-rule animate-land" strokeWidth="1.2" />
      <text x="112" y="73" fontSize="6.5" className="fill-rule font-mono">transactional</text>
    </Box>
  ),
  // 5. AI reads the queries and estimates the intent mix.
  "5": (
    <Box>
      {[0, 1, 2].map((i) => (
        <rect key={i} x="10" y={12 + i * 12} width={70 - i * 10} height="6" rx="3" className="fill-canvas stroke-line" strokeWidth="1" />
      ))}
      <rect x="8" y="10" width="70" height="6" className="fill-ai/15 animate-scan" />
      <rect x="8" y="10" width="2" height="40" className="fill-ai animate-working" />
      <circle cx="118" cy="30" r="20" className="fill-ai-soft stroke-ai animate-bob" strokeWidth="1.5" />
      <text x="118" y="27" fontSize="7" textAnchor="middle" className="fill-ai font-semibold">50%</text>
      <text x="118" y="37" fontSize="5.5" textAnchor="middle" className="fill-ai">transactional</text>
      <text x="10" y="66" fontSize="6.5" className={faint}>reading queries + rule tags</text>
    </Box>
  ),
  // 6. Clustering — scattered dots pull into three named topic groups.
  "6": (
    <Box>
      {[
        { cx: 34, cy: 30, r: 22, label: "Booking & Pricing" },
        { cx: 96, cy: 22, r: 16, label: "Nearest Venues" },
        { cx: 128, cy: 58, r: 14, label: "Learning" },
      ].map((c, ci) => (
        <g key={ci} className="animate-land" style={{ animationDelay: `${ci * 150}ms` }}>
          <g className="animate-bob" style={{ animationDelay: `${ci * 250}ms` }}>
            <circle cx={c.cx} cy={c.cy} r={c.r} className="fill-ai-soft stroke-ai" strokeWidth="1.2" />
            <text x={c.cx} y={c.cy + c.r + 9} fontSize="6" textAnchor="middle" className="fill-ai">
              {c.label}
            </text>
          </g>
        </g>
      ))}
    </Box>
  ),
  // 7. Audience & funnel fit — a persona mapped down a funnel to bottom-funnel.
  "7": (
    <Box>
      <circle cx="26" cy="24" r="10" className="fill-accent/15 stroke-accent animate-bob" strokeWidth="1.2" />
      <text x="26" y="27" fontSize="9" textAnchor="middle">🙂</text>
      <path d="M50 12 L110 12 L86 70 L74 70 Z" className="fill-accent/10 stroke-accent" strokeWidth="1.2" />
      <circle cx="80" cy="30" r="3" className="fill-accent animate-fall" />
      <text x="10" y="84" fontSize="6.5" className={faint}>bottom-funnel → booking page</text>
    </Box>
  ),
  // 8. Creative desk — pitched idea kept, another rejected with a strike-through.
  "8": (
    <Box>
      <g className="animate-bob">
        <rect x="10" y="14" width="66" height="30" rx="5" className="fill-positive-soft stroke-positive" strokeWidth="1.2" />
        <text x="16" y="26" fontSize="6.5" className="fill-ink">Court Booking</text>
        <text x="16" y="36" fontSize="6.5" className="fill-ink">Guide: Jakarta</text>
      </g>
      <rect x="84" y="14" width="66" height="30" rx="5" className="fill-canvas stroke-line" strokeWidth="1.2" opacity="0.7" />
      <text x="90" y="26" fontSize="6.5" className={faint}>What Is Padel?</text>
      <line x1="88" y1="30" x2="146" y2="30" className="stroke-danger animate-draw" strokeWidth="1" />
      <text x="10" y="60" fontSize="6.5" className={faint}>scored, kept, and rejected — with reasons</text>
    </Box>
  ),
  // 9. Writing the brief — an outline document filling in line by line.
  "9": (
    <Box>
      <rect x="34" y="8" width="92" height="74" rx="5" className="fill-surface stroke-line" strokeWidth="1.5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x="44"
          y={20 + i * 12}
          width={i === 0 ? 50 : 72 - (i % 2) * 14}
          height={i === 0 ? 7 : 4}
          rx="2"
          className="fill-canvas animate-land"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
      <rect x="60" y="66" width="2" height="4" className="fill-ink animate-working" style={{ animationDelay: "560ms" }} />
    </Box>
  ),
  // 10. Save — every step checked off and persisted.
  "10": (
    <Box>
      <rect x="24" y="18" width="112" height="54" rx="8" className="fill-surface stroke-line" strokeWidth="1.5" />
      {[0, 1, 2].map((i) => (
        <g key={i} className="animate-land" style={{ animationDelay: `${i * 160}ms` }}>
          <circle cx="38" cy={32 + i * 14} r="4" className="fill-positive" />
          <path
            d={`M35.5 ${32 + i * 14} l2 2 l3.5 -4`}
            className="stroke-white animate-draw"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${i * 160}ms` }}
          />
          <rect x="48" y={29 + i * 14} width="72" height="5" rx="2.5" className="fill-canvas" />
        </g>
      ))}
    </Box>
  ),
};

export function StageIllustration({ n }: { n: string }) {
  const svg = ILLUSTRATIONS[n];
  if (!svg) return null;
  return (
    <div className="h-40 w-full shrink-0 overflow-hidden rounded-lg border border-line bg-canvas p-2.5 sm:h-32 sm:w-64">
      {svg}
    </div>
  );
}
