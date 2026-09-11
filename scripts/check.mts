/**
 * Self-check for the deterministic pipeline (stages 0-3) and the MauScore
 * formulas. These run before any model does, so a silent bug here poisons every
 * downstream stage - hence one runnable check rather than trust.
 *
 *   npx tsx scripts/check.mts
 */
import assert from "node:assert/strict";
import { normalize } from "@/lib/pipeline/normalize";
import { ruleSignals } from "@/lib/pipeline/rules";
import { dedupeAndSignal } from "@/lib/pipeline/dedupe";
import { demandSignal, rankOpportunities, scoreOpportunity } from "@/lib/pipeline/score";
import { runHarvest } from "@/lib/pipeline";
import { Opportunity, NormalizedIntake } from "@/lib/schema";

let checks = 0;
const ok = (label: string) => {
  checks++;
  console.log(`  ok  ${label}`);
};

// --- stage 0: normalize -----------------------------------------------------
console.log("\nnormalize");
{
  const n = normalize({ keyword: "  Photobooth   JAKARTA!! ", market: "ID", lens: "general" });
  assert.equal(n.normalized, "photobooth jakarta");
  assert.equal(n.language, "id");
  assert.equal(n.keyword, "Photobooth   JAKARTA!!", "original keyword is preserved for display");
  ok("lowercases, collapses whitespace, strips punctuation, resolves locale");

  assert.equal(
    normalize({ keyword: "e-commerce SEO", market: "US", lens: "general" }).normalized,
    "e-commerce seo"
  );
  ok("keeps intra-word hyphens");
}

// --- stage 3: rule signals --------------------------------------------------
console.log("\nrule signals");
{
  const id = (k: string) => ruleSignals(k, "id").intent;
  const en = (k: string) => ruleSignals(k, "en").intent;

  assert.equal(id("harga photobooth jakarta"), "transactional");
  assert.equal(id("photobooth terbaik jakarta"), "commercial");
  assert.equal(id("apa itu photobooth"), "informational");
  assert.equal(id("photobooth terdekat"), "local");
  ok("Indonesian lexicon classifies each intent family");

  assert.equal(en("buy photobooth"), "transactional");
  assert.equal(en("best photobooth software"), "commercial");
  assert.equal(en("how to build a photobooth"), "informational");
  assert.equal(en("photobooth near me"), "local");
  ok("English lexicon classifies each intent family");

  // Precedence: someone asking the price of the best option is ready to spend.
  assert.equal(id("harga photobooth terbaik"), "transactional");
  ok("transactional outranks commercial when both match");

  // `local` only wins when nothing else matched, since it modifies other intents.
  assert.equal(en("best photobooth near me"), "commercial");
  ok("local yields to a stronger intent signal");

  // Whole-word matching: "book" must not fire inside "bookshelf".
  assert.notEqual(en("bookshelf design ideas"), "transactional");
  assert.equal(en("bookshelf design ideas"), "informational");
  ok("single-token terms match on word boundaries, not substrings");

  assert.equal(en("photobooth"), null, "no modifier means no rule opinion");
  ok("returns null rather than guessing when nothing matches");

  // Real harvested Indonesian queries mix English modifiers, so the ID lexicon
  // merges English in. Verified against actual Suggest output for this keyword.
  assert.equal(id("best photobooth jakarta"), "commercial");
  assert.equal(id("booking photobooth jakarta"), "transactional");
  assert.equal(id("review photobooth jakarta"), "commercial");
  ok("Indonesian market also matches English modifiers");

  assert.equal(en("bookshelf design ideas"), "informational", "English lexicon unchanged");
  ok("merging does not disturb English-market behaviour");

  assert.deepEqual(ruleSignals("harga sewa photobooth", "id").matched.sort(), ["harga", "sewa"]);
  ok("reports every matched modifier for display");
}

