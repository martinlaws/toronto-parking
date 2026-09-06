import Link from "next/link";
import type { Route } from "next";

import Board from "@/components/Board";
import { cards } from "@/lib/deck";
import { TIERS, tierLabel } from "@/lib/tiers";

/**
 * The deck: five tier sections, sixty tiles, no filters. A Server Component,
 * prerendered, shared by `/` and `/b/[code]`.
 *
 * Every tile carries `data-card="<n>"`, and every section the counters lane C
 * writes into, so the client overlay paints solved state onto markup that is
 * already on the page instead of re-rendering the grid.
 */
export default function DeckGrid({ className }: { className?: string }) {
  return (
    <div className={className ? `space-y-12 ${className}` : "space-y-12"}>
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
              <div
                data-tier-bar={tier}
                className="tp-fade h-full rounded-full bg-glow"
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
                      <span
                        data-solved-dot
                        hidden
                        className="absolute -right-1 -top-1 size-3 rounded-full bg-glow ring-2 ring-ground"
                      />
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {card.n}
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
