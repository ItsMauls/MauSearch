<!-- The product blueprint MauSearch was built from. The implementation follows it; where it diverged, the code and README are authoritative. -->

# MauSearch — Product Blueprint

## 1. Product summary

MauSearch takes a keyword and runs it through a simulated content agency. Real Google Suggest data is harvested and cleaned, deterministic rules extract intent signals, then four specialist "desks" — Search, Planning, Creative, Editorial — reason over that evidence in sequence, each building on the last desk's structured output and each signing off with a note. The user watches the work happen, reads a strategy board where every number is labeled with where it came from, picks the opportunity worth pursuing, and walks away with a writer-ready brief.

## 2. Core positioning statement

> **MauSearch is an AI-powered agency-style content planning workspace.** A keyword goes in as an intake brief. A strategy comes out — evidenced, prioritized, and ready to hand to a writer.

Not a keyword tool. Not a chatbot. Not a text generator. The output is *structured thinking*, attributed both to the role that produced it and to the data that justifies it.

## 3. Problem statement

Anyone planning SEO content is stuck between two bad tools. Keyword tools give volume and difficulty with zero judgment — no answer to "so what should I write?". AI chatbots give a fluent paragraph with zero structure, zero prioritization, and — worse — confidently invented numbers. The expensive middle layer, a strategist deciding what's worth doing, a creative director making it non-generic, an editor turning it into a brief, is exactly what neither provides.

The result: teams publish generic content aimed at keywords nobody was going to convert on, justified by metrics that were never real.

## 4. Product goals

1. **Turn a keyword into a decision**, not a data dump — one recommended opportunity with a visible reason.
2. **Make the reasoning legible.** Every output is attributed to a desk and carries that desk's note.
3. **Never blur evidence with inference.** Every data atom is labeled Google Suggest / Rule / AI / MauScore.
4. **Fabricate nothing.** No invented volume, CPC, keyword difficulty, or competitor metrics — anywhere.
5. **End in something executable** — a brief a writer can start from today.
6. **Feel like a workspace** — persistent runs, a brief library, shareable permalinks.

## 5. Target users

| User | What they come for |
|---|---|
| SEO specialist | Intent read, real suggest-derived long-tails, clusters |
| Content strategist | Audience, funnel mapping, format fit |
| Content marketer | Ready-to-write briefs, titles, metadata |
| Agency team | Client-presentable strategy output in minutes |
| Founder / owner | "What should I publish first?" answered without hiring |

## 6. Real-world use cases

