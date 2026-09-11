import Link from "next/link";

import BoardProgress from "@/components/BoardProgress";
import DeckGrid from "@/components/DeckGrid";
import DeckRail from "@/components/DeckRail";
import RootBoardBar from "@/components/RootBoardBar";
import { PRINTED } from "@/lib/site";
import { DECK_SIZE } from "@/lib/tiers";

export default function DeckPage() {
  return (
    <main className="mx-auto w-full max-w-xl grow px-4 pt-5 pb-8 sm:px-6">
      <header>
        {/* The month comes from the constant every board page's dedication
            takes it from, so the edition is stated once rather than in two
            places that drift a print run apart. */}
        <p className="tp-kicker">An edition of four · {PRINTED}</p>
        <h1 className="tp-masthead mt-2.5">
          Toronto
          <br />
          Parking
        </h1>
        <p className="tp-lede mt-3.5">
          Sixty numbered layouts to set up on the board. Pick one, place the pieces, then put the
          phone down and play.
        </p>
      </header>

      <div className="mt-[19px]">
        <DeckRail />
      </div>

      {/* Under the rail rather than under the deck, because it answers the
          question the rail has just raised, and because forty of the sixty
          results are a ruled blank on a first visit: a reader should be told
          what one of those is before scrolling into thirty of them. */}
      <p className="tp-note mt-3">
        A ringed figure is a card solved at par. A rule is a card still waiting for a number.
      </p>

      {/* No heading and no `aria-label`: the bar has two states and no name is
          true in both. "Have a board?" repeated the first three words of the
          field's own label a line below it, and in the remembered state it
          asked a question the reader had already answered. Unnamed, the box is
          a plain grouping element, and the content names itself — a labelled
          field, or the link to the remembered board. A `div` rather than an
          unnamed `section`, so the markup claims only what it is. */}
      <div className="mt-4 border-t border-rule pt-3.5">
        <RootBoardBar />
      </div>

      {/* No wrapper: the component renders its own, and a wrapper here would
          become the sticky bar's containing block and leave it no travel. */}
      <BoardProgress />

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
    </main>
  );
}
