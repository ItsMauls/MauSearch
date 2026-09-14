import { z } from "zod";

/**
 * Every value MauSearch shows carries a provenance label. This is the product's
 * central honesty guarantee: measured data and model judgment never share a chip.
 *
 *   google_suggest - real queries returned by Google's suggest endpoint
 *   rule           - deterministic lexicon match, no model involved
 *   ai             - Nemotron inference (judgment, never measurement)
 *   mauscore       - computed in TypeScript from a formula we show the user
 *
 * Deliberately absent: search volume, CPC, keyword difficulty, competitor
 * traffic. We have no source for those, so we do not display them at all.
 */
export const Source = z.enum(["google_suggest", "rule", "ai", "mauscore"]);
export type Source = z.infer<typeof Source>;

export const Intent = z.enum([
  "informational",
  "commercial",
  "transactional",
  "navigational",
  "local",
]);
export type Intent = z.infer<typeof Intent>;

export const FunnelStage = z.enum(["TOFU", "MOFU", "BOFU"]);
export type FunnelStage = z.infer<typeof FunnelStage>;

export const Effort = z.enum(["low", "medium", "high"]);

// ---------------------------------------------------------------------------
// Stage 0 - normalized intake
// ---------------------------------------------------------------------------

export const MARKETS = {
  ID: { label: "Indonesia", language: "id", country: "ID" },
  US: { label: "United States", language: "en", country: "US" },
  GB: { label: "United Kingdom", language: "en", country: "GB" },
  SG: { label: "Singapore", language: "en", country: "SG" },
  MY: { label: "Malaysia", language: "ms", country: "MY" },
} as const;
export type MarketCode = keyof typeof MARKETS;

export const LENSES = {
  general: "General",
  local_service: "Local Service",
  b2b_demand: "B2B Demand",
  ecommerce: "E-commerce",
  thought_leadership: "Thought Leadership",
} as const;
export type Lens = keyof typeof LENSES;

export const IntakeInput = z.object({
  keyword: z.string().trim().min(2).max(80),
  market: z.enum(Object.keys(MARKETS) as [MarketCode, ...MarketCode[]]).default("ID"),
  lens: z.enum(Object.keys(LENSES) as [Lens, ...Lens[]]).default("general"),
});
export type IntakeInput = z.infer<typeof IntakeInput>;

export const NormalizedIntake = z.object({
  keyword: z.string(),
  normalized: z.string(),
  market: z.string(),
  language: z.string(),
  country: z.string(),
  lens: z.string(),
});
export type NormalizedIntake = z.infer<typeof NormalizedIntake>;

// ---------------------------------------------------------------------------
// Stages 1-3 - harvest, dedupe, rule signals (all deterministic)
// ---------------------------------------------------------------------------

export const HarvestedKeyword = z.object({
  keyword: z.string(),
  /** Best (lowest) position Google returned this query at, across all seeds. */
  rank: z.number().int().min(0),
  /** How many distinct seed expansions surfaced this query. */
  coverage: z.number().int().min(1),
  seeds: z.array(z.string()),
  /** MAUSCORE - see demandSignal() in lib/pipeline/score.ts */
  demandSignal: z.number().min(0).max(100),
  /** RULE - null when no lexicon modifier matched. */
  ruleIntent: Intent.nullable(),
  ruleMatches: z.array(z.string()),
  /** AI - filled by the intent stage, which may override an absent rule. */
  aiIntent: Intent.nullable().default(null),
  source: Source,
});
export type HarvestedKeyword = z.infer<typeof HarvestedKeyword>;

export const SuggestStatus = z.enum(["ok", "partial", "unavailable"]);
export type SuggestStatus = z.infer<typeof SuggestStatus>;

export const HarvestResult = z.object({
  keywords: z.array(HarvestedKeyword),
  status: SuggestStatus,
  seedsAttempted: z.number().int(),
  seedsSucceeded: z.number().int(),
});
export type HarvestResult = z.infer<typeof HarvestResult>;

// ---------------------------------------------------------------------------
// Stage 4 - intent classification (AI, temp 0.1)
// ---------------------------------------------------------------------------

export const IntentStage = z.object({
  primary: Intent,
  mix: z
    .array(
      z.object({
        type: Intent,
        share: z.number().min(0).max(100),
        evidence: z.string(),
      })
    )
    .min(1)
    .max(5),
  serpArchetype: z.string(),
  expectedSerpFeatures: z.array(z.string()).max(8),
  /** Where the model's read diverged from the rule lexicon, and why. */
  ruleDisagreements: z.array(
    z.object({ keyword: z.string(), ruleSaid: z.string(), modelSays: Intent, why: z.string() })
  ),
  keywordIntents: z.array(z.object({ keyword: z.string(), intent: Intent })),
  confidence: z.number().min(0).max(1),
  strategistNote: z.string(),
});
export type IntentStage = z.infer<typeof IntentStage>;

// ---------------------------------------------------------------------------
// Stage 5 - topic clustering (AI, temp 0.3)
// ---------------------------------------------------------------------------

export const ClustersStage = z.object({
  clusters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        theme: z.string(),
        members: z.array(z.string()).min(1),
        dominantIntent: Intent,
        funnelStage: FunnelStage,
        note: z.string(),
      })
    )
    .min(1)
    .max(6),
  entities: z.array(z.string()).max(20),
  coverageGaps: z.array(z.string()).max(6),
});
export type ClustersStage = z.infer<typeof ClustersStage>;

