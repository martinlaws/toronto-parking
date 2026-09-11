import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import Board from "@/components/Board";
import BoardDeckProgress from "@/components/BoardDeckProgress";
import BoardHeader from "@/components/BoardHeader";
import DeckGrid from "@/components/DeckGrid";
import DeckRail from "@/components/DeckRail";
import FourBoards from "@/components/FourBoards";
import StoreDown from "@/components/StoreDown";
import { cards } from "@/lib/deck";
import { SITE_NAME } from "@/lib/site";
import { DECK_SIZE } from "@/lib/tiers";

/**
 * The board's home, and the first thing a recipient ever sees: scanned off a
 * card, standing over a box they have just opened. It reads down in the order
 * that moment goes — who it is for, what the thing in their hands is, where
 * they are in it, the way in, and who else has one.
 *
 * The page itself never awaits `params`, so the shell is static and survives
 * the deliberately missing `generateStaticParams`: the four codes are printed,
 * not published, and listing them at build time would put them in the
 * deployment.
 *
 * The title stays the site name and the page is `noindex`, so no recipient's
 * name reaches browser history, a preview card or a crawler.
 */
export const metadata: Metadata = {
  // Absolute, so the layout's `%s · Toronto Parking` template does not double it.
  title: { absolute: SITE_NAME },
  robots: { index: false, follow: false },
};

/**
 * The invite is `BoardProgress`'s prose, set in the serif from outside.
 *
 * The sentence a recipient reads there — "Nothing solved yet. Card 1 is the
 * place to start." — already belongs to that component, and that component is
 * shared with the deck, where the same block is a control bar rather than a
 * greeting. So this page sets the register instead of forking the copy: the
 * rule reaches the paragraphs inside `[data-board-progress]` and nothing else,
 * which leaves the pick-up link on the label face `CONTROL` gives it.
 *
 * It cannot be a wrapper element. `PICK_UP_BAR` is sticky, a sticky box travels
 * only inside its own containing block, and a div drawn tightly around it would
 * leave it nowhere to go.
 */
const INVITE =
  "[&_[data-board-progress]_p]:max-w-[18em] [&_[data-board-progress]_p]:font-serif [&_[data-board-progress]_p]:text-[17px] [&_[data-board-progress]_p]:leading-[1.45] [&_[data-board-progress]_p]:tracking-[-0.005em] [&_[data-board-progress]_p]:text-ink [&_[data-board-progress]_p]:[font-variation-settings:'opsz'_17]";

export default function BoardPage({ params }: PageProps<"/b/[code]">) {
  // The first card, here as a picture of the object rather than as a
  // destination. Server-rendered from the deck this page already imports, so
  // it is on the page before the store answers and before any script runs.
  const first = cards[0];

  return (
    /* The deck's measure, not `/about`'s narrower one, because the listing at
       the foot is the same listing and should read the same on both pages.
       The gutters sit on the two inner wrappers rather than on `<main>`: the
       leaf is a full-bleed object and needs the column's edge, and it is
       cheaper for the one element that bleeds to put the gutters back than for
       every other element to cancel them. */
    <main className="mx-auto w-full max-w-xl grow pb-8">
      {/* One header slot, whatever resolves into it. The leaf bleeds back out
          of these gutters; the skeleton, the unknown-code notice and the store
          notice keep them, so a page that never reaches a dedication still
          lines up with the blocks under it. */}
      <div className="px-4 sm:px-6">
        <StoreDown>
          <Suspense
            fallback={
              <p data-skeleton="board-header" className="tp-note pt-10">
                Finding this board
              </p>
            }
          >
            <BoardHeader params={params} />
          </Suspense>
        </StoreDown>
      </div>

      <div className={`px-4 sm:px-6 ${INVITE}`}>
        {/* The object. The gradient is the leaf's shadow falling onto the page
            under it, bled to the column's edge, and it is most of what keeps
            the paper reading as a thing lying on the page rather than as a
            band of colour at the top of it. */}
        <figure className="relative pt-[30px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-4 top-0 h-[110px] bg-[linear-gradient(#f2eee4,rgba(250,251,248,0))] sm:-inset-x-6"
          />
          {/* 8px gutters on a phone, so a cell lands near 48px at 360px wide.
              The shadow is a `filter` rather than a `box-shadow` so it follows
              the diagram's own rounded frame instead of the square box around
              it, and it is tinted with the accent rather than left neutral: a
              grey shadow under the one object on a near-white ground reads as
              dirt. One step heavier than the card page's, because here the
              board is being handed over rather than worked on. */}
          <div className="relative -mx-2 [filter:drop-shadow(0_14px_30px_rgba(15,107,75,0.15))_drop-shadow(0_2px_4px_rgba(19,23,20,0.08))] sm:mx-0">
            <Board card={first} />
          </div>
          {/* A real `<figcaption>` rather than a labelled section: the block is
              a diagram and the sentence under it, which is the one thing that
              element is for, and it spares the page a landmark it would only
              have had to name. */}
          <figcaption className="relative mt-[14px] font-serif text-[14px] leading-[1.46] text-pretty text-muted [font-variation-settings:'opsz'_14]">
            <b className="tp-label pr-1 text-[10px] font-bold tracking-[0.14em] text-ink uppercase">
              Card {first.n}
            </b>{" "}
            Par {first.moves}, the shortest in the set. One of {DECK_SIZE}, ordered easiest to
            hardest, and every one of them a picture of the board you have.
          </figcaption>
        </figure>

        {/* The deck's rail, here in its natural state: a board nobody has
            played is sixty unlit ticks and two ruled blanks, which is an empty
            scorecard rather than a broken one. `DeckScore`, inside the listing
            below, fills it in from the deck's own markup afterwards. */}
        <div className="mt-[19px]">
          <DeckRail />
        </div>

        {/* The code comes from the URL inside this boundary, so everything
            around it still prerenders without the page awaiting params. */}
        <Suspense fallback={null}>
          <BoardDeckProgress />
        </Suspense>

        <div className="mt-7">
          <StoreDown>
            <Suspense
              fallback={
                <p data-skeleton="four-boards" className="tp-note">
                  Reading the other boards
                </p>
              }
            >
              <FourBoards params={params} />
            </Suspense>
          </StoreDown>
        </div>

        {/* The listing stays, though the design's gift page does not draw it.
            Without it a recipient who has just scanned the QR has exactly one
            way onward, the pick-up link, and no way at all to reach card 37;
            and the rail above reads its sixty figures out of these entries, so
            a page without them would want a second copy of the deck's par
            table shipped for it alone. The legend goes here rather than under
            the rail, because here is where the marks it names appear. */}
        <p className="tp-note mt-7">
          A ringed figure is a card solved at par. A rule is a card still waiting for a number.
        </p>
        <DeckGrid className="mt-[22px]" />

        <footer className="tp-deck-foot mt-5">
          <p>{DECK_SIZE} cards, ordered easiest to hardest.</p>
          <Link
            href="/about"
            className="tp-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span>About this set</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
