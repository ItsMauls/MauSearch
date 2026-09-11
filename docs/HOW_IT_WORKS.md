<!-- Companion to BLUEPRINT.md: explains the pipeline and its jargon in plain terms, with a step-by-step trace of one real user journey. Code is authoritative; this describes what the code in lib/pipeline, lib/ai, lib/schema.ts actually does. -->

# How MauSearch Works

One keyword goes in. Four "desks" reason over it in sequence, each one only allowed
to see what the desk before it produced. Everything the app shows is tagged with
where it came from — a real Google query, a hand-written rule, an AI judgment call,
or a formula computed in TypeScript. This doc explains the pipeline stage by stage,
defines every term the UI uses, and walks through one real search end to end.

## 1. The Desk Pipeline

"Desk Pipeline" is the name for the whole chain: four simulated agency roles, each
producing one structured document that the next desk reasons over.

| Desk | Human role it plays | Reads | Produces |
|---|---|---|---|
| **Search Desk** | SEO Strategist | raw Google Suggest data + rule signals | Demand Read (intent mix, keyword universe, clusters, entities) |
| **Planning Desk** | Content Strategist | Demand Read | Audience & Fit (personas, funnel map, format fit) |
| **Creative Desk** | Creative Director | Demand Read + Audience & Fit | Angle Room (opportunities + Kill List) |
| **Editorial Desk** | Content Lead / Editor | one chosen Opportunity | Production Brief |

The Search, Planning, and Creative desks run automatically the moment you submit a
keyword. The Editorial Desk only runs when you pick one opportunity and click
"Generate Brief" — that click is the one deliberate decision the product asks of you.

Underneath, the pipeline is 10 technical stages (`docs/BLUEPRINT.md` §8):
normalize → harvest → dedupe → rule signals → AI intent → AI clusters → AI
planning → AI creative → (on demand) AI brief → validate/persist. Only stages 4–8
call the model; everything else is plain code.

## 2. Demand Read — what "intent" actually means

Demand Read is the Search Desk's output: it tells you what people typing this
keyword actually want, using two independent readers that are then reconciled.

**Reader 1 — the rule lexicon (deterministic, instant, free).** A hand-written
word list per language (`lib/pipeline/rules.ts`) scans each harvested query for
known modifiers:

| Intent | What it means | Example trigger words (ID) |
|---|---|---|
| **Transactional** | ready to spend money now | `sewa`, `harga`, `beli`, `murah`, `promo` |
| **Commercial** | comparing options before buying | `terbaik`, `rekomendasi`, `vs`, `review` |
| **Informational** | wants to learn/understand | `cara`, `apa`, `kenapa`, `tips`, `panduan` |
| **Navigational** | looking for a specific site/brand | `login`, `resmi`, `aplikasi` |
| **Local** | wants a nearby physical option | `terdekat`, `dekat`, `sekitar` |

If a query matches more than one category, precedence resolves it in the order
above — transactional beats commercial beats informational beats navigational,
and local wins only when nothing else matched (a price word means more than a
"near me" word). This is instant, free, and 100% auditable — no model call.

**Reader 2 — the AI (Nemotron via 9router, temp 0.1).** The model reads every
keyword *with its rule verdict already attached* and does three things a lexicon
can't:
- classifies the handful of queries the lexicon had no opinion on (`RULE:none`)
- computes the overall **intent mix** — percentage shares across the intents
  present, each backed by cited evidence ("which queries prove it")
- decides the **SERP archetype** and **expected SERP features**

**Where the model overruled the rules.** The system prompt explicitly tells the
model: treat a rule match as strong evidence, and only override it when the full
query plainly means something else — and when it does override, it must log the
override. That log is `ruleDisagreements`, e.g.:

```json
{ "keyword": "harga vendor terbaik", "ruleSaid": "transactional", "modelSays": "commercial",
  "why": "the query is comparing vendors, not committing to one — 'terbaik' dominates the intent" }
```

The UI shows this list because it's the one place the AI is visibly contradicting a
transparent, human-readable rule — that's worth surfacing, not hiding.

**SERP archetype** — a one-line prediction of what the actual Google results page
looks like for this query type, e.g. *"local pack over vendor listicles"* or
*"comparison articles with embedded pricing tables"*. It's a judgment call (AI), not
a measurement — MauSearch never scrapes live SERPs.

**Expected SERP features** — up to 8 individual elements the model expects to see
on that results page (local pack, People Also Ask, image pack, featured snippet,
shopping carousel, etc.). This tells a strategist what format has a realistic shot
at ranking — a listicle competing against a local pack is a losing bet regardless
of writing quality.

## 3. Keyword Universe, Topic Clusters, Entities, Coverage Gaps