// ---------------------------------------------------------------------------
// Stage 6 - audience & fit (AI, temp 0.3)
// ---------------------------------------------------------------------------

export const PlanningStage = z.object({
  audiences: z
    .array(
      z.object({
        persona: z.string(),
        role: z.string(),
        jobToBeDone: z.string(),
        painPoints: z.array(z.string()).max(5),
        objections: z.array(z.string()).max(5),
        decisionTrigger: z.string(),
      })
    )
    .min(1)
    .max(3),
  funnelMap: z.array(
    z.object({
      clusterId: z.string(),
      stage: FunnelStage,
      goal: z.string(),
      contentFormat: z.string(),
      whyThisFormat: z.string(),
    })
  ),
  formatFit: z
    .array(
      z.object({
        format: z.string(),
        fitScore: z.number().min(0).max(100),
        bestForClusterIds: z.array(z.string()),
        effort: Effort,
      })
    )
    .max(6),
  contentGoals: z.object({
    primary: z.string(),
    secondary: z.string(),
    successMetric: z.string(),
  }),
  portfolioAdvice: z.string(),
  plannerNote: z.string(),
});
export type PlanningStage = z.infer<typeof PlanningStage>;

// ---------------------------------------------------------------------------
// Stage 7 - opportunity cards + kill list (AI, temp 0.8)
// ---------------------------------------------------------------------------

export const Opportunity = z.object({
  id: z.string(),
  title: z.string(),
  clusterId: z.string(),
  funnelStage: FunnelStage,
  format: z.string(),
  angle: z.object({
    framing: z.string(),
    hook: z.string(),
    contrarianTake: z.string(),
    whyNotGeneric: z.string(),
  }),
  targetKeyword: z.string(),
  supportingKeywords: z.array(z.string()).max(5),
  audience: z.string(),
  promise: z.string(),
  proofRequired: z.array(z.string()).max(3),
  /**
   * AI judgment on three dimensions only. The fourth input to the ranking
   * (demandSignal) comes from real Suggest data, and the model never sees or
   * produces the final score - scoreOpportunity() computes it in TypeScript.
   */
  signals: z.object({
    intentValue: z.number().min(0).max(100),
    differentiation: z.number().min(0).max(100),
    effort: z.number().min(0).max(100),
  }),
  seoTitles: z.array(z.object({ title: z.string(), rationale: z.string() })).min(2).max(3),
  riskIfIgnored: z.string(),
});
export type Opportunity = z.infer<typeof Opportunity>;

export const CreativeStage = z.object({
  opportunities: z.array(Opportunity).min(3).max(4),
  /** Agencies earn their fee by saying no. This is what the desk rejected. */
  killList: z.array(z.object({ idea: z.string(), whyKilled: z.string() })).min(2).max(3),
  directorNote: z.string(),
});
export type CreativeStage = z.infer<typeof CreativeStage>;

/** Opportunity + the deterministic half of the ranking. Never model-produced. */
export type ScoredOpportunity = Opportunity & {
  demandSignal: number;
  opportunityScore: number;
  priority: "P0" | "P1" | "P2";
};

// ---------------------------------------------------------------------------
// Stage 8 - production brief (AI, temp 0.4, on demand, one opportunity only)
// ---------------------------------------------------------------------------

export const BriefStage = z.object({
  workingTitle: z.string(),
  slug: z.string(),
  contentType: z.string(),
  wordCount: z.object({ min: z.number().int(), max: z.number().int() }),
  objective: z.object({
    businessGoal: z.string(),
    readerOutcome: z.string(),
    primaryCTA: z.string(),
    conversionPath: z.string(),
  }),
  editorialDirective: z.object({
    mandatedHook: z.string(),
    toneAndVoice: z.array(z.string()).max(5),
    mustAvoid: z.array(z.string()).max(5),
    differentiationRule: z.string(),
  }),
  metadata: z.object({
    h1: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
  }),
  outline: z
    .array(
      z.object({
        h2: z.string(),
        purpose: z.string().catch(""),
        estWords: z.number().int(),
        talkingPoints: z.array(z.string()).max(6),
        h3s: z.array(z.string()).max(5).catch([]),
        mandatoryAsset: z.string().nullable().default(null).catch(null),
      })
    )
    .min(4)
    .max(9),
  faq: z.array(z.object({ question: z.string(), answerDirection: z.string() })).max(6),
  entitiesToCover: z.array(z.string()).max(15),
  internalLinks: z.array(
    z.object({ anchor: z.string(), targetType: z.string(), placement: z.string() })
  ),
  assetsNeeded: z.array(z.object({ type: z.string(), description: z.string() })).max(5),
  writerChecklist: z.array(z.string()).min(5).max(10),
  eeatSignals: z.array(z.string()).max(6),
  editorNote: z.string(),
});
export type BriefStage = z.infer<typeof BriefStage>;

// ---------------------------------------------------------------------------
// Run envelope
// ---------------------------------------------------------------------------

export const STAGE_IDS = ["intent", "clusters", "planning", "creative"] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** `stage` only when the caller is retrying one failed desk; otherwise the
 *  request just means "keep this run moving". */
export const StageRequest = z.object({ stage: z.enum(STAGE_IDS).optional() });

export type StageErrors = Partial<Record<StageId | "brief", string>>;

/** How many times each desk has failed in a row since it last succeeded (or
 *  since the run started). Drives the auto-retry in lib/ai/drive.ts. */
export type StageAttempts = Partial<Record<StageId, number>>;
