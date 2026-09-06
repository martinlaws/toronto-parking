import { TIERS, tierLabel } from "@/lib/tiers";
import type { Card } from "@/lib/types";

/** A 1-5 pip row in ink: tiers get a rank, never a colour. */
function Pips({ tier }: { tier: Card["tier"] }) {
  const filled = TIERS.indexOf(tier) + 1;
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
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
 * Block 1: the number very large in the display face, the tier as a rank and a
 * name, and par. Par is the only difficulty tell in v1 and stays true once
 * hints exist.
 */
export default function CardHeader({ card }: { card: Card }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h1 className="font-display text-[96px] leading-[0.85] font-extrabold tracking-tight">
        <span aria-hidden="true">#{card.n}</span>
        <span className="sr-only">Card {card.n}</span>
      </h1>
      <div className="flex flex-col items-start gap-2 pb-2 sm:items-end">
        {/* Lane C: <SolvedChip n={card.n} /> goes here, in the header. */}
        <div className="flex items-center gap-2 text-sm">
          <Pips tier={card.tier} />
          <span className="font-medium">{tierLabel(card.tier)}</span>
        </div>
        <p className="font-display text-2xl font-bold">Par {card.moves}</p>
      </div>
    </header>
  );
}
