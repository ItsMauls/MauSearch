# MauSearch

**An AI-powered, agency-style content planning workspace.** A keyword goes in as an intake brief. A strategy comes out — evidenced, prioritized, and ready to hand to a writer.

Not a keyword tool. Not a chatbot. Not a text generator. MauSearch runs a keyword through a simulated content agency: real Google Suggest data is harvested, deterministic rules extract intent signals, then four specialist desks reason over that evidence in sequence — each building on the last desk's structured output, each signing off with a note.

---

## What makes it different

Any competent build can emit keywords and an outline from one prompt. Three things make this read as an agency rather than an idea generator:

### 1. Every value is labelled with where it came from

| Chip | Meaning |
| --- | --- |
| `GOOGLE SUGGEST` | Real query data returned by Google, including its ranking position |
| `RULE` | A deterministic lexicon match made in code, before any model ran |
| `AI` | Nemotron's judgment — reasoning over the evidence, never a measurement |
| `MAUSCORE` | Computed in TypeScript from a formula printed on the page |

There is **no search volume, CPC, keyword difficulty, or competitor traffic anywhere in this product.** MauSearch has no source for those, so it does not display them — not as an estimate, not with a disclaimer, not at all. A confident fabricated number is worse than an absent one, because you would plan around it.

What it shows instead is observed: **Suggest rank** (the position Google returned a query at) and **seed coverage** (how many expansions surfaced it).

### 2. The model scores; TypeScript ranks

The Creative Desk scores three dimensions it genuinely judges well. It never produces the ranking:

```
Opportunity Score = 0.30 × demand signal   (Google Suggest — measured)
                  + 0.30 × intent value    (AI)
                  + 0.25 × differentiation (AI)
                  + 0.15 × (100 − effort)  (AI)
```

LLMs are inconsistent at arithmetic across a list, and "why is this one first?" deserves an auditable answer. Thirty percent of every ranking is grounded in real Google data, and each opportunity card shows exactly which thirty.

### 3. It says what it refused to make

Every run produces a **Kill List** — ideas the Creative Desk rejected, with reasons. Agencies earn their fee by saying no.

---

## The pipeline

Ten stages. Four deterministic, five discrete model calls, one persistence step. **No single giant prompt, and no unstructured prose as an API response** — every stage returns a typed, schema-validated document.

```
keyword
  ├─ 00  normalize                                      deterministic
  ├─ 01  harvest ~10 Google Suggest seeds in parallel   REAL DATA
  ├─ 02  clean, dedupe, rank, seed coverage             deterministic
  ├─ 03  bilingual intent lexicon                       deterministic
  ├─ 04  intent classification      temp 0.1   ─┐       Search Desk
  ├─ 05  topic clustering           temp 0.3   ─┤       Search Desk
  ├─ 06  audience & fit             temp 0.3   ─┤       Planning Desk
  ├─ 07  opportunity cards          temp 0.8   ─┤       Creative Desk
  ├─ 08  content brief (on demand)  temp 0.4   ─┘       Editorial Desk
  └─ 09  validate · retry · persist                     zod + Postgres
```

Each stage consumes only the validated output of the stages before it. That keeps prompts small, makes every step independently retryable, and means a failure degrades **one panel** rather than the whole run.

The deterministic layer does real work: on a typical run around a third of harvested queries are intent-classified by lexicon before a model is ever called, and those labels are handed to the model as evidence it must either accept or explicitly overrule — the board shows every override with its reason.

### Why one desk per invocation, driven from the server

Every invocation makes **at most one model call**, and the page is not what drives them. A request claims the run with an atomic compare-and-set, hands the next desk to a background worker, and answers immediately; that worker runs its desk, persists it, and hands the rest to a fresh invocation. So analysing three keywords means starting three runs and closing the tab — they finish without you.

It also makes duplicates impossible: a reload, a second tab or an impatient retry all try the same claim, and the one already working keeps it. A free-tier desk can take three minutes, which is exactly how long the old browser-driven version had to be wrong for a run to double up on paid calls and then time out.

No SSE, no streaming-JSON parser, no queue service — each desk returns one complete document, and the board polls a state endpoint that doubles as the relay's hand-over.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

**It runs with zero credentials.** With no `AI_API_KEY` the desks return committed fixtures — a full `photobooth jakarta` analysis built from genuinely harvested data — so you can clone this and see the whole product before going looking for keys. Google Suggest harvesting stays live either way; it needs no key.

```bash
npm run check        # 32 assertions: pipeline, scoring, fixture integrity
npm run seed         # seed the demo run + brief
npm run db:push      # push schema to Neon (needs DATABASE_URL)
npm run build
```