**Keyword Universe** — every unique query Google Suggest actually returned for
this seed keyword, after dedupe. Each row carries:
- **Suggest Rank** — the position Google returned it at (lower = more prominent)
- **Seed Coverage** — how many of the ~10 seed variants (base keyword, `cara X`,
  `harga X`, `X terdekat`, …) surfaced this same query — a breadth signal
- **Demand Signal (MauScore)** — see §5

**Topic Clusters** — the Creative/Search Desk groups the keyword universe by *what
the searcher is trying to accomplish*, not by shared words (the prompt explicitly
warns against clustering `"X murah"` with `"X premium"` just because they share a
token). A cluster needs enough members to justify its own page — 2 keywords isn't
a cluster, and keywords that fit nowhere are dropped rather than forced in. Each
cluster gets a dominant intent, a funnel stage (TOFU/MOFU/BOFU), and a one-line
strategist note.

**Entities** — up to 20 named things (brands, concepts, comparison criteria,
locations) that any content on this topic must reference to read as *authoritative*
rather than superficial. For `photobooth jakarta` this might include specific
neighborhoods, event types (wedding, corporate), or standard package tiers — the
stuff a genuine expert would casually mention. This list later becomes
`entitiesToCover` in the final brief.

**Coverage Gaps** — questions the keyword set implies but that nothing in the
harvested universe is obviously answering. This is the model spotting a hole: if
people search "harga photobooth" and "sewa photobooth murah" but nobody's query
addresses cancellation policy or setup time, that absence is itself a signal — a
content opportunity competitors haven't filled.

## 4. Audience & Fit — the Planning Desk's output

Reasoning over clusters only (it never re-touches raw keywords), the Planning Desk
produces:
- **Personas** (1–3) — persona name, role, job-to-be-done, pain points,
  objections, and the specific trigger that moves them to act
- **Funnel Map** — one funnel stage + recommended content format per cluster,
  with a reason ("whyThisFormat")
- **Format Fit** — up to 6 content formats scored 0–100 for fit, each tagged
  with which clusters it serves best and the effort (low/medium/high) to produce it
- **Content Goals** — primary goal, secondary goal, success metric
- **Portfolio Advice** — sequencing guidance (what to publish first, second…)
- **Planner Note** — the sign-off: the Planning Desk's one italicized comment,
  same pattern as every other desk

## 5. Opportunity Score & the Kill List — the Creative Desk

The Creative Desk (temp 0.8 — the one deliberately "creative" stage) generates
4–6 scored **Opportunities** and a **Kill List**.

Each Opportunity carries an angle (framing, hook, a contrarian take, and an
explicit "why this isn't generic"), a target + supporting keywords, an audience,
a promise, proof required, SEO title options, and a risk-if-ignored line.

**Opportunity Score** is the one place demonstrating that *AI judgment ranks
things, but the ranking formula itself is deterministic TypeScript, not the
model*:

```
demandSignal (per keyword, real Suggest data)
  kwSignal      = clamp(100 − min(rank, 20)×3 + min(coverage−1, 3)×5, 0, 100)
  clusterDemand = mean(kwSignal of the cluster's member keywords)

opportunityScore = 0.30 × demandSignal      [MAUSCORE — from real Suggest data]
                 + 0.30 × intentValue       [AI]
                 + 0.25 × differentiation   [AI]
                 + 0.15 × (100 − effort)    [AI]
```

The model only ever emits `intentValue`, `differentiation`, and `effort` (0–100
each) — it never sees or produces the final score. 30% of the ranking is
traceable to real Google data; the tooltip on every card says exactly which 30%.
Scores map to priority: highest → **P0**, next tier → **P1**, rest → **P2**.

**Kill List** — 2–5 ideas the desk considered and explicitly rejected, each with
a reason. This is the signature detail of the product: an idea generator only
ever says yes. Showing what a strategist said *no* to, and why, is what makes the
output read as agency judgment rather than a list of suggestions.

## 6. Production Brief — the Editorial Desk

