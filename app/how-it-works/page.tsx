import { MODEL, PROVIDER_LABEL, hasLiveModel } from "@/lib/ai/client";
import { hasDatabase } from "@/lib/db";
import { SCORE_FORMULA } from "@/lib/pipeline/score";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, Info, SectionHeader } from "@/components/ui";
import { Provenance, ProvenanceLegend } from "@/components/provenance";
import { StageIllustration } from "@/components/how-it-works-illustration";

export const metadata = { title: "How It Works — MauSearch" };

type Stage = {
  n: string;
  name: string;
  who: string;
  automatic: boolean;
  detail: string;
  /** What this step actually does for one real search, so the pipeline stops being abstract. */
  example: string;
};

const STAGES: Stage[] = [
  {
    n: "1",
    name: "Clean up your keyword",
    who: "Computer",
    automatic: true,
    detail: "We tidy up what you typed - fix spacing, lowercase it, figure out which country/language it's for.",
    example: "Bang Maulana types “Padel Jakarta”, picks Indonesia + Local Service. We clean it up to padel jakarta and resolve the market to Indonesian (id).",
  },
  {
    n: "2",
    name: "Ask Google what people actually search",
    who: "Google Suggest",
    automatic: true,
    detail: "We ask Google's autocomplete for real queries related to your keyword - the same suggestions you see typing into the search box, just gathered in bulk.",
    example: "~10 parallel requests go out: padel jakarta, sewa padel jakarta, harga padel jakarta, padel jakarta terdekat... Google hands back real queries like sewa lapangan padel jakarta selatan and harga sewa padel per jam.",
  },
  {
    n: "3",
    name: "Remove duplicates & rank by popularity",
    who: "Computer",
    automatic: true,
    detail: "Duplicate queries get merged. The more often a query shows up across our searches and the higher Google ranked it, the more weight it gets.",
    example: "sewa lapangan padel jakarta came back from 3 different searches and ranked #2 each time - it rises to the top of Bang Maulana's keyword universe.",
  },
  {
    n: "4",
    name: "Spot obvious buying signals",
    who: "Computer",
    automatic: true,
    detail: "Words like \"harga\" (price) or \"beli\" (buy) are flagged by a simple word list, before any AI gets involved - this part is just pattern matching, not guessing.",
    example: "sewa lapangan padel jakarta matches “sewa” → tagged transactional. cara main padel matches “cara” → tagged informational. No AI has run yet.",
  },
  {
    n: "5",
    name: "Work out what people want",
    who: "AI - SEO Strategist",
    automatic: true,
    detail: "The AI reads every query plus the word-list hints and decides: are people mostly researching, comparing, or ready to buy? It also explains any time it disagrees with the word list.",
    example: "The AI reads all of Bang Maulana's queries with their tags attached and estimates the mix: ~50% transactional (booking a court), ~30% local (nearest venue), ~20% informational (how padel works).",
  },
  {
    n: "6",
    name: "Group into topics",
    who: "AI - SEO Strategist",
    automatic: true,
    detail: "Related queries get bundled into a handful of topics worth writing about - grouped by what the searcher is trying to get done, not by shared words.",
    example: "Queries get grouped into “Court Booking & Pricing”, “Nearest Venues”, and “Learning to Play” - plus a note that nobody's query addresses court size or racket rental, a gap worth filling.",
  },
  {
    n: "7",
    name: "Figure out who's searching and what to publish",
    who: "AI - Content Strategist",
    automatic: true,
    detail: "For each topic: who is likely searching, how close they are to a decision, and what kind of page (guide, comparison, pricing page) fits best.",
    example: "Persona: “a Jakarta professional booking a court with friends after work.” “Court Booking & Pricing” gets mapped to bottom-funnel - a venue/booking landing page, not a long-form guide.",
  },
  {
    n: "8",
    name: "Brainstorm content ideas - and reject the boring ones",
    who: "AI - Creative Director",
    automatic: true,
    detail: "The AI pitches several content ideas with a hook and a title, scores them, and also lists ideas it deliberately rejected and why - the same way an agency creative director would.",
    example: "Pitched: “Padel Court Booking Guide: Jakarta's Best Indoor Venues.” Rejected: “What Is Padel? A Beginner's Guide” - killed because this keyword set is overwhelmingly people ready to book, not people who don't know what padel is.",
  },
  {
    n: "9",
    name: "Write the brief",
    who: "AI - Content Lead",
    automatic: false,
    detail: "Only happens once you pick one idea. Produces a full brief a writer can start from today: outline, title, FAQs, links to include.",
    example: "Bang Maulana picks the booking guide and clicks Generate Brief. Out comes an outline, meta title, FAQs like “Berapa harga sewa lapangan padel per jam di Jakarta?”, and the entities a writer must cover.",
  },
  {
    n: "10",
    name: "Save your work",
    who: "Computer",
    automatic: true,
    detail: "Every step is checked and saved as it finishes, so if anything fails partway, you keep everything that already worked and can retry just the broken part.",
    example: "Every step above was saved to the database the moment it finished. If Bang Maulana's wifi drops right after step 6, reloading the page picks up exactly there - nothing re-runs, nothing gets billed twice.",
  },
];

