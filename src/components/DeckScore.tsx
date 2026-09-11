"use client";

import { useEffect } from "react";

/**
 * Fills in the result beside every card, the five tier tallies, and the rail.
 *
 * It reads the deck's own markup and nothing else. `DeckGrid` is a Server
 * Component that ships `data-card` and `data-par` on all sixty links;
 * `BoardProgress` paints `data-solved` and `data-yours` onto them from the
 * mirror. This walks those attributes and writes text, which is what keeps the
 * deck static, the grid a Server Component, and the question of which board is
 * being looked at in exactly one place.
 *
 * So it is a second writer but never a competing one: `BoardProgress` owns the
 * two attributes that come from stored state and this owns `data-at-par` and
 * every figure derived from them. The observer watches only the other one's
 * pair, so its own writes cannot start a second pass.
 *
 * With nothing solved, with no rail on the page, or with no JavaScript at all,
 * the prerendered zeros and ruled blanks are already the right answer.
 */
export default function DeckScore() {
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-deck-grid]");
    if (!grid) return;
    const sections = Array.from(grid.querySelectorAll<HTMLElement>("[data-tier]"));
    if (sections.length === 0) return;

    // The rail is on the deck page and need not be anywhere else, so every
    // read of it is optional. Its ticks are indexed once rather than queried
    // sixty times a pass.
    const rail = document.querySelector<HTMLElement>("[data-deck-rail]");
    const ticks = new Map<string, HTMLElement>();
    for (const tick of rail?.querySelectorAll<HTMLElement>("[data-rail-tick]") ?? []) {
      ticks.set(tick.dataset.railTick ?? "", tick);
    }

    /** A count is worth having only when there is a solve to hang it on. */
    const countOf = (entry: HTMLElement): number | null => {
      if (entry.dataset.solved !== "true") return null;
      const raw = entry.dataset.yours;
      if (raw === undefined) return null;
      const moves = Number(raw);
      return Number.isInteger(moves) && moves > 0 ? moves : null;
    };

    /** `0` is a real tally and `--blank` is 1.7:1, so a zero says so in words
     *  as well as in colour and takes the readable grey either way. */
    const tally = (figure: HTMLElement | null, value: number) => {
      if (!figure) return;
      figure.textContent = String(value);
      if (value === 0) figure.dataset.zero = "";
      else delete figure.dataset.zero;
    };

    const paint = () => {
      let solvedAll = 0;
      let counted = 0;
      let against = 0;

      for (const section of sections) {
        const tier = section.dataset.tier ?? "";
        let solvedHere = 0;

        for (const entry of section.querySelectorAll<HTMLElement>("[data-card]")) {
          const solved = entry.dataset.solved === "true";
          const par = Number(entry.dataset.par);
          const moves = countOf(entry);
          if (solved) solvedHere += 1;

          const figure = entry.querySelector<HTMLElement>("[data-yours-figure]");
          if (figure) figure.textContent = moves === null ? "" : String(moves);

          // The ring and its word both hang off this one attribute, so they
          // cannot disagree. Par comes off the markup, so a card whose
          // attribute is missing or unparseable is never called level with it.
          if (moves !== null && Number.isInteger(par) && moves === par) entry.dataset.atPar = "";
          else delete entry.dataset.atPar;

          if (moves !== null && Number.isInteger(par)) {
            counted += 1;
            against += moves - par;
          }

          const tick = ticks.get(entry.dataset.card ?? "");
          if (tick) {
            if (solved) tick.dataset.on = "";
            else delete tick.dataset.on;
          }
        }

        solvedAll += solvedHere;
        tally(section.querySelector<HTMLElement>("[data-tier-solved]"), solvedHere);
        tally(rail?.querySelector<HTMLElement>(`[data-rail-key="${tier}"]`) ?? null, solvedHere);
      }

      const total = rail?.querySelector<HTMLElement>("[data-rail-solved]");
      if (total) total.textContent = String(solvedAll);

      const diff = rail?.querySelector<HTMLElement>("[data-rail-diff]");
      if (!diff) return;
      const figure = diff.querySelector<HTMLElement>("[data-rail-diff-figure]");
      const word = diff.querySelector<HTMLElement>("[data-rail-diff-word]");

      // A deck with solves but no counts falls here too, and it should: `+0`
      // would claim sixty cards had come in level with par. The rule says the
      // same thing the rule beside an uncounted card says, one step wider.
      if (counted === 0) {
        diff.dataset.empty = "";
        if (figure) figure.textContent = "";
        if (word) word.textContent = "nothing counted yet";
        return;
      }

      delete diff.dataset.empty;
      const over = Math.abs(against);
      if (figure) figure.textContent = against === 0 ? "E" : against > 0 ? `+${over}` : `−${over}`;
      if (word) {
        word.textContent =
          against === 0
            ? "level with par"
            : against > 0
              ? `${over} over par`
              : `${over} under par`;
      }
    };

    paint();
    const observer = new MutationObserver(paint);
    observer.observe(grid, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-solved", "data-yours"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
