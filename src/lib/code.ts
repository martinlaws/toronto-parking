import { DECK_SIZE } from "./tiers";

/**
 * The code alphabet and the two validators, kept free of every store and Node
 * import so a `'use client'` component can hold them without dragging the Redis
 * client into the browser bundle. `boards.ts` re-exports all of it.
 */

/** Crockford base32, lowercase: no `i`, `l`, `o` or `u`, so nothing printed on a
 *  card gets mistyped into a different live board. */
export const CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Lowercases and folds the three look-alikes a reader can produce from print. */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll("o", "0")
    .replaceAll("i", "1")
    .replaceAll("l", "1");
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** An integer in 1..DECK_SIZE, or null. `"1.5"` and `"01"` are not card numbers. */
export function parseCard(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = String(raw).trim();
  if (!/^[1-9][0-9]*$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= DECK_SIZE ? n : null;
}

/**
 * The first unsolved card after the highest solved. Null at 0 and at DECK_SIZE.
 *
 * Deviation, deliberate: once the highest solved card is the last one and gaps
 * remain, there is no card after it, so the line falls back to the earliest gap
 * rather than disappearing. The spec hides it "at 0 or 60"; hiding it at 59 of
 * 60 as well would leave a reader with one card left and nothing pointing at it.
 */
export function pickUpAt(cards: Iterable<number>): number | null {
  const set = new Set<number>();
  for (const card of cards) if (Number.isInteger(card) && card >= 1 && card <= DECK_SIZE) set.add(card);
  if (set.size === 0 || set.size >= DECK_SIZE) return null;
  let furthest = 0;
  for (const card of set) if (card > furthest) furthest = card;
  for (let n = furthest + 1; n <= DECK_SIZE; n += 1) if (!set.has(n)) return n;
  for (let n = 1; n <= DECK_SIZE; n += 1) if (!set.has(n)) return n;
  return null;
}
