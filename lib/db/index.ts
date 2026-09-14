import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { briefs, BriefRow, runs, RunRow } from "./schema";

/**
 * Postgres when DATABASE_URL is set, an in-process map when it is not.
 *
 * The fallback exists so this repo can be cloned and run with zero credentials -
 * the same reason the AI layer ships fixtures. It is genuinely single-process
 * and non-durable, so it is for local review only; production always has Neon.
 */
const DATABASE_URL = process.env.DATABASE_URL;
export const hasDatabase = (): boolean => Boolean(DATABASE_URL);

const db = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema: { runs, briefs } }) : null;

/** Short, URL-safe, collision-resistant enough for shareable permalinks. */
export const newId = (): string => randomBytes(9).toString("base64url");

/**
 * Held on globalThis, not in module scope: Next bundles route handlers and
 * Server Components separately, so a plain module-level Map gives each bundle
 * its own copy - a run written by the API would be invisible to the page that
 * renders it. Also survives dev hot reloads.
 */
const globalMemory = globalThis as typeof globalThis & {
  __mausearch?: { runs: Map<string, RunRow>; briefs: Map<string, BriefRow> };
};
const memory = (globalMemory.__mausearch ??= {
  runs: new Map<string, RunRow>(),
  briefs: new Map<string, BriefRow>(),
});

const byNewest = <T extends { createdAt: Date }>(rows: T[]) =>
  [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

// --- runs -------------------------------------------------------------------

export async function insertRun(row: RunRow): Promise<RunRow> {
  if (!db) {
    memory.runs.set(row.id, row);
    return row;
  }
  await db.insert(runs).values(row);
  return row;
}

/** `idOrSlug` matches either the id (old bookmarks) or the readable slug (new links). */
export async function getRun(idOrSlug: string): Promise<RunRow | null> {
  if (!db) {
    return (
      memory.runs.get(idOrSlug) ??
      [...memory.runs.values()].find((r) => r.slug === idOrSlug) ??
      null
    );
  }
  const [row] = await db
    .select()
    .from(runs)
    .where(or(eq(runs.id, idOrSlug), eq(runs.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

export async function getRunBySlug(slug: string): Promise<RunRow | null> {
  if (!db) return [...memory.runs.values()].find((r) => r.slug === slug) ?? null;
  const [row] = await db.select().from(runs).where(eq(runs.slug, slug)).limit(1);
  return row ?? null;
}

/** Patches one stage's result (or its error) onto a run. */
export async function updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
  if (!db) {
    const existing = memory.runs.get(id);
    if (existing) memory.runs.set(id, { ...existing, ...patch });
    return;
  }
  await db.update(runs).set(patch).where(eq(runs.id, id));
}

/**
 * Atomic compare-and-set on the run's worker lock: stamps `stageStartedAt` with
 * now and returns the row only if nobody holds the lock, or the holder's last
 * heartbeat is older than `staleBefore` (a worker the platform killed).
 *
 * This is the whole defence against a desk running twice. A reload, a second
 * tab and a retry all issue the same claim; exactly one wins and the rest just
 * watch. It has to be one statement - read-then-write lets two requests both
 * see a free lock.
 */
export async function claimRun(id: string, staleBefore: Date): Promise<RunRow | null> {
  const now = new Date();
  if (!db) {
    const existing = memory.runs.get(id);
    if (!existing) return null;
    if (existing.stageStartedAt && existing.stageStartedAt > staleBefore) return null;
    const claimed = { ...existing, stageStartedAt: now };
    memory.runs.set(id, claimed);
    return claimed;
  }
  const [row] = await db
    .update(runs)
    .set({ stageStartedAt: now })
    .where(
      and(eq(runs.id, id), or(isNull(runs.stageStartedAt), lt(runs.stageStartedAt, staleBefore)))
    )
    .returning();
  return row ?? null;
}

export async function deleteRun(id: string): Promise<void> {
  if (!db) {
    memory.runs.delete(id);
    return;
  }
  await db.delete(runs).where(eq(runs.id, id));
}

export async function listRuns(limit = 12): Promise<RunRow[]> {
  if (!db) return byNewest([...memory.runs.values()]).slice(0, limit);
  return db.select().from(runs).orderBy(desc(runs.createdAt)).limit(limit);
}

const CACHE_WINDOW_DAYS = 7;

/**
 * An identical intake inside the cache window reuses the existing run rather
 * than re-billing the model and re-hitting Google for the same answer.
 */
export async function findRecentRun(
  normalizedKeyword: string,
  market: string
): Promise<RunRow | null> {
  const cutoff = new Date(Date.now() - CACHE_WINDOW_DAYS * 86_400_000);
  if (!db) {
    return (
      byNewest([...memory.runs.values()]).find(
        (r) =>
          r.normalizedKeyword === normalizedKeyword && r.market === market && r.createdAt > cutoff
      ) ?? null
    );
  }
  const [row] = await db
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.normalizedKeyword, normalizedKeyword),
        eq(runs.market, market),
        gt(runs.createdAt, cutoff)
      )
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);
  return row ?? null;
}

// --- briefs -----------------------------------------------------------------

export async function insertBrief(row: BriefRow): Promise<BriefRow> {
  if (!db) {
    memory.briefs.set(row.id, row);
    return row;
  }
  await db.insert(briefs).values(row);
  return row;
}

export async function getBrief(id: string): Promise<BriefRow | null> {
  if (!db) return memory.briefs.get(id) ?? null;
  const [row] = await db.select().from(briefs).where(eq(briefs.id, id)).limit(1);
  return row ?? null;
}

export async function listBriefs(limit = 50): Promise<BriefRow[]> {
  if (!db) return byNewest([...memory.briefs.values()]).slice(0, limit);
  return db.select().from(briefs).orderBy(desc(briefs.createdAt)).limit(limit);
}

/** Briefs don't store `lens` (it's a property of the run that spawned them), so this joins it in. */
export async function listBriefsWithLens(limit = 50): Promise<(BriefRow & { lens: string })[]> {
  if (!db) {
    return byNewest([...memory.briefs.values()])
      .slice(0, limit)
      .map((b) => ({ ...b, lens: memory.runs.get(b.runId)?.lens ?? "" }));
  }
  const rows = await db
    .select({ brief: briefs, lens: runs.lens })
    .from(briefs)
    .leftJoin(runs, eq(briefs.runId, runs.id))
    .orderBy(desc(briefs.createdAt))
    .limit(limit);
  return rows.map(({ brief, lens }) => ({ ...brief, lens: lens ?? "" }));
}

/** opportunityIds that already have a brief for this run, so the board can offer "Generate again" instead of "Generate". */
export async function listBriefedOpportunityIds(runId: string): Promise<string[]> {
  if (!db) {
    return [...memory.briefs.values()].filter((b) => b.runId === runId).map((b) => b.opportunityId);
  }
  const rows = await db.select({ opportunityId: briefs.opportunityId }).from(briefs).where(eq(briefs.runId, runId));
  return rows.map((r) => r.opportunityId);
}

export async function findBriefForOpportunity(
  runId: string,
  opportunityId: string
): Promise<BriefRow | null> {
  if (!db) {
    return (
      [...memory.briefs.values()].find(
        (b) => b.runId === runId && b.opportunityId === opportunityId
      ) ?? null
    );
  }
  const [row] = await db
    .select()
    .from(briefs)
    .where(and(eq(briefs.runId, runId), eq(briefs.opportunityId, opportunityId)))
    .limit(1);
  return row ?? null;
}

export { runs, briefs };
export type { RunRow, BriefRow };
