import Link from "next/link";

import DeckGrid from "@/components/DeckGrid";
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

      <section
        aria-labelledby="have-a-board"
        className="mb-8 rounded-2xl border border-ink/12 bg-ground-edge/60 px-4 py-4 sm:px-6"
      >
        <h2 id="have-a-board" className="font-display text-lg font-bold">
          Have a board?
        </h2>
        {/* Lane C: <RootBoardBar /> goes here — the code field, or the remembered-board chip. It replaces the line below. */}
        <p className="mt-1 text-ink/70">Enter the code from the card in the box.</p>
      </section>

      {/* Lane C: <BoardProgress /> goes here — it paints solved state onto the tiles below. */}
      <div className="mb-10" data-board-progress />

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
