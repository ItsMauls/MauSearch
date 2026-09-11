import { integer, jsonb, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import {
  BriefStage,
  ClustersStage,
  CreativeStage,
  HarvestedKeyword,
  IntentStage,
  PlanningStage,
  StageErrors,
  SuggestStatus,
} from "@/lib/schema";

/**
 * Two tables. Stage outputs live in jsonb because they are documents, not
 * relations - we never query inside them, we render them whole. Normalising
 * them would buy nothing and cost a migration per schema tweak.
 */
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    slug: text("slug"),
    keyword: text("keyword").notNull(),
    normalizedKeyword: text("normalized_keyword").notNull(),
    market: text("market").notNull(),
    language: text("language").notNull(),
    lens: text("lens").notNull(),

    // Real Suggest harvest (stages 1-3), plus how much of it actually returned.
    suggestStatus: text("suggest_status").$type<SuggestStatus>().notNull(),
    seedsAttempted: integer("seeds_attempted").notNull().default(0),
    seedsSucceeded: integer("seeds_succeeded").notNull().default(0),
    keywords: jsonb("keywords").$type<HarvestedKeyword[]>().notNull(),

    // AI stages, each written the moment it returns so a reload never loses work.
    intent: jsonb("intent").$type<IntentStage>(),
    clusters: jsonb("clusters").$type<ClustersStage>(),
    audienceFit: jsonb("audience_fit").$type<PlanningStage>(),
    angles: jsonb("angles").$type<CreativeStage>(),

    /** Per-stage failures. One failed stage never invalidates the others. */
    stageErrors: jsonb("stage_errors").$type<StageErrors>().notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Supports the "already analysed recently?" lookup that avoids re-billing
    // the model and re-hitting Google for an identical intake.
    index("runs_lookup_idx").on(table.normalizedKeyword, table.market, table.createdAt),
    index("runs_slug_idx").on(table.slug),
  ]
);

export const briefs = pgTable("briefs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull(),
  title: text("title").notNull(),
  keyword: text("keyword").notNull(),
  market: text("market").notNull(),
  payload: jsonb("payload").$type<BriefStage>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RunRow = typeof runs.$inferSelect;
export type BriefRow = typeof briefs.$inferSelect;
