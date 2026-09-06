"use client";

import { useEffect } from "react";

import { getBoard, nextCard, solvedCards } from "@/lib/local";
import { DECK_SIZE } from "@/lib/tiers";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * Paints solved state onto the prerendered deck tiles, which carry
 * `data-card="<n>"`, and renders the sticky pick-up line. The grid itself stays
 * static: this only adds a `data-solved` attribute the stylesheet reads.
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
    const marked = new Set(solved);
    for (const tile of document.querySelectorAll<HTMLElement>("[data-card]")) {
      const n = Number(tile.dataset.card);
      if (!Number.isInteger(n)) continue;
      if (marked.has(n)) tile.dataset.solved = "true";
      else delete tile.dataset.solved;
    }
    // `solved` is derived from the mirror, and `version` steps on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, code]);

  if (version === 0) return null;

  return (
    <div data-board-progress="">
      {next !== null ? <p data-pick-up={next}>Pick up at #{next}</p> : null}
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