Generated only for the one Opportunity you select, never for all of them (this is
also what keeps the API to one LLM call per request). It contains: working
title/slug/content type/word count, an objective (business goal, reader outcome,
CTA, conversion path), editorial directives (mandated hook, tone, what to avoid,
the differentiation rule), metadata (H1/meta title/meta description), a full
outline (H2s with purpose, est. word count, talking points, H3s, any mandatory
asset), FAQs, `entitiesToCover` (carried forward and refined from the cluster
stage's `entities`), internal link suggestions, assets needed, a writer checklist,
and E-E-A-T signals to demonstrate to Google.

## 7. Provenance — the labeling system that ties it all together

Every single number or claim on screen carries one of four tags, rendered as a
colored chip:

| Chip | Meaning |
|---|---|
| `GOOGLE SUGGEST` | a real query Google actually returned |
| `RULE` | matched a hand-written lexicon term — zero model involvement |
| `AI` | Nemotron's judgment — never presented as a measurement |
| `MAUSCORE` | a formula computed in TypeScript, shown on hover |

No search volume, CPC, keyword difficulty, or competitor metric appears anywhere
— MauSearch has no data source for those, so rather than faking them, it doesn't
show them.

---

## 8. Real use case, step by step: user searches `photobooth jakarta`

Here is exactly what happens behind the scenes, in order, including when the AI
gets involved and when it doesn't.

1. **User types `photobooth jakarta`**, picks market = Indonesia, lens = Local
   Service, clicks Analyze. `POST /api/runs` fires.
2. **Normalize** (deterministic, instant) — trims/lowercases the keyword, resolves
   market → language `id`, country `ID`.
3. **Harvest** (real network call, ~1s, no AI) — fires ~10 parallel requests to
   Google's Suggest endpoint: the base keyword plus locale prefixes/suffixes
   (`cara photobooth jakarta`, `harga photobooth jakarta`, `photobooth jakarta
   terdekat`, `photobooth murah jakarta`, …). Returns 50–100 raw suggestions like
   `sewa photobooth jakarta`, `harga photobooth jakarta`, `photobooth murah
   jakarta wedding`. Uses `Promise.allSettled` — if a few seeds fail (Google
   rate-limiting), the run continues on what came back.
4. **Dedupe** (deterministic) — collapses duplicates across seeds, records each
   surviving keyword's best rank and how many seeds surfaced it.
5. **Rule signals** (deterministic, no AI yet) — every keyword is scanned against
   the ID/EN lexicon. `sewa photobooth jakarta` → matches `sewa` → tagged
   `RULE:transactional`. `cara booking photobooth` → matches `cara` → tagged
   `RULE:informational`. This is the point where the app already knows a lot
   about intent without having spent a single AI call.
6. **AI intent classification — the first model call happens here** (`AI`, temp
   0.1). The model receives the full keyword list *with* the RULE tags already
   attached, and: resolves the handful of queries the lexicon couldn't tag,
   computes the intent mix (e.g. ~55% transactional, ~25% local, ~20%
   informational), decides the SERP archetype (e.g. "local pack + vendor
   listicles + price comparison snippets"), lists expected SERP features (local
   pack, PAA, image pack), and logs any rule overrides. Response panel: **Demand
   Read** renders with every row's provenance chip. (~12s total from click.)
7. **AI clustering — second model call** (temp 0.3), reasoning only over the
   already-classified keyword list. Groups into clusters like "Pricing &
   Packages", "Wedding Photobooth", "Vendor Comparison" — plus the entity list
   (venue types, package tiers) and coverage gaps (e.g. "nobody's query addresses
   rental duration or setup logistics"). (~10s, panel updates live.)
8. **AI planning — third model call** (temp 0.3), reasoning only over clusters.
   Produces personas (e.g. "Wedding planner comparing vendors on a deadline"),
   a funnel map per cluster, and format-fit scores (a local landing page scores
   high; a long-form guide scores lower for a bottom-funnel local-transactional
   keyword like this one). (~10s.)
9. **AI creative — fourth model call** (temp 0.8, the only "generative" stage),
   reasoning over clusters + audience. Produces 4–6 opportunities — e.g. a local
   service page targeting `sewa photobooth jakarta`, and a wedding-photobooth
   comparison guide — each scored, plus a Kill List (e.g. "generic '10 best
   photobooth tips' listicle — rejected: doesn't match the transactional intent
   this keyword set actually shows"). TypeScript then computes `opportunityScore`
   for each card from the real demand signal + the AI's three dimensions —
   ranking is never done by the model itself. (~12s. Angle Room renders.)
10. **User reviews the Angle Room**, reads the Opportunity Score tooltip (which
    shows exactly how much of that score came from real Google data vs. AI
    judgment), and picks the local-service-page opportunity.
11. **User clicks "Generate Brief"** → `POST /api/briefs` → **fifth and final
    model call** (temp 0.4), scoped to that one opportunity only. Produces the
    full Production Brief: outline, metadata, FAQs, entities to cover, internal
    links, writer checklist. (~15s.) Redirects to `/brief/[briefId]`.
12. **Every stage persisted the moment it returned** (steps 6–11 each write to
    Postgres immediately), so a page reload at any point rehydrates the board
    instead of losing progress or re-billing the model.

Total: 5 AI calls across the whole session (steps 6, 7, 8, 9, 11) — never more
than one per HTTP request, which is also why no stage takes longer than
Vercel's serverless timeout. Steps 1–5 are pure deterministic code; the model is
never asked to invent a number it can't back up, because the one number that
matters most for ranking (demand) never comes from it.
