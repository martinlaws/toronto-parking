import { TIERS, tierLabel } from "@/lib/tiers";
import type { Card } from "@/lib/types";

import { CardResult, META_KEY } from "./SolveToggle";

/**
 * A 1-5 pip row in ink: tiers get a rank, never a colour.
 *
 * The deck's tier head is the one place a tier is a colour, and the reason it
 * is one there does not reach here: there the swatch divides five runs of
 * twelve, and colour is what an eye sorts a long list by. On one card the tier
 * is a single fact about a single board, and where that board sits in a ladder
 * of five is the part of it a reader can use.
 */
function Pips({ tier }: { tier: Card["tier"] }) {
  const filled = TIERS.indexOf(tier) + 1;
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= filled
              ? "size-1.5 rounded-full bg-ink"
              : "size-1.5 rounded-full border border-ink/30"
          }
        />
      ))}
    </span>
  );
}

/**
 * The opener: the number in a ring, and beside it a three-row meta block that
 * is this card's line on the scorecard — tier, par, and what it took you.
 *
 * The ring is the page's one round thing, and it is the same mark the deck
 * draws around a result at par at eight times the size. It is filled whether or
 * not the card is solved, because here the number is the card's name rather
 * than its state; the stamp in the running head and the score row below are
 * what carry the state.
 *
 * The rules between the rows mean what their weights mean elsewhere in the
 * design: 1.5px of ink above par, which is the head of a table, and a hairline
 * above the result, which is another row of it. `Yours` is mirror state and
 * arrives after hydration, so it is last and adds a row rather than moving one.
 */
export default function CardHeader({ card }: { card: Card }) {
  return (
    <header className="flex items-center gap-[17px] pt-[22px]">
      <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-accent-pale shadow-[inset_0_0_0_2.5px_var(--color-accent)]">
        <h1 className="tp-label text-[47px] leading-none font-bold tracking-[-0.04em] text-accent tabular-nums lining-nums">
          <span aria-hidden="true">{card.n}</span>
          <span className="sr-only">Card {card.n}</span>
        </h1>
      </div>

      <div className="min-w-0 flex-auto">
        {/* It wraps for the same reason the deck's tier head does: the longest
            tier name, a key and a rank together outrun a 320px phone once the
            96px ring has taken its share, and a name on a second line reads
            better than a name clipped. */}
        <div className="flex min-h-[22px] flex-wrap items-center gap-2">
          <span className={META_KEY}>Tier</span>
          <Pips tier={card.tier} />
          <span className="text-[12px] tracking-[0.1em] text-ink uppercase [font-variation-settings:'wdth'_92,'wght'_650]">
            {tierLabel(card.tier)}
          </span>
        </div>

        <div className="mt-[7px] flex items-baseline gap-2 border-t-[1.5px] border-t-ink pt-2 [--tp-leader-drop:5px]">
          <span className={META_KEY}>Par</span>
          <i className="tp-leader" aria-hidden="true" />
          <span className="text-[23px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums lining-nums">
            {card.moves}
          </span>
        </div>

        <CardResult card={card.n} par={card.moves} />
      </div>
    </header>
  );
}
