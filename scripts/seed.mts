/**
 * Seeds the committed photobooth jakarta demo: a complete four-desk run built
 * from real harvested Suggest data, plus the brief for its top opportunity.
 *
 * Run against production so the demo path never depends on live model latency
 * or a cold Neon connection.
 *
 *   npx tsx scripts/seed.mts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const { insertRun, insertBrief, newId, hasDatabase, findRecentRun } = await import("@/lib/db");
const { rankOpportunities } = await import("@/lib/pipeline/score");
const { applyKeywordIntents } = await import("@/lib/view");
const { HarvestResult } = await import("@/lib/schema");
const { slugify } = await import("@/lib/slug");

const harvest = HarvestResult.parse((await import("@/lib/ai/fixtures/harvest.json")).default);
const intent = (await import("@/lib/ai/stages/intent")).intentStage.fixture;
const clusters = (await import("@/lib/ai/stages/clusters")).clustersStage.fixture;
const planning = (await import("@/lib/ai/stages/planning")).planningStage.fixture;
const angles = (await import("@/lib/ai/stages/creative")).creativeStage.fixture;
const brief = (await import("@/lib/ai/stages/brief")).briefStage.fixture;

console.log(`storage: ${hasDatabase() ? "Neon Postgres" : "in-memory (set DATABASE_URL to persist)"}`);

const existing = await findRecentRun("photobooth jakarta", "ID");
if (existing) {
  console.log(`already seeded: /w/${existing.id} - nothing to do`);
  process.exit(0);
}

const runId = newId();
await insertRun({
  id: runId,
  slug: slugify("photobooth jakarta"),
  keyword: "photobooth jakarta",
  normalizedKeyword: "photobooth jakarta",
  market: "ID",
  language: "id",
  lens: "local_service",
  suggestStatus: harvest.status,
  seedsAttempted: harvest.seedsAttempted,
  seedsSucceeded: harvest.seedsSucceeded,
  keywords: applyKeywordIntents(harvest.keywords, intent.keywordIntents),
  intent,
  clusters,
  audienceFit: planning,
  angles,
  stageErrors: {},
  stageAttempts: {},
  stageStartedAt: null,
  createdAt: new Date(),
});

const top = rankOpportunities(angles.opportunities, clusters.clusters, harvest.keywords)[0];
const briefId = newId();
await insertBrief({
  id: briefId,
  runId,
  opportunityId: top.id,
  title: brief.workingTitle,
  keyword: "photobooth jakarta",
  market: "ID",
  payload: brief,
  createdAt: new Date(),
});

console.log(`seeded run    /w/${runId}`);
console.log(`seeded brief  /brief/${briefId}`);
console.log(`top opportunity: ${top.id} scored ${top.opportunityScore} (${top.priority})`);