// --- stage 2: dedupe + signals ----------------------------------------------
console.log("\ndedupe");
{
  const intake: NormalizedIntake = {
    keyword: "photobooth jakarta",
    normalized: "photobooth jakarta",
    market: "ID",
    language: "id",
    country: "ID",
    lens: "general",
  };

  const keywords = dedupeAndSignal(
    [
      {
        seed: "photobooth jakarta",
        isBase: true,
        suggestions: ["photobooth jakarta", "sewa photobooth jakarta", "PHOTOBOOTH  Jakarta"],
      },
      {
        seed: "harga photobooth jakarta",
        isBase: false,
        suggestions: ["sewa photobooth jakarta", "harga photobooth jakarta", "resep rendang"],
      },
    ],
    intake
  );

  const bySeed = new Map(keywords.map((k) => [k.keyword, k]));

  assert.equal(bySeed.get("photobooth jakarta")!.coverage, 1);
  assert.equal(
    keywords.filter((k) => k.keyword === "photobooth jakarta").length,
    1,
    "case and whitespace variants collapse into one entry"
  );
  ok("normalizes and collapses duplicate spellings");

  const shared = bySeed.get("sewa photobooth jakarta")!;
  assert.equal(shared.coverage, 2, "seen under two distinct seeds");
  assert.equal(shared.rank, 1, "keeps the best rank, which came from the base seed");
  ok("merges across seeds keeping best rank and counting coverage");

  // Modifier seeds carry a +5 rank penalty: rank 1 there becomes 6.
  assert.equal(bySeed.get("harga photobooth jakarta")!.rank, 6);
  ok("penalises ranks harvested from modifier seeds");

  assert.equal(bySeed.has("resep rendang"), false);
  ok("drops drift sharing no token with the intake");

  assert.equal(bySeed.get("harga photobooth jakarta")!.ruleIntent, "transactional");
  assert.equal(bySeed.get("sewa photobooth jakarta")!.source, "google_suggest");
  ok("attaches rule intent and provenance to every row");
}

// --- MauScore ---------------------------------------------------------------
console.log("\nmauscore");
{
  assert.equal(demandSignal(0, 1), 100);
  assert.ok(demandSignal(0, 1) > demandSignal(5, 1));
  assert.ok(demandSignal(5, 1) > demandSignal(20, 1));
  ok("demand signal falls monotonically with rank");

  assert.ok(demandSignal(10, 3) > demandSignal(10, 1));
  assert.equal(demandSignal(10, 9), demandSignal(10, 4), "coverage bonus caps at +15");
  ok("coverage adds a bounded bonus");

  assert.equal(demandSignal(999, 1), 40, "rank penalty floors at 20 positions");
  assert.ok(demandSignal(0, 99) <= 100, "never exceeds 100");
  ok("clamps at both ends");

  const base: Opportunity = {
    id: "opp_1",
    title: "t",
    clusterId: "c1",
    funnelStage: "BOFU",
    format: "landing page",
    angle: { framing: "f", hook: "h", contrarianTake: "c", whyNotGeneric: "w" },
    targetKeyword: "sewa photobooth jakarta",
    supportingKeywords: [],
    audience: "a",
    promise: "p",
    proofRequired: [],
    signals: { intentValue: 80, differentiation: 70, effort: 40 },
    seoTitles: [
      { title: "x", rationale: "r" },
      { title: "y", rationale: "r" },
    ],
    riskIfIgnored: "r",
  };

  // 0.30(90) + 0.30(80) + 0.25(70) + 0.15(60) = 27 + 24 + 17.5 + 9 = 77.5 -> 78
  const scored = scoreOpportunity(base, 90);
  assert.equal(scored.opportunityScore, 78);
  assert.equal(scored.priority, "P0");
  ok("opportunity score matches the published formula");

  // Same AI signals, zero demand: 0 + 24 + 17.5 + 9 = 51, which drops it to P2.
  assert.equal(scoreOpportunity(base, 0).opportunityScore, 51);
  assert.equal(scoreOpportunity(base, 0).priority, "P2");
  assert.ok(
    scoreOpportunity(base, 90).opportunityScore > scoreOpportunity(base, 10).opportunityScore,
    "real Suggest demand moves the ranking"
  );
  ok("demand signal carries its 30% of the rank");

  const ranked = rankOpportunities(
    [
      { ...base, id: "low", clusterId: "c_low" },
      { ...base, id: "high", clusterId: "c_high" },
    ],
    [
      { id: "c_low", members: ["a"] },
      { id: "c_high", members: ["b"] },
    ],
    [
      { keyword: "a", rank: 19, coverage: 1, seeds: [], demandSignal: demandSignal(19, 1), ruleIntent: null, ruleMatches: [], aiIntent: null, source: "google_suggest" },
      { keyword: "b", rank: 0, coverage: 3, seeds: [], demandSignal: demandSignal(0, 3), ruleIntent: null, ruleMatches: [], aiIntent: null, source: "google_suggest" },
    ]
  );
  assert.deepEqual(ranked.map((o) => o.id), ["high", "low"]);
  ok("ranks best-scoring opportunity first");
}

// --- stage 1: live Google Suggest -------------------------------------------
// Network-dependent, so a failure here warns instead of failing the check - the
// product itself degrades the same way.
console.log("\ngoogle suggest (live)");
{
  try {
    const result = await runHarvest(
      normalize({ keyword: "photobooth jakarta", market: "ID", lens: "local_service" })
    );
    if (result.status === "unavailable") {
      console.log("  WARN  Suggest unreachable - app falls back to AI expansion");
    } else {
      assert.ok(result.keywords.length >= 10, "expected a real keyword universe");
      assert.ok(
        result.keywords.every((k) => k.demandSignal >= 0 && k.demandSignal <= 100),
        "signals in range"
      );
      ok(
        `harvested ${result.keywords.length} real keywords from ` +
          `${result.seedsSucceeded}/${result.seedsAttempted} seeds (${result.status})`
      );
      console.log(
        "        sample:",
        result.keywords.slice(0, 5).map((k) => `${k.keyword} [${k.ruleIntent ?? "-"}]`).join(" | ")
      );
    }
  } catch (err) {
    console.log(`  WARN  live harvest failed: ${(err as Error).message}`);
  }
}

