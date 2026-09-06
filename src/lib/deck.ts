import "server-only";

import deckJson from "../../data/deck.json";
import type { Card, Deck } from "./types";

/**
 * The deck, server-side only. `import 'server-only'` is the guard that keeps
 * sixty stored solutions out of every client chunk; client components read the
 * deck size and tier names from `tiers.ts` instead.
 */
export const deck = deckJson as unknown as Deck;

export const cards: Card[] = deck.cards;

export function cardByNumber(n: number): Card | undefined {
  return cards[n - 1]?.n === n ? cards[n - 1] : cards.find((c) => c.n === n);
}
