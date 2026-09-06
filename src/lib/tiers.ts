import type { Tier } from "./types";

export type { Tier };

/** Never imports `deck.json`: client components take the deck size from here, so
 *  sixty solutions stay out of the browser bundle. */
export const DECK_SIZE = 60;

export const CARDS_PER_TIER = 12;

export const TIERS: readonly Tier[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "grandmaster",
] as const;

/** Move-count band per tier, inclusive at both ends. */
export const BANDS: Record<Tier, [number, number]> = {
  beginner: [5, 12],
  intermediate: [13, 20],
  advanced: [21, 29],
  expert: [30, 40],
  grandmaster: [41, 60],
};

/** The Toronto set, ordered by traffic misery. Ready to swap into TIER_LABELS. */
export const TORONTO_LABELS: Record<Tier, string> = {
  beginner: "Side Street",
  intermediate: "Bloor",
  advanced: "Spadina",
  expert: "The Gardiner",
  grandmaster: "The 401",
};

/** The one array copy reads. Nothing anywhere else spells a tier name. */
export const TIER_LABELS: Record<Tier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
  grandmaster: "Grand Master",
};

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
}
