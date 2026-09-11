import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Board from "@/components/Board";
import CardHeader from "@/components/CardHeader";
import Checklist from "@/components/Checklist";
import RotateControl from "@/components/RotateControl";
import SolvedChip from "@/components/SolvedChip";
import SolveToggle from "@/components/SolveToggle";
import { setupSentences } from "@/lib/board";
import { cards } from "@/lib/deck";
import { SITE_NAME } from "@/lib/site";
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

/**
 * The head of a block. The 2px ink rule under it is the page's major boundary
 * and the same weight the deck's contents head carries, so a section here and
 * a section there open at the same volume. The aside is the count the head has
 * just raised, pushed to the far end so the two do not read as one phrase.
 */
function SectionHead({ id, title, aside }: { id: string; title: string; aside?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b-2 border-b-ink pb-[7px]">
      <h2 id={id} className="tp-label text-[12.5px] font-bold tracking-[0.17em] text-ink uppercase">
        {title}
      </h2>
      {aside ? (
        <span className="ml-auto font-mono text-[10px] leading-none tracking-[0.05em] text-muted tabular-nums">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Sets the cell addresses in the mono face, which is the one job that face has
 * here: `C1` is a machine string inside a spoken sentence, and it is the part a
 * reader has to find on the frame while holding a piece. The split is safe
 * because every one of these sentences is assembled by `cellName`, so a column
 * letter against a row digit is always an address and never a word.
 */
function spellCoordinates(line: string) {
  return line
    .split(/\b([A-F][1-6])\b/)
    .map((part, index) =>
      index % 2 === 1 ? (
        <b key={index} className="font-mono text-[13.5px] font-medium tracking-[0.02em] text-ink">
          {part}
        </b>
      ) : (
        part
      ),
    );
}

/** The plate a prev/next link carries: small enough to read as a label, big
 *  enough to recognise a layout in, which is the whole reason it is there. */
const NAV_PLATE = "block size-11 shrink-0 overflow-hidden rounded-[2px] bg-frame";
const NAV_LINK =
  "tp-fade flex min-h-12 items-center gap-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const NAV_LABEL = "font-mono text-[9.5px] leading-[1.7] tracking-[0.16em] text-muted uppercase";
const NAV_NUMBER =
  "block text-[14.5px] leading-none font-[650] tracking-[-0.01em] text-ink tabular-nums lining-nums";

export default async function CardPage({ params }: PageProps<"/cards/[n]">) {
  const { n } = await params;
  const card = lookUp(n);
  const previous = card.n > 1 ? cards[card.n - 2] : null;
  const next = card.n < DECK_SIZE ? cards[card.n] : null;
  const sentences = setupSentences(card.pieces);

  return (
    <main className="mx-auto w-full max-w-xl grow px-4 pb-8 sm:px-6 wide:max-w-5xl">
      {/* The running head, and the only place the page names the site. It is
          not a link: the way back to the deck is a full-width one at the foot,
          where a reader who has finished with the card is already looking. The
          stamp between the two is this card's state and the folio is where it
          sits in the sixty. */}
      <header className="flex items-center gap-2.5 border-b border-b-rule pt-4 pb-2">
        <span className="tp-kicker">{SITE_NAME}</span>
        <span className="mr-3 ml-auto flex items-center">
          <SolvedChip card={card.n} />
        </span>
        <span className="text-[12.5px] leading-none font-[650] tracking-[0.02em] text-ink tabular-nums lining-nums">
          {card.n}
        </span>
      </header>

      <div className="grid wide:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] wide:gap-x-12">
        {/* 1 · The opener */}
        <section aria-label="Card" className="wide:col-start-1 wide:row-start-1">
          <CardHeader card={card} />
        </section>

        {/* 2 · The diagram, with the control table on its bottom edge */}
        {/* `self-start` is what makes the sticky work: the section spans both
            rows, and a stretched grid item is already as tall as its area, so
            a sticky offset has nowhere to travel. */}
        <section
          aria-label="Board setup"
          className="mt-5 wide:col-start-2 wide:row-span-2 wide:row-start-1 wide:self-start wide:sticky wide:top-8"
        >
          {/* 8px gutters on a phone, so a cell lands near 48px at 360px wide.
              The shadow is a `filter` rather than a `box-shadow` so it follows
              the diagram's own rounded frame instead of the square box around
              it, and it is tinted with the accent rather than left neutral: the
              board is the one object on the page, and a grey shadow under it on
              a near-white ground reads as dirt. */}
          <div className="-mx-2 [filter:drop-shadow(0_10px_24px_rgba(15,107,75,0.12))_drop-shadow(0_2px_3px_rgba(19,23,20,0.07))] sm:mx-0">
            <Board card={card} />
          </div>
          <div className="mt-5">
            <RotateControl />
          </div>
        </section>

        <div className="wide:col-start-1 wide:row-start-2">
          {/* 3 · What you need */}
          <section aria-labelledby="what-you-need" className="mt-7">
            <SectionHead
              id="what-you-need"
              title="What you need"
              aside={`${card.pieces.length} pieces`}
            />
            <Checklist card={card} />
          </section>

          {/* 4 · Read it aloud */}
          {/* Open, and no longer a `<details>`. A reader with the box out and
              the board in front of them came here for this list, and a
              disclosure made them go and fetch it every time. It is the setup
              and never the solution, so nothing about opening it touches the v1
              rule that the sixty stored solutions are never rendered. */}
          <section aria-labelledby="read-aloud" className="mt-7">
            <SectionHead id="read-aloud" title="Read it aloud" />
            <ol className="mt-0.5">
              {sentences.map((line, index) => (
                <li
                  key={line}
                  className="flex items-baseline gap-[14px] border-b border-b-rule py-2.5 last:border-b-0"
                >
                  {/* Hidden from the accessibility tree: an ordered list
                      already carries the position, and a numeral beside it
                      reads the count out twice. */}
                  <span
                    aria-hidden="true"
                    className="w-[1.4ch] shrink-0 text-right font-mono text-[10px] leading-none text-muted tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <span className="font-serif text-[16px] leading-[1.35] tracking-[-0.004em] text-ink [font-variation-settings:'opsz'_16]">
                    {spellCoordinates(line)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* 5 · Mark solved, and the scorecard under it */}
          <section aria-labelledby="mark-solved" className="mt-7">
            <SectionHead id="mark-solved" title="Mark solved" />
            <SolveToggle card={card.n} par={card.moves} />
          </section>

          {/* 6 · The slot hints and playback land in. Nothing renders here in v1. */}
          <section id="stuck" />

          {/* 7 · Prev, next, back, and where the board came from */}
          {/* The empty spans are load-bearing at the two ends of the deck:
              `justify-between` with a single child puts it on the left, so card
              1 would hand a reader a `Next` filed under where `Previous` had
              been on every card before it. */}
          <nav
            aria-label="Deck"
            className="mt-8 flex items-center justify-between gap-3 border-t-2 border-t-ink pt-3.5"
          >
            {previous ? (
              <Link href={`/cards/${previous.n}` as Route} className={NAV_LINK}>
                <span className={NAV_PLATE}>
                  <Board card={previous} mode="thumb" className="size-full" />
                </span>
                <span className={NAV_LABEL}>
                  Previous
                  <span className={NAV_NUMBER}>#{previous.n}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/cards/${next.n}` as Route} className={`${NAV_LINK} text-right`}>
                <span className={NAV_LABEL}>
                  Next
                  <span className={NAV_NUMBER}>#{next.n}</span>
                </span>
                <span className={NAV_PLATE}>
                  <Board card={next} mode="thumb" className="size-full" />
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>

          <Link
            href="/"
            className="tp-label tp-fade mt-1 flex min-h-11 w-full items-center justify-center border-t border-t-rule pt-3 text-[10px] font-[650] tracking-[0.16em] text-ink uppercase hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Back to the deck
          </Link>

          <p className="mt-2.5 font-mono text-[9px] leading-[1.75] font-light tracking-[0.02em] text-muted">
            Board{" "}
            <a
              className="break-all underline underline-offset-2"
              href={`https://www.michaelfogleman.com/static/rush/#${card.board}/${card.moves}`}
              rel="noreferrer"
            >
              {card.board}
            </a>{" "}
            · from Fogleman&apos;s database
          </p>
        </div>
      </div>
    </main>
  );
}
