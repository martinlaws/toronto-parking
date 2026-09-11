import Link from "next/link";
import type { Route } from "next";

import Board from "@/components/Board";
import DeckScore from "@/components/DeckScore";
import { cards } from "@/lib/deck";
import { BANDS, CARDS_PER_TIER, TIERS, tierLabel } from "@/lib/tiers";
import type { Card, Tier } from "@/lib/types";

/**
 * The deck: five tier sections, sixty entries, no filters. A Server Component,
 * prerendered, shared by `/` and `/b/[code]`.
 *
 * An entry is a line and not a tile, because the thing a reader wants from
 * sixty of them is a comparison: par against what it actually took. A line can
 * hold two figures in columns that stay in line down all sixty; a tile cannot.
 *
 * Every entry still carries `data-card="<n>"`, which is the only hook the
 * solved overlay touches: `BoardProgress` paints `data-solved` and `data-yours`
 * onto markup already on the page instead of re-rendering the grid, and
 * `DeckScore` reads those back to fill the results, the tallies and the rail.
 * The counts stay downstream of two attributes and this file stays a Server
 * Component, which is what keeps sixty stored solutions out of the bundle.
 *
 * `data-par` is the one addition, and it is a deliberate exposure: par is
 * already printed on every card page and beside every entry here, so sixty par
 * integers in the HTML tell a reader nothing the page does not. Nothing else
 * from `deck.json` follows it out.
 */

/**
 * The one place a tier is a colour rather than a rank. It cannot be the card's
 * own colours — a board is whatever its layout needs — so the swatch is the
 * fixed palette read as a ladder, from the calmest piece in the box to the
 * asphalt under all of them. `CardHeader` still gives a card's tier a rank and
 * a name and no colour, and both are true: there the tier is a fact about one
 * board, and here it is a divider between five runs of twelve.
 *
 * Class names rather than colour values, and that is load-bearing: Tailwind
 * emits a theme colour's custom property only where it can see the token in
 * use, so a `var(--color-car-blue)` handed in through `style` compiles to a
 * variable that was never written and a swatch that never appears.
 */
const SWATCHES: Record<Tier, { fill: string; core?: true }> = {
  beginner: { fill: "bg-car-blue" },
  intermediate: { fill: "bg-car-green" },
  advanced: { fill: "bg-car-yellow" },
  expert: { fill: "bg-hero" },
  grandmaster: { fill: "bg-asphalt", core: true },
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The key over each column, repeated rather than spanned: two columns of
 * figures 22px apart read as two tables, and one header between them would
 * belong to neither. Hidden from the accessibility tree because every entry
 * names its own figures, and a header with no table to attach to would arrive
 * twice with nothing under it.
 */
function ColumnKey() {
  return (
    <div className="tp-key">
      <span className="tp-key-card">Card</span>
      <i className="tp-leader" />
      <span className="tp-key-par">Par</span>
      <span className="tp-key-score">Yours</span>
    </div>
  );
}

/**
 * One card. The plate is the whole reason the deck is browsable — a layout is
 * recognised long before its number is read — and 58px is the floor for that
 * rather than a size to trim when the row feels tall.
 *
 * The three result states live in `globals.css` and all three occupy the same
 * 24px box: a ringed figure at par, a plain one over it, a short rule when
 * there is no number yet. Each has a word riding the same attribute the mark
 * does, so the link reads "1, solved, par 5, your moves 5, at par" rather than
 * three bare figures.
 */
function Entry({ card }: { card: Card }) {
  return (
    <li>
      <Link
        href={`/cards/${card.n}` as Route}
        data-card={card.n}
        data-par={card.moves}
        className="tp-entry focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="tp-entry-plate">
          <Board card={card} mode="thumb" className="size-full" />
        </span>
        <span className="tp-entry-n">
          {card.n}
          <span data-solved-mark="" className="sr-only">
            , solved
          </span>
        </span>
        <i className="tp-leader" />
        <span className="sr-only">, par </span>
        <span className="tp-entry-par">{card.moves}</span>
        <span className="tp-entry-score">
          <span data-yours-label="" className="sr-only">
            , your moves{" "}
          </span>
          <span data-yours-figure="" />
        </span>
        <span data-at-par-mark="" className="sr-only">
          , at par
        </span>
        <span data-uncounted-mark="" className="sr-only">
          , not counted yet
        </span>
      </Link>
    </li>
  );
}

export default function DeckGrid({ className }: { className?: string }) {
  // The measure is capped here rather than on the page, because the grid is
  // shared and the cap is a property of the grid: two columns of figures joined
  // by a leader hold their alignment at a phone's width and turn into sixty
  // runways at a desktop's. Four columns would fill the page instead, at the
  // cost of the 1-6 / 7-12 reading order inside a tier, which is a worse trade
  // than white space down the sides.
  const base = "mx-auto w-full max-w-xl";
  return (
    <div data-deck-grid="" className={className ? `${base} ${className}` : base}>
      <DeckScore />

      <div className="tp-contents-head">
        <h2>The sixty</h2>
        <span className="tp-contents-note">Card, par, and the moves it took you.</span>
      </div>

      <div className="tp-grid tp-key-row" aria-hidden="true">
        <ColumnKey />
        <ColumnKey />
      </div>

      {TIERS.map((tier, rank) => {
        const tierCards = cards.filter((c) => c.tier === tier);
        const [low, high] = BANDS[tier];
        const swatch = SWATCHES[tier];
        // Down one column and then down the next, so a tier reads 1-6 beside
        // 7-12 rather than 1-2 above 3-4.
        const split = Math.ceil(tierCards.length / 2);
        return (
          <section
            key={tier}
            data-tier={tier}
            aria-labelledby={`tier-${tier}`}
            className="mt-[15px]"
          >
            <div className="tp-tier-head">
              <span className="tp-tier-range">
                {pad(rank * CARDS_PER_TIER + 1)}–{pad((rank + 1) * CARDS_PER_TIER)}
              </span>
              <i
                className={`tp-tier-swatch ${swatch.fill}`}
                data-core={swatch.core ? "" : undefined}
                aria-hidden="true"
              />
              <h3 id={`tier-${tier}`} className="tp-tier-name">
                {tierLabel(tier)}
              </h3>
              <span className="tp-tier-band">
                par {low}–{high}
              </span>
              {/* The joining word is padding on the page and a real space in
                  the text, for the reason `DeckRail` gives at more length. */}
              <p className="tp-tally">
                <b data-tier-solved={tier} data-zero="">
                  0
                </b>
                <i aria-hidden="true">of</i>
                <span className="sr-only"> of </span>
                {tierCards.length}
              </p>
            </div>
            <div className="tp-grid">
              <ul>
                {tierCards.slice(0, split).map((card) => (
                  <Entry key={card.n} card={card} />
                ))}
              </ul>
              <ul>
                {tierCards.slice(split).map((card) => (
                  <Entry key={card.n} card={card} />
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
