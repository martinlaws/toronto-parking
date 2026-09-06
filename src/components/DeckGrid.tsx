import Link from "next/link";
import type { Route } from "next";

import Board from "@/components/Board";
import TierProgress from "@/components/TierProgress";
import { cards } from "@/lib/deck";
import { TIERS, tierLabel } from "@/lib/tiers";

/**
 * The deck: five tier sections, sixty tiles, no filters. A Server Component,
 * prerendered, shared by `/` and `/b/[code]`.
 *
 * Every tile carries `data-card="<n>"`, which is the only thing lane C's
 * overlay touches: it paints `data-solved` onto markup already on the page
 * instead of re-rendering the grid. `TierProgress` reads those same tiles back
 * to fill each tier counter and bar, so the counts stay downstream of one
 * attribute and this file stays a Server Component.
 */
export default function DeckGrid({ className }: { className?: string }) {
  return (
    <div
      data-deck-grid=""
      className={className ? `space-y-12 ${className}` : "space-y-12"}
    >
      <TierProgress />
      {TIERS.map((tier) => {
        const tierCards = cards.filter((c) => c.tier === tier);
        return (
          <section key={tier} data-tier={tier} aria-labelledby={`tier-${tier}`}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id={`tier-${tier}`} className="font-display text-2xl font-bold">
                {tierLabel(tier)}
              </h2>
              <p className="text-sm tabular-nums text-ink/60">
                <span data-tier-solved={tier}>0</span> of {tierCards.length}
              </p>
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-ink/10">
              {/* No transition: the bar is set once, and rotate plus the
                  150ms fade are the only motion the page is allowed. */}
              <div
                data-tier-bar={tier}
                className="h-full rounded-full bg-glow"
                style={{ width: "0%" }}
              />
            </div>
            <ul className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {tierCards.map((card) => (
                <li key={card.n}>
                  <Link
                    href={`/cards/${card.n}` as Route}
                    data-card={card.n}
                    className="tp-fade group flex min-h-11 flex-col items-center gap-2 rounded-xl p-2 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span className="relative block size-14">
                      <Board card={card} mode="thumb" className="size-14 overflow-hidden rounded-md" />
                      {/* Hidden by a rule in globals.css until the tile takes
                          `data-solved`; `hidden` would need !important to undo.
                          The ring is ink, not ground: glow on the warm ground is
                          1.5:1, so a ground-coloured boundary left the only
                          per-tile indicator below WCAG 1.4.11. Ink against the
                          ground is 17.6:1, and the glow fill carries the other
                          side, where the disc overlaps the black thumbnail. */}
                      <span
                        data-solved-dot=""
                        className="absolute -right-1 -top-1 size-3 rounded-full bg-glow ring-2 ring-ink"
                      />
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {card.n}
                      {/* The dot's text equivalent, revealed by the same
                          attribute, so the link is named "1" until it is solved
                          and "1, solved" after. Without it a screen reader gets
                          sixty links named only by their number. */}
                      <span data-solved-mark="" className="sr-only">
                        , solved
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