Copy `.env.example` to `.env.local` for live runs:

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Router API key. Absent → fixtures. |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` or `https://api.9router.com/v1` |
| `AI_MODEL` | Nemotron model id, used by all five stages |
| `AI_MODEL_FAST` | Optional cheaper route for the intent stage |
| `AI_SITE_URL` | OpenRouter attribution header; ignored elsewhere |
| `DATABASE_URL` | Neon Postgres. **Required in production** — see Known limits. |

---

## Architecture

```
app/
  page.tsx                      Workspace Home — intake, metrics, recent runs
  w/[runId]/                    Strategy Board — the four desks' output
  brief/[briefId]/              Production Brief — writer-ready deliverable
  briefs/                       Brief library
  how-it-works/                 The pipeline, documented in-product
  api/runs/                     POST: stages 0–4
  api/runs/[id]/stages/         POST: advance one desk
  api/briefs/                   POST: brief for one selected opportunity

lib/pipeline/                   The deterministic half — no model imports
  normalize · suggest · dedupe · rules · score
lib/ai/
  client.ts                     OpenAI SDK pointed at a router
  run-stage.ts                  One runner: prompt → JSON → zod → 1 retry
  stages/                       Five stage configs (persona, temp, schema)
  fixtures/                     Committed demo run, real harvested data
lib/schema.ts                   Every contract, provenance threaded through
lib/view.ts                     The frontend-friendly response model
lib/db/                         Drizzle + Neon, with an in-memory fallback
scripts/check.mts               The self-check
```

**Frontend** — Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. Server Components read Postgres directly; one client hook drives the run. No state library, no data-fetching library, no component library — the design is custom enough that a component kit would have been overridden into unrecognisability.

**AI** — the model layer binds to a protocol, not a vendor. 9router and OpenRouter are both OpenAI-compatible, so the official SDK pointed at a different `AI_BASE_URL` is the entire integration — moving between routers, or swapping the model behind one, is an environment change and no code change. One generic `runStage()` runner serves all five stages; nothing else in the codebase talks to the model.

**Reliability** — Every model response is zod-validated. A schema failure gets exactly one corrective retry with the validation error fed back into the prompt; a second failure marks that stage failed and records the reason. Suggest harvesting uses `Promise.allSettled`, so a rate-limited seed contributes nothing and the run continues — only a *total* outage falls back to AI expansion, and then every affected row's chip flips from `SUGGEST` to `AI` behind a banner saying so.

**Cost control** — An identical keyword + market inside a 7-day window reuses the existing run instead of re-billing the model and re-hitting Google. Brief generation is idempotent per opportunity, so a double-click doesn't pay twice. Briefs are written only for the opportunity you select.

---

## Deliberately out of scope

Stated rather than silently omitted, because a declared boundary is a decision and silence is an oversight:

- **Auth, teams, collaboration, real-time sync** — a day of work that demonstrates nothing this project is judged on.
- **Paid SEO APIs** (DataForSEO, Semrush) — they would add real volume data, but the provenance system is the more interesting answer to the same problem, and the integration seam is clean if that changes.
- **Live SERP scraping** — flaky on serverless, and Suggest already provides observed data.
- **PDF export** — Markdown pastes into Notion, Docs and every CMS that matters.
- **CMS push** — a day of OAuth for a feature nobody asked for.

## Known limits

- The in-memory store is single-process and non-durable — it exists so the repo runs credential-free locally. **A serverless deployment needs `DATABASE_URL`**: each invocation is a fresh process, so without Postgres a created run would not be found by the request that renders it.
- **The default `AI_MODEL` is a free OpenRouter tier**, and measured under real load a single stage typically takes 25–55 seconds, occasionally longer under queue pressure — comfortably past a typical serverless budget once four stages run in sequence. Route handlers declare `maxDuration = 300` to give it the most room a platform will realistically allow, and the UI says plainly when a free-tier model is configured so a long wait doesn't read as a hang. A paid tier such as `nvidia/nemotron-3-nano-30b-a3b` costs about $0.01 for a full run and responds in single-digit seconds — swap `AI_MODEL` (and fund the OpenRouter account) if reliability matters more than the free tier's price.
- Google rate-limits aggressive parallel Suggest calls — runs typically land 6–10 of 10 seeds, which is why partial failure is designed for rather than treated as an error.
- Fixture mode always returns the `photobooth jakarta` analysis regardless of the keyword entered. That is what "sample data" means, and the UI says so in a banner.

---

Full product blueprint: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)

Built with Next.js, Nemotron via an OpenAI-compatible router (OpenRouter or 9router), Neon, and Google Suggest.
