"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect } from "react";

import { entryMoves, getBoard, getSolved, nextCard, solvedCards } from "@/lib/local";
import { DECK_SIZE } from "@/lib/tiers";
import { CONTROL } from "@/lib/ui";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * The bar the chip rides in. It is the component's own outermost element on
 * purpose: `sticky` is bounded by its containing block, so a chip nested in a
 * short wrapper would have nowhere to travel and would sit still. `bg-ground`
 * and the negative gutters give it something opaque to hold, edge to edge,
 * while the deck scrolls under it.
 */
export const PICK_UP_BAR =
  "sticky top-0 z-10 -mx-4 mb-8 space-y-3 bg-ground px-4 py-3 sm:-mx-6 sm:px-6";

/**
 * The pick-up chip: the step from a board's home to the next card, and the one
 * tap target a recipient who has just scanned the QR is looking for. Pure and
 * exported so a test can read the href and the touch target back without a DOM.
 *
 * `as Route` because `typedRoutes` is on and the number is only known at run
 * time, exactly as the deck tiles do it.
 */
export function PickUp({ next }: { next: number }) {
  return (
    <Link href={`/cards/${next}` as Route} className={CONTROL} data-pick-up={next}>
      Pick up at #{next}
    </Link>
  );
}

/**
 * Paints solved state onto the prerendered deck entries, which carry
 * `data-card="<n>"`, and renders the sticky pick-up line. The grid itself stays
 * static: this only adds the two attributes the stylesheet and `DeckScore`
 * read, `data-solved` and `data-yours`.
 *
 * It is the only component on the deck page that touches `localStorage`, which
 * is why the move count is painted here rather than read again downstream: one
 * reader of the mirror, one resolution of which board is being looked at, and
 * everything after it is derived from the markup.
 *
 * `code` is passed on a board page. Everywhere else it falls back to the
 * remembered board, and to the anonymous mirror when there is none.
 */
export default function BoardProgress({ code: given }: { code?: string }) {
  const version = useMirror();

  const code = version === 0 ? null : (given ?? getBoard()?.code ?? null);
  const solved = version === 0 ? [] : solvedCards(code);
  const next = version === 0 ? null : nextCard(code);
  const reachable = useSync(code);

  useEffect(() => {
    if (version === 0) return;
    const mirror = getSolved(code);
    const marked = new Set(solved);
    for (const tile of document.querySelectorAll<HTMLElement>("[data-card]")) {
      const n = Number(tile.dataset.card);
      if (!Number.isInteger(n)) continue;
      if (marked.has(n)) tile.dataset.solved = "true";
      else delete tile.dataset.solved;
      // Separate attributes because they are separate facts: a card is ticked
      // the moment it is solved and counted whenever the reader gets round to
      // typing a number, and a solve with no count against it must not read as
      // a solve in zero moves. Absent means absent, which is what the ruled
      // blank in the result column says.
      const moves = entryMoves(mirror[String(n)]);
      if (moves === null) delete tile.dataset.yours;
      else tile.dataset.yours = String(moves);
    }
    // `solved` is derived from the mirror, and `version` steps on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, code]);

  if (version === 0) return null;

  // Only the chip earns the sticky treatment. With no chip the block is a
  // notice or two, and a notice pinned over the deck would be noise.
  return (
    <div data-board-progress="" className={next !== null ? PICK_UP_BAR : "mb-8 space-y-3"}>
      {next !== null ? <PickUp next={next} /> : null}
      {solved.length === 0 ? <p>Nothing solved yet. Card 1 is the place to start.</p> : null}
      {solved.length >= DECK_SIZE ? (
        <p>
          That&apos;s the whole deck. Endless mode is on the list; for now, hand the board to
          someone else.
        </p>
      ) : null}
      {code && !reachable ? (
        <p data-store="unreachable">
          Saved on this phone. It&apos;ll reach the other boards when you&apos;re back online.
        </p>
      ) : null}
    </div>
  );
}
