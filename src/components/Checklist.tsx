import { checklistParts } from "@/lib/board";
import type { Card } from "@/lib/types";

/**
 * Block 3: what comes out of the box and what stays in it. Both lists are
 * precomputed in `data/deck.json`, so the page does no arithmetic; the dot
 * separator is the one the whole site uses.
 */
export default function Checklist({ card }: { card: Card }) {
  const needs = checklistParts(card.needs, true);
  const stays = checklistParts(card.staysInBox, false);
  return (
    <section aria-labelledby="what-you-need" className="space-y-3">
      <h2 id="what-you-need" className="font-display text-2xl font-bold">
        What you need
      </h2>
      <p className="text-lg leading-relaxed">{needs.join(" · ")}</p>
      <p className="text-ink/65">
        Stays in the box: {stays.length ? stays.join(" · ") : "nothing"}
      </p>
      <p className="text-ink/65">Pylons don&apos;t move.</p>
    </section>
  );
}
