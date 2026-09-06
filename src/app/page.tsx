import Link from "next/link";

import BoardProgress from "@/components/BoardProgress";
import DeckGrid from "@/components/DeckGrid";
import RootBoardBar from "@/components/RootBoardBar";
import { DECK_SIZE } from "@/lib/tiers";

export default function DeckPage() {
  return (
    <main className="mx-auto w-full max-w-5xl grow px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
          Toronto Parking
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink/70">
          Sixty numbered layouts to set up on the board. Pick one, place the pieces, then put the phone down and play.
        </p>
      </header>

      {/* No heading and no `aria-label`: the bar has two states and no name is
          true in both. "Have a board?" repeated the first three words of the
          field's own label a line below it, and in the remembered state it
          asked a question the reader had already answered. Unnamed, the box is
          a plain grouping element, and the content names itself — a labelled
          field, or the link to the remembered board. */}
      <section className="mb-8 rounded-2xl border border-ink/12 bg-ground-edge/60 px-4 py-4 sm:px-6">
        <RootBoardBar />
      </section>

      <div className="mb-10" data-board-progress>
        <BoardProgress />
      </div>

      <DeckGrid />

      <footer className="mt-16 border-t border-ink/10 pt-6 text-sm text-ink/60">
        <p>
          {DECK_SIZE} cards, ordered easiest to hardest.{" "}
          <Link href="/about" className="underline underline-offset-4">
            About this set
          </Link>
        </p>
      </footer>
    </main>
  );
}