- **`photobooth jakarta`** (the brief's example) → Suggest harvest returns real Indonesian queries (`sewa photobooth jakarta`, `harga photobooth jakarta`, `photobooth murah jakarta`); rules flag `sewa`/`harga`/`murah` as transactional and `jakarta` as local; Nemotron classifies the mix as local-commercial with an informational fringe and clusters around pricing, event type, and vendor comparison; recommended play is a local service page plus a wedding-photobooth comparison guide.
- **`enterprise cloud migration roadmap`** → informational/commercial hybrid, B2B decision-maker audience, long-form cornerstone with a rollback-protocol angle no incumbent covers.
- **`jasa pembuatan website`** → high-commercial, agency-competitive, recommends a bottom-funnel pricing-transparency page over another listicle.

## 7. Agency-style thinking model

Four desks, run in sequence, each receiving the previous desk's validated output. The Search Desk is the only one that touches raw data; the rest reason over structured evidence.

| # | Desk | Role | Produces | Sign-off |
|---|---|---|---|---|
| 1 | **Search Desk** | SEO Strategist | Demand Read: harvested keyword universe, rule signals, intent mix, topic clusters, entities | *Strategist note* |
| 2 | **Planning Desk** | Content Strategist | Audience & Fit: personas, funnel map per cluster, format recommendations, portfolio order | *Planner note* |
| 3 | **Creative Desk** | Creative Director | Angle Room: 4–6 scored opportunities with hooks and SEO titles — **plus a Kill List** of ideas deliberately rejected and why | *Director note* |
| 4 | **Editorial Desk** | Content Lead / Editor | Production Brief: objective, metadata, outline, FAQs, internal links, assets, writer checklist | *Editor note* |

Desks 1–3 run on intake. Desk 4 runs on demand, for the one opportunity the user selects — that selection is the product's core interaction.

**The Kill List is the signature detail.** Agencies earn their fee by saying no. Showing rejected ideas with reasons is what separates this from an idea generator.

## 8. The staged pipeline (core technical requirement)

Ten stages. Four are deterministic, five are discrete AI calls, one is persistence. **No single giant prompt anywhere; no unstructured prose as a primary API response.**

| # | Stage | Kind | Module | Output |
|---|---|---|---|---|
| 0 | Normalize input | deterministic | `pipeline/normalize.ts` | trimmed, whitespace-collapsed, lowercased keyword + market + language |
| 1 | Harvest | **Google Suggest** | `pipeline/suggest.ts` | raw suggestions across ~10 seed expansions |
| 2 | Clean & dedupe | deterministic | `pipeline/dedupe.ts` | unique keywords with suggest rank + seed coverage |
| 3 | Rule signals | deterministic | `pipeline/rules.ts` | per-keyword intent hints from a modifier lexicon |
| 4 | Intent classification | **AI** (temp 0.1) | `ai/stages/intent.ts` | intent mix % + per-keyword intent, given rule signals as evidence |
| 5 | Topic clustering | **AI** (temp 0.3) | `ai/stages/clusters.ts` | 3–5 named clusters with members and themes |
| 6 | Audience & fit | **AI** (temp 0.3) | `ai/stages/planning.ts` | personas, funnel map, format fit |
| 7 | Opportunity cards | **AI** (temp 0.8) | `ai/stages/creative.ts` | 4–6 scored opportunities + Kill List |
| 8 | Content brief | **AI** (temp 0.4, on demand) | `ai/stages/brief.ts` | full production brief for the **selected** opportunity only |
| 9 | Validate · retry · persist | deterministic | `ai/run-stage.ts`, `db/` | zod at every boundary, one corrective retry, per-stage persistence |

Every stage returns a typed, schema-validated object. The API response model is always structured JSON shaped for the frontend — never prose.

### Google Suggest harvest (stage 1)

`https://suggestqueries.google.com/complete/search?client=firefox&q=…&hl={lang}&gl={country}` — keyless, server-side. Fired for ~10 seeds in parallel via `Promise.allSettled`: the base keyword plus locale-aware prefixes/suffixes (`how/what/best/price` for EN; `cara/apa/berapa/harga/sewa/terbaik` for ID). Yields 50–100 raw suggestions in about a second.

Partial failure is expected and handled: settled rejections are dropped, and only if *every* seed fails does the run fall back to AI expansion — with provenance downgraded to `ai_inferred` and a visible banner saying Suggest was unavailable. The run never dies because Google rate-limited one request.

### Honest metrics (stages 2–3)

No volume. No CPC. No keyword difficulty. No competitor traffic. Instead, two signals that are actually real, plus one that is transparently computed:

- **Suggest Rank** — the position Google returned the query at. Real ordering data.
- **Seed Coverage** — how many different seed expansions surfaced this keyword. Real breadth signal.
- **Demand Signal (MauScore)** — deterministic, documented, shown in a tooltip:

```
kwSignal        = clamp(100 − min(rank, 20) × 3 + min(coverage − 1, 3) × 5, 0, 100)
clusterDemand   = mean(kwSignal of members)
```

## 9. Provenance labeling

One `Source` enum threads through every schema, and one `<Provenance>` chip component renders it everywhere a value appears. A legend sits in the board header.

| Label | Colour | Meaning |
|---|---|---|
| `GOOGLE SUGGEST` | blue | Real query data returned by Google |
| `RULE` | slate | Deterministic lexicon/regex match, no model involved |
| `AI` | violet | Nemotron inference — judgment, not measurement |
| `MAUSCORE` | indigo | Internal formula computed in TypeScript, formula shown on hover |

This is a first-class product feature, not a disclaimer. It is the direct answer to "how do I know this isn't made up?", and it is what makes shipping without a paid SEO API a defensible design decision rather than a gap.

## 10. MVP feature recommendations

1. **Intake** — keyword + market/language + optional strategic lens (Local Service / B2B Demand / E-commerce / Thought Leadership).
2. **Live stage pipeline** — panels land one at a time as each stage finishes; the waiting state *is* the product story.
3. **Demand Read panel** — intent split bar, keyword universe table with per-row provenance, suggest rank and coverage columns, cluster cards.
4. **Audience & Fit panel** — persona cards, funnel map, format fit scores.
5. **Angle Room** — opportunity cards ranked by Opportunity Score, P0/P1/P2 priority, Kill List.
6. **Brief generation** — one click on the selected opportunity only.
7. **Brief view + export** — copy as Markdown / download `.md`.
8. **Library & history** — saved runs and briefs, shareable permalinks.

## 11. Feature prioritization

**Must-have (ships):** all ten pipeline stages, the three board panels, opportunity scoring, brief view, Markdown export, persistence + permalinks, library, provenance chips, loading/partial-failure/error states, seeded demo runs, README + blueprint, live deploy.

**Nice-to-have (only if time remains):** brief regeneration with a tone instruction, PDF export, cluster bubble chart, run comparison.

**Explicitly out:** auth, multi-user collaboration, real-time sync, teams/roles, billing, CMS push, paid SEO APIs. Listed in the README as deliberate scope boundaries.

## 12. User flow

```
Workspace Home
  └─ keyword + market + lens → "Analyze"
       └─ POST /api/runs          normalize → Suggest harvest → dedupe → rules → AI intent
            → redirect /w/[runId], Demand Read panel renders with provenance chips   (~12s)
       └─ POST stage "clusters"   AI clustering            → clusters render          (~10s)
       └─ POST stage "planning"   AI audience & fit        → Audience panel renders   (~10s)
       └─ POST stage "creative"   AI opportunities         → Angle Room renders       (~12s)
  └─ user picks ONE opportunity → "Generate Brief"
       └─ POST /api/briefs        AI brief for that opportunity only                  (~15s)
            → /brief/[briefId] — full brief, export, permalink
  └─ Briefs library lists everything ever produced
```

Reload-safe at every point: each stage persists the moment it returns; the board rehydrates from Postgres.

## 13. Information architecture

```
/                    Workspace Home — intake + recent runs + workspace metrics
/w/[runId]           Strategy Board — the full pipeline output for one keyword
/brief/[briefId]     Production Brief — writer-ready deliverable
/briefs              Brief Library
```

Sidebar nav: Workspace Home · Strategy Board (contextual) · Content Briefs · How It Works.

## 14. Screen structure

**Workspace Home** — fixed 240px sidebar; main column: intake card (keyword field, market select, lens chips, sample-keyword quick prompts), four-up metric row, recent-runs list.

**Strategy Board** — run header (keyword, market, status, provenance legend) → stage rail showing all stages and their state → stacked panels in stage order, each with a role badge and sign-off note → Angle Room grid.

**Production Brief** — header with export actions → numbered sections (01 Objective, 02 Strategic Specs, 03 Metadata & SERP preview, 04 Outline, 05 Internal Links & CTA, 06 Assets) → right rail with editor directives, writer checklist, E-E-A-T signals.

Implements the two provided Stitch screens as the design foundation: indigo/violet primary on off-white, numbered section chips, monospace IDs, soft-bordered cards, dense-but-calm metric rows.

## 15. AI implementation — how each stage works

One generic runner, five configurations. Each AI stage = `{ system prompt, user prompt builder, zod schema, temperature }`. `runStage()` calls 9router with `response_format: json_object`, parses with zod, and on validation failure retries **once** with the error appended to the prompt. Two failures → that stage is marked `failed` and the panel shows a retry button while every completed panel stays on screen. No streaming-JSON parser, no partial parsing.

- **Intent (0.1)** — receives the deduped keyword list *with its rule signals attached* and must classify the mix into shares summing to 100, citing evidence. The rules do the cheap, unambiguous work; the model resolves what rules can't.
- **Clusters (0.3)** — semantic grouping into 3–5 named clusters with themes.
- **Planning (0.3)** — reasons over clusters to derive personas, funnel stage per cluster, format fit 0–100.
- **Creative (0.8)** — divergent generation constrained by prior stages, with an explicit anti-generic rule ("if this hook would work for any competitor in this space, discard it") and a forced Kill List. The only stage that should be surprising.
- **Brief (0.4)** — long-form structured synthesis for one opportunity.

**Scores are the model's; the ranking is not.** The model emits `intentValue`, `differentiation`, `effort` (0–100). `demandSignal` comes from the deterministic Suggest formula in §8. TypeScript computes:

```
opportunityScore = 0.30·demandSignal   (MAUSCORE, from Suggest)
                 + 0.30·intentValue    (AI)
                 + 0.25·differentiation(AI)
                 + 0.15·(100 − effort) (AI)
```

Deterministic, auditable, shown in a tooltip on every card with each input's provenance chip. Thirty percent of the ranking is grounded in real Google data — and the tooltip says exactly which thirty.

## 16. 9router + Nemotron usage

`lib/ai/client.ts` is the `openai` SDK pointed at 9router's OpenAI-compatible endpoint — no bespoke HTTP wrapper.

```
NINEROUTER_BASE_URL   9router endpoint
NINEROUTER_API_KEY    key
MAUSEARCH_MODEL       Nemotron model id (primary reasoning model, all stages)
MAUSEARCH_MODEL_FAST  optional cheaper id for the intent stage
```

9router is the routing layer, so swapping or fallback-routing a model is an env change, never a code change. Without a key, `runStage()` returns fixtures from `lib/ai/fixtures/` — the repo clones and runs with zero credentials, which matters for whoever reviews it.

## 17. Frontend architecture

Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui. Server Components read Postgres directly for page loads; one client hook orchestrates the run. No global state library, no data-fetching library — sequential `fetch` calls in a `useState`-driven hook is the entire client complexity.

```
app/            page.tsx · w/[runId] · brief/[briefId] · briefs · api/*
components/     workspace/ · board/ · brief/ · ui/ · provenance.tsx
lib/pipeline/   normalize.ts · suggest.ts · dedupe.ts · rules.ts · score.ts
lib/ai/         client.ts · run-stage.ts · stages/{intent,clusters,planning,creative,brief}.ts · fixtures/
lib/            schema.ts · markdown.ts · db/{schema,index}.ts
```

## 18. Backend / API architecture

Route Handlers, `maxDuration = 60`, **at most one LLM call per request** — deliberately avoids streaming infrastructure while keeping every request far inside the serverless timeout.

| Route | Method | Does |
|---|---|---|
| `/api/runs` | POST | Stages 0–4: normalize, harvest, dedupe, rules, AI intent. Persist. Return run |
| `/api/runs/[id]/stages` | POST | Body `{stage: "clusters"\|"planning"\|"creative"}` — execute, persist, return that stage |
| `/api/briefs` | POST | `{runId, opportunityId}` → brief stage for that one opportunity. Persist. Return brief |

Reads are Server Components, not API routes. Inputs zod-validated at the boundary. Keyword normalized for cache lookup — an identical keyword+market within 7 days offers the existing run instead of re-billing the model and re-hitting Google.

**Schema (2 tables, Drizzle):**
```
runs   id · keyword · normalized_keyword · market · language · lens · status
       suggest_status · keywords jsonb · intent jsonb · clusters jsonb
       audience_fit jsonb · angles jsonb · stage_errors jsonb · created_at
briefs id · run_id → runs · opportunity_id · title · payload jsonb · created_at
```

Stage payloads as `jsonb` because they are documents, not relations — normalizing them is three hours of migration work for zero query benefit.

## 19. Data flow

```
keyword
  ─▶ normalize            (deterministic)
  ─▶ Google Suggest ×10   (real data, Promise.allSettled)
  ─▶ clean + dedupe       → rank + coverage      [GOOGLE SUGGEST]
  ─▶ rule lexicon         → intent hints         [RULE]
  ─▶ AI intent      ← keywords + rule hints      [AI]        → runs.intent
  ─▶ AI clusters    ← keywords + intent          [AI]        → runs.clusters
  ─▶ AI planning    ← clusters                   [AI]        → runs.audience_fit
  ─▶ AI creative    ← all above                  [AI]        → runs.angles
  ─▶ score()        ← suggest signals + AI dims  [MAUSCORE]  → ranked
  ─▶ AI brief       ← selected opportunity       [AI]        → briefs.payload
  ─▶ Markdown export
```

## 20. UI/UX direction

Premium SaaS calm. Off-white `#FAFAFB` ground, white cards with `#E8E8EF` hairline borders, indigo `#4F46E5` primary, violet accent, one green for positive delta, one amber for risk, plus the four provenance colours. Inter for text, JetBrains Mono for IDs and scores. No neon, no gradients, no glow, no chat bubbles, no typewriter effect. Generous whitespace; density only inside data tables. Every panel carries a role badge (`SEO STRATEGIST`) and its sign-off note in italic — that attribution is what sells "agency" over "AI output".

## 21. Naming

| Concept | Name |
|---|---|
| A submitted keyword | **Intake** |
| The analysis session | **Run** |
| Harvested keyword set | **Keyword Universe** |
| Stage 1–5 output | **Demand Read** |
| Stage 6 output | **Audience & Fit** |
| Stage 7 output | **Angle Room** |
| Rejected ideas | **Kill List** |
| A scored idea | **Opportunity** |
| Ranking metric | **Opportunity Score** |
| Stage 8 output | **Production Brief** |
| The whole chain | **The Desk Pipeline** |

## 22. Loading, empty, error states

- **Loading** — never a bare spinner. The stage rail names the working stage, its role, and what it's doing right now ("Harvesting Google Suggest across 10 seed expansions"); completed stages collapse into checkmarks. Skeletons shaped like the panel that's coming.
- **Empty (home)** — intake card plus three sample keywords that open instantly from seeded data.
- **Empty (library)** — "No briefs yet. Every brief starts as an intake." + CTA.
- **Partial Suggest failure** — silent; settled rejections are dropped and the run proceeds on whatever returned.
- **Total Suggest failure** — amber banner: "Google Suggest unavailable — keyword universe is AI-expanded for this run", and every affected row's chip flips from `GOOGLE SUGGEST` to `AI`.
- **Stage error** — the failed stage shows inline with a retry button; completed panels stay. A failed stage never destroys a run.
- **Missing key** — dismissible banner: "Running on sample data — add `NINEROUTER_API_KEY` for live analysis."
- **Slow stage** — after 20s the rail swaps in a line about what that stage is reasoning over, rather than sitting silent.

## 23. Deployment

Vercel (Next.js native, preview URL per push) + Neon Postgres (serverless driver, nothing to pool). `drizzle-kit push` for schema, seed script for demo runs. Public GitHub repo with README, blueprint, screenshots, `.env.example`, one-command local setup.

## 24. Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Google rate-limits Suggest from Vercel IPs | `Promise.allSettled` tolerates partials; total failure falls back to AI expansion with downgraded provenance + banner; results cached per keyword |
| 4 sequential AI calls ≈ 45s | Split across stages so panels land progressively; brief is on-demand; seeded runs make the demo instant |
| Model emits invalid JSON | zod + one corrective retry + per-stage failure isolation |
| 9router behaves unexpectedly | OpenAI-compatible client, model/URL in env, fixture fallback |
| Vercel 60s timeout | One LLM call per request, never four |
| Neon cold start | Seeded data on the demo path |
| Scope creep | Auth/collab/paid APIs/PDF explicitly cut and stated in the README — a declared boundary reads as judgment, silence reads as omission |

## 25. Demo strategy

90 seconds: open the seeded `photobooth jakarta` board → point at the provenance legend ("this column is real Google data, this one is the model's judgment, nothing here is an invented volume number") → the intent split and local read → the Kill List ("this is what a strategist says no to") → open the recommended opportunity's brief → export Markdown. Then run one live keyword from scratch, narrating each stage as it lands. The README leads with the same story and a GIF.

## 26. Final product direction

MauSearch wins on *attribution and refusal*. Any competent build can emit keywords and an outline from one prompt. What makes this read as an agency workspace is that every output is signed by the role that produced it, every number is labeled with whether it was measured or inferred, opportunities rank by a formula the user can inspect, and the product shows what it decided **not** to do. Role attribution, provenance labeling, transparent scoring, and the Kill List — all four are cheap to build and together they are the entire differentiator.
