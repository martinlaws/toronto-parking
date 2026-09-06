import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Board from "@/components/Board";
import CardHeader from "@/components/CardHeader";
import SolveToggle from "@/components/SolveToggle";
import Checklist from "@/components/Checklist";
import RotateControl from "@/components/RotateControl";
import { setupSentences } from "@/lib/board";
import { cards } from "@/lib/deck";
import { DECK_SIZE, tierLabel } from "@/lib/tiers";
import type { Card } from "@/lib/types";

/**
 * All sixty cards prerender.
 *
 * `dynamicParams = false` is what the spec asks for, but the bundled 16.3.4
 * docs say the export is not compatible with `cacheComponents` and fails the
 * build; the replacement they give is `notFound()` in the page when the param
 * does not resolve to real data, which is what `lookUp` does below.
 */
export function generateStaticParams() {
  return cards.map((card) => ({ n: String(card.n) }));
}

/** Only a bare 1..60 is a card. `01`, `1.0`, `+1` and `x` are all misses. */
function lookUp(raw: string): Card {
  if (!/^[1-9][0-9]?$/.test(raw)) notFound();
  const n = Number(raw);
  if (n < 1 || n > DECK_SIZE) notFound();
  const card = cards[n - 1];
  if (!card || card.n !== n) notFound();
  return card;
}

export async function generateMetadata({
  params,
}: PageProps<"/cards/[n]">): Promise<Metadata> {
  const { n } = await params;
  if (!/^[1-9][0-9]?$/.test(n) || Number(n) > DECK_SIZE) return {};
  const card = cards[Number(n) - 1];
  return {
    title: `Card ${card.n}`,
    description: `${tierLabel(card.tier)}. Par ${card.moves}. Set it up on the board and get the red car out.`,
  };
}

const BAR =
  "tp-fade flex min-h-14 w-full items-center justify-between rounded-2xl border border-ink/12 px-5 py-3 font-medium hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default async function CardPage({ params }: PageProps<"/cards/[n]">) {
  const { n } = await params;
  const card = lookUp(n);
  const previous = card.n > 1 ? card.n - 1 : null;
  const next = card.n < DECK_SIZE ? card.n + 1 : null;
  const sentences = setupSentences(card.pieces);

  return (
    <main className="mx-auto w-full max-w-5xl grow px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-8 wide:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] wide:gap-12">
        {/* 1 · Header */}
        <section aria-label="Card" className="wide:col-start-1 wide:row-start-1">
          <CardHeader card={card} />
        </section>

        {/* 2 · The diagram, with its two controls on the bottom edge */}
        {/* `self-start` is what makes the sticky work: the section spans both
            rows, and a stretched grid item is already as tall as its area, so
            a sticky offset has nowhere to travel. */}
        <section
          aria-label="Board setup"
          className="space-y-4 wide:col-start-2 wide:row-span-2 wide:row-start-1 wide:self-start wide:sticky wide:top-8"
        >
          {/* 8px gutters on a phone, so a cell lands near 48px at 360px wide. */}
          <div className="-mx-2 sm:mx-0">
            <Board card={card} />
          </div>
          <RotateControl />
        </section>

        <div className="space-y-10 wide:col-start-1 wide:row-start-2">
          {/* 3 · What you need */}
          <Checklist card={card} />

          {/* 4 · Read it aloud */}
          <section aria-labelledby="read-aloud">
            <details className="rounded-2xl border border-ink/12 px-5 py-4">
              <summary
                id="read-aloud"
                className="cursor-pointer font-display text-2xl font-bold marker:text-ink/40"
              >
                Read it aloud
              </summary>
              <ol className="mt-4 space-y-1.5 text-lg leading-relaxed">
                {sentences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </details>
          </section>

          {/* 5 · Mark solved */}
          <section aria-labelledby="mark-solved" className="space-y-3">
            <h2 id="mark-solved" className="font-display text-2xl font-bold">
              Mark solved
            </h2>
            <SolveToggle card={card.n} par={card.moves} />
            <p className="text-ink/65">
              Ticking a card keeps your place. With a board code it travels to the other three.
            </p>
          </section>

          {/* 6 · The slot hints and playback land in. Nothing renders here in v1. */}
          <section id="stuck" />

          {/* 7 · Prev, next, back, and where the board came from */}
          <section className="space-y-10">
            <nav aria-label="Deck" className="space-y-3">
              {previous ? (
                <Link href={`/cards/${previous}` as Route} className={BAR}>
                  <span className="text-ink/60">Previous</span>
                  <span className="font-display text-xl">#{previous}</span>
                </Link>
              ) : null}
              {next ? (
                <Link href={`/cards/${next}` as Route} className={BAR}>
                  <span className="text-ink/60">Next</span>
                  <span className="font-display text-xl">#{next} &rarr;</span>
                </Link>
              ) : null}
              <Link href="/" className={`${BAR} justify-center`}>
                Back to the deck
              </Link>
            </nav>

            <footer className="border-t border-ink/10 pt-5 text-sm text-ink/60">
              <p className="break-all">
                Board{" "}
                <a
                  className="underline underline-offset-4"
                  href={`https://www.michaelfogleman.com/static/rush/#${card.board}/${card.moves}`}
                  rel="noreferrer"
                >
                  {card.board}
                </a>{" "}
                · from Fogleman&apos;s database
              </p>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