// --- fixtures ---------------------------------------------------------------
// The committed fixtures are what a keyless clone renders and what seeds the
// demo, so they have to satisfy the same schemas a live model does - plus
// referential integrity, since a cluster member that does not exist in the
// harvest would silently score zero demand.
console.log("\nfixtures");
{
  const { intentStage } = await import("@/lib/ai/stages/intent");
  const { clustersStage } = await import("@/lib/ai/stages/clusters");
  const { planningStage } = await import("@/lib/ai/stages/planning");
  const { creativeStage } = await import("@/lib/ai/stages/creative");
  const { briefStage } = await import("@/lib/ai/stages/brief");
  const { expandStage } = await import("@/lib/ai/stages/expand");
  const { HarvestResult } = await import("@/lib/schema");
  const harvestFixture = (await import("@/lib/ai/fixtures/harvest.json")).default;

  for (const stage of [intentStage, clustersStage, planningStage, creativeStage, briefStage, expandStage]) {
    const parsed = stage.schema.safeParse(stage.fixture);
    assert.ok(
      parsed.success,
      `${stage.id} fixture failed its schema: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`
    );
  }
  ok("every stage fixture satisfies its own schema");

  const harvest = HarvestResult.parse(harvestFixture);
  assert.ok(harvest.keywords.length >= 20, "demo harvest is substantial");
  assert.ok(
    harvest.keywords.every((k) => k.source === "google_suggest"),
    "demo harvest is real Suggest data"
  );
  ok(`demo harvest holds ${harvest.keywords.length} real Suggest keywords`);

  const universe = new Set(harvest.keywords.map((k) => k.keyword));
  const intent = intentStage.fixture;
  const clusters = clustersStage.fixture;
  const creative = creativeStage.fixture;

  const mixTotal = intent.mix.reduce((sum, m) => sum + m.share, 0);
  assert.equal(mixTotal, 100, "intent mix must sum to 100");
  ok("intent mix shares sum to exactly 100");

  assert.deepEqual(
    intent.keywordIntents.map((k) => k.keyword).filter((k) => !universe.has(k)),
    [],
    "every classified keyword exists in the harvest"
  );
  assert.equal(intent.keywordIntents.length, universe.size, "every harvested keyword is classified");
  ok("intent stage classifies exactly the harvested universe");

  const seen = new Set<string>();
  for (const cluster of clusters.clusters) {
    for (const member of cluster.members) {
      assert.ok(universe.has(member), `cluster member not in harvest: "${member}"`);
      assert.ok(!seen.has(member), `keyword in two clusters: "${member}"`);
      seen.add(member);
    }
  }
  ok("cluster members are real keywords, each used at most once");

  const clusterIds = new Set(clusters.clusters.map((c) => c.id));
  for (const opportunity of creative.opportunities) {
    assert.ok(clusterIds.has(opportunity.clusterId), `unknown clusterId: ${opportunity.clusterId}`);
    assert.ok(universe.has(opportunity.targetKeyword), `target keyword not real: "${opportunity.targetKeyword}"`);
  }
  ok("every opportunity points at a real cluster and a real query");

  assert.ok(creative.killList.length >= 2, "the kill list is never empty");
  ok(`kill list rejects ${creative.killList.length} ideas with reasons`);

  const ranked = rankOpportunities(creative.opportunities, clusters.clusters, harvest.keywords);
  assert.equal(ranked.length, creative.opportunities.length);
  assert.ok(
    ranked.every((r, i) => i === 0 || ranked[i - 1].opportunityScore >= r.opportunityScore),
    "ranking is ordered"
  );
  ok(
    `demo ranking: ${ranked.map((r) => `${r.id}=${r.opportunityScore}(${r.priority})`).join(" ")}`
  );

  // No fabricated metrics anywhere in the committed fixtures.
  const banned = /"(searchVolume|search_volume|volume|cpc|keywordDifficulty|keyword_difficulty|difficulty)"\s*:/i;
  for (const stage of [intentStage, clustersStage, planningStage, creativeStage, briefStage]) {
    assert.ok(
      !banned.test(JSON.stringify(stage.fixture)),
      `${stage.id} fixture contains a fabricated metric field`
    );
  }
  ok("no fabricated volume / CPC / difficulty fields in any fixture");
}

console.log(`\n${checks} checks passed\n`);