export default function HowItWorks() {
  const live = hasLiveModel();
  const db = hasDatabase();

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="brand">HOW IT WORKS</Badge>}
        title="From a keyword to a content plan"
        subtitle="No jargon required - here's what happens, in order, when you type in a keyword."
        actions={<ButtonLink href="/">Try it</ButtonLink>}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6 md:px-8">
        <ProvenanceLegend />

        <Card className="overflow-hidden">
          <SectionHeader
            index="01"
            title="The 10 steps"
            meta="Think of it as four specialists on a content agency team, each handing their work to the next"
          />
          <ol className="divide-y divide-line">
            {STAGES.map((stage, i) => (
              <li key={stage.n} className="flex flex-col gap-4 px-5 py-3.5 sm:flex-row">
                <div className="flex gap-4">
                  <span className="font-mono text-xs font-semibold text-faint">{stage.n}</span>
                  <StageIllustration n={stage.n} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{stage.name}</p>
                    <Badge tone={stage.who === "Computer" ? "neutral" : stage.who === "Google Suggest" ? "brand" : "accent"}>
                      {stage.who}
                    </Badge>
                    {!stage.automatic && <Badge tone="warn">only when you pick one</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">{stage.detail}</p>
                  <p
                    className="animate-land mt-2 rounded-lg border border-line bg-canvas p-2.5 text-xs text-muted"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span className="font-medium text-ink">Behind the scenes — </span>
                    {stage.example}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="02" title="What we refuse to make up" />
          <div className="space-y-3 p-5 text-sm text-muted">
            <p>
              We don&apos;t show search volume, CPC (cost per click), or &ldquo;keyword
              difficulty&rdquo; scores - the numbers most keyword tools show you. We don&apos;t have
              real access to that data, and a confident but made-up number is worse than showing
              nothing, because you&apos;d plan around it as if it were true.
            </p>
            <p>Instead, everything on screen is labelled with where it actually came from:</p>
            <ul className="space-y-2">
              <li className="flex gap-2.5">
                <Provenance source="google_suggest" />
                <span>
                  <strong className="text-ink">Real data</strong> - an actual query Google
                  suggested, and how often/high it showed up.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="rule" />
                <span>
                  <strong className="text-ink">Simple word matching</strong> - flagged by a fixed
                  list of words in code, no AI involved, so you can check it yourself.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="ai" />
                <span>
                  <strong className="text-ink">AI&apos;s opinion</strong> - a judgment call, clearly
                  marked as one, not a fact.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Provenance source="mauscore" />
                <span>
                  <strong className="text-ink">A calculated score</strong> - worked out from a
                  formula we show you, not hidden inside a model.
                </span>
              </li>
            </ul>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="03" title="Why doesn't the AI just decide the ranking itself?" />
          <div className="space-y-3 p-5 text-sm text-muted">
            <p>
              The AI is good at judging three things: how strong the buying intent is, how
              different an idea is from what already exists, and how much work it&apos;d take. It
              does <em>not</em> get to pick the final order - AI models are unreliable at doing
              consistent math across a list, and &ldquo;why is this idea ranked first?&rdquo;
              deserves an answer that&apos;s the same every time you ask.
            </p>
            <p className="rounded-lg border border-line bg-canvas p-3 font-mono text-xs text-ink">
              Opportunity Score = {SCORE_FORMULA}
            </p>
            <p>
              Almost a third of every ranking is grounded in real Google data, and each idea
              card shows exactly which part.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader index="04" title="What's actually running this" />
          <div className="space-y-2 p-5 text-sm text-muted">
            <p>
              The &ldquo;thinking&rdquo; steps are handled by an AI model called
              <strong className="text-ink"> Nemotron</strong>
              <Info>A large language model - similar in kind to models like GPT or Claude, specialised for reasoning tasks.</Info>,
              reached through a routing service called
              <strong className="text-ink"> {PROVIDER_LABEL}</strong>
              <Info>A middleman service that lets us swap which AI model we use without changing code - like a phone switchboard for AI models.</Info>.
              Right now this workspace is running on{" "}
              <strong className="text-ink">{live ? "the live AI model" : "sample data"}</strong>
              {!live && " - add an API key to see it reason over your own keywords instead of a demo."}
            </p>
            <p>
              Saved runs and briefs live in{" "}
              <strong className="text-ink">{db ? "a real database" : "temporary memory"}</strong>
              {!db && " for this session - connect a database to keep them permanently."}. The
              keyword search itself (step 2, Google Suggest) always uses live data either way - it
              doesn&apos;t need an AI model or a database to work.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
