import { Intent } from "@/lib/schema";

/**
 * Stage 3 - rule-based intent signals.
 *
 * Deterministic lexicon matching runs BEFORE the model and is handed to it as
 * evidence. Rules do the cheap, unambiguous work ("harga" is transactional, no
 * inference required); the model resolves only what the lexicon cannot. This
 * keeps a whole class of judgment out of the LLM and makes it auditable.
 */

type Lexicon = Partial<Record<Intent, string[]>>;

const LEXICONS: Record<string, Lexicon> = {
  en: {
    transactional: ["buy","order","booking","book","rent","rental","hire","price","pricing","cost","cheap","deal","discount","quote","for sale","subscribe","package"],
    commercial: ["best","top","vs","versus","review","reviews","comparison","compare","alternative","alternatives","recommended","which","trusted"],
    informational: ["how","what","why","when","guide","tutorial","tips","idea","ideas","example","examples","meaning","checklist","template","learn"],
    navigational: ["login","sign in","official","website","app","download","contact"],
    local: ["near me","nearby","around me","closest"],
  },
  id: {
    transactional: ["beli","sewa","rental","order","pesan","booking","harga","biaya","tarif","murah","promo","diskon","jual","paket","daftar"],
    commercial: ["terbaik","rekomendasi","review","ulasan","vs","bagus","perbandingan","pilihan","terpercaya","top"],
    informational: ["cara","apa","kenapa","mengapa","bagaimana","tips","panduan","contoh","ide","arti","kapan","tutorial","belajar"],
    navigational: ["login","masuk","resmi","situs","aplikasi","unduh","kontak"],
    local: ["terdekat","dekat","sekitar"],
  },
};

/**
 * Precedence when a query matches several intents. A commercial-investigation
 * word loses to a transactional one ("harga photobooth terbaik" is someone
 * ready to spend). `local` sits last because it modifies another intent far
 * more often than it stands alone - it only wins when nothing else matched.
 */
const PRECEDENCE: Intent[] = [
  "transactional",
  "commercial",
  "informational",
  "navigational",
  "local",
];

/**
 * Non-English SERPs are bilingual in practice - real harvested Indonesian
 * queries include "best photobooth jakarta" and "review", so matching only the
 * local lexicon silently drops intent signals. We merge English in as a
 * secondary lexicon rather than pretending the market is monolingual.
 */
const mergeLexicons = (primary: Lexicon, secondary: Lexicon): Lexicon =>
  Object.fromEntries(
    PRECEDENCE.map((intent) => [
      intent,
      [...new Set([...(primary[intent] ?? []), ...(secondary[intent] ?? [])])],
    ])
  );

const BILINGUAL = mergeLexicons(LEXICONS.id, LEXICONS.en);

function lexiconFor(language: string): Lexicon {
  if (language === "id" || language === "ms") return BILINGUAL;
  return LEXICONS.en;
}

/** Whole-word match for single tokens; substring for multi-word phrases. */
function matches(keyword: string, term: string): boolean {
  if (term.includes(" ")) return keyword.includes(term);
  return new RegExp(`(^|\\s)${term}(\\s|$)`, "i").test(keyword);
}

export function ruleSignals(
  keyword: string,
  language: string
): { intent: Intent | null; matched: string[] } {
  const lexicon = lexiconFor(language);
  const lower = keyword.toLowerCase();
  const matched: string[] = [];
  const hit: Partial<Record<Intent, boolean>> = {};

  for (const intent of PRECEDENCE) {
    for (const term of lexicon[intent] ?? []) {
      if (matches(lower, term)) {
        matched.push(term);
        hit[intent] = true;
      }
    }
  }

  const intent = PRECEDENCE.find((i) => hit[i]) ?? null;
  return { intent, matched };
}
