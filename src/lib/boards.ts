import { randomBytes } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";

import {
  CODE_ALPHABET,
  CODE_LENGTH,
  isValidCode,
  MAX_MOVES,
  normalizeCode,
  parseCard,
  parseMoves,
  pickUpAt,
} from "./code";
import { getRedis, k } from "./store";
import { DECK_SIZE } from "./tiers";

/**
 * Everything the board pages and the two route handlers share: the validators,
 * the derived panel numbers, the four store reads and writes, and the rate
 * limiter. The pure half sits above `getRedis()` and is exported separately so
 * the tests cover it without a live store.
 *
 * The code primitives live in `code.ts` because client components need them and
 * must not pull the Redis client into the browser bundle; they are re-exported
 * here so server code has one import.
 */

export {
  CODE_ALPHABET,
  CODE_LENGTH,
  isValidCode,
  MAX_MOVES,
  normalizeCode,
  parseCard,
  parseMoves,
  pickUpAt,
};

/** 30 bits, generated once and then permanent: the code is printed. */
export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (const byte of bytes) out += CODE_ALPHABET[byte & 31];
  return out;
}

// ── The moment of the tap ───────────────────────────────────────────────────

export type AtResult = { ok: true; at: string } | { ok: false };

/**
 * `at` is when the client saw the tap, so a replay after a night offline records
 * the solve and not the reconnect. Absent means now; a future stamp is clamped
 * to now rather than trusted; anything unparseable is a `bad_at`.
 */
export function resolveAt(raw: unknown, now: Date = new Date()): AtResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, at: now.toISOString() };
  }
  if (typeof raw !== "string" && typeof raw !== "number") return { ok: false };
  const when = new Date(raw);
  const ms = when.getTime();
  if (Number.isNaN(ms)) return { ok: false };
  return { ok: true, at: ms > now.getTime() ? now.toISOString() : when.toISOString() };
}

// ── The number of moves it took ─────────────────────────────────────────────

export type MovesResult = { ok: true; moves: number | null } | { ok: false };

/**
 * The count a reader types against par. Null is not zero: it means the write
 * carries no count and whatever is stored stays, which is what lets a plain tick
 * and a replayed tick both leave an earlier number alone.
 *
 * Absence therefore cannot be an error, so an emptied field records nothing
 * rather than clearing anything. Removing a count is a different write and does
 * not exist yet; a `0` sentinel for it would be indistinguishable from a bug.
 */
export function resolveMoves(raw: unknown): MovesResult {
  if (raw === undefined || raw === null || raw === "") return { ok: true, moves: null };
  const moves = parseMoves(raw);
  return moves === null ? { ok: false } : { ok: true, moves };
}

// ── Shapes ──────────────────────────────────────────────────────────────────

export type Solve = { card: number; at: string; moves?: number };

export type Board = {
  code: string;
  n: number;
  name: string;
  dedication: string;
  createdAt: string;
};

export type BoardRecord = Board & { solved: Solve[] };

export type PanelRow = {
  code: string;
  n: number;
  name: string;
  solved: number;
  furthest: number;
  lastAt: string | null;
  you: boolean;
};

type RawHash = Record<string, unknown> | null;

// ── Derivation, all pure ────────────────────────────────────────────────────

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

/**
 * The count lives in a second field rather than packed into the value beside the
 * moment, because the two want opposite write policies: the moment is `HSETNX`
 * and never moves, the count is `HSET` and is a thing a person corrects. One
 * string can only have one policy.
 *
 * Keeping them apart is also what makes the change invisible in both directions.
 * `parseCard` rejects `m:31`, so a reader that predates the count skips the
 * field the way it already skips every other non-card one, and a reader that
 * expects it finds none in a hash that has never had one.
 */
const MOVES_PREFIX = "m:";

export const movesField = (card: number) => `${MOVES_PREFIX}${card}`;

/**
 * The hash is `<card>` → ISO, plus `m:<card>` → count. Fields that are neither
 * are ignored, and a count is read in a second pass because hash fields arrive
 * in no particular order: on one pass `m:31` could be read before card 31.
 *
 * A count with no solve beside it is an orphan and is dropped rather than
 * inventing a solve, so `summarise().count` cannot be inflated by one. A count
 * that does not parse is dropped rather than surfaced as `NaN`.
 */
export function solvesFromHash(hash: RawHash): Solve[] {
  if (!hash) return [];
  const byCard = new Map<number, Solve>();
  for (const [field, value] of Object.entries(hash)) {
    const card = parseCard(field);
    if (card === null) continue;
    const at = text(value);
    if (at === "") continue;
    byCard.set(card, { card, at });
  }
  for (const [field, value] of Object.entries(hash)) {
    if (!field.startsWith(MOVES_PREFIX)) continue;
    const card = parseCard(field.slice(MOVES_PREFIX.length));
    if (card === null) continue;
    const solve = byCard.get(card);
    if (!solve) continue;
    const moves = parseMoves(text(value));
    if (moves !== null) solve.moves = moves;
  }
  return [...byCard.values()].sort((a, b) => a.card - b.card);
}

export function boardFromHash(code: string, hash: RawHash): Board | null {
  if (!hash || Object.keys(hash).length === 0) return null;
  const n = Number(text(hash.n, "0"));
  return {
    code,
    n: Number.isInteger(n) ? n : 0,
    name: text(hash.name),
    dedication: text(hash.dedication),
    createdAt: text(hash.createdAt),
  };
}

/** Count, furthest card and last solve, computed here rather than stored. */
export function summarise(solved: Solve[]): {
  count: number;
  furthest: number;
  lastAt: string | null;
} {
  let furthest = 0;
  let lastAt: string | null = null;
  for (const solve of solved) {
    if (solve.card > furthest) furthest = solve.card;
    if (lastAt === null || solve.at > lastAt) lastAt = solve.at;
  }
  return { count: solved.length, furthest, lastAt };
}

/** Furthest card first, then count, ties by name. */
export function sortPanel(rows: PanelRow[]): PanelRow[] {
  return [...rows].sort(
    (a, b) =>
      b.furthest - a.furthest ||
      b.solved - a.solved ||
      a.name.localeCompare(b.name) ||
      a.code.localeCompare(b.code),
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/** Relative time in plain words. Never abbreviates and never says "fortnight". */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "nothing yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "nothing yet";
  const ms = Math.max(0, now.getTime() - then);
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  if (ms < WEEK) return plural(Math.floor(ms / DAY), "day");
  if (ms < 8 * WEEK) return plural(Math.floor(ms / WEEK), "week");
  return plural(Math.max(1, Math.floor(ms / (30 * DAY))), "month");
}

/**
 * `{name} · card {furthest} · {solved} of {deckSize} · {relative time}`, the
 * spec's fixed four-cell row.
 *
 * A board with nothing solved keeps the shape and fills the cell with words,
 * matching the register the time cell already uses for absence: every board
 * starts at zero, so dropping the cell would leave all four rows three cells
 * wide at launch and reshape them one at a time as people started solving.
 * There is no card 0, so the number is not an option.
 */
export function panelRowText(row: PanelRow, now: Date = new Date()): string {
  const furthest = row.furthest === 0 ? "no card yet" : `card ${row.furthest}`;
  return `${row.name} · ${furthest} · ${row.solved} of ${DECK_SIZE} · ${relativeTime(row.lastAt, now)}`;
}

// ── Keys ────────────────────────────────────────────────────────────────────

export const boardsKey = () => k("boards");
export const boardKey = (code: string) => k(`board:${code}`);
export const solvedKey = (code: string) => k(`board:${code}:solved`);

// ── Store reads and writes ──────────────────────────────────────────────────

/** Two `HGETALL`s in one pipeline. Null when the board hash does not exist. */
export async function readBoard(code: string): Promise<BoardRecord | null> {
  if (!isValidCode(code)) return null;
  const [hash, solvedHash] = await getRedis()
    .pipeline()
    .hgetall<Record<string, unknown>>(boardKey(code))
    .hgetall<Record<string, unknown>>(solvedKey(code))
    .exec();
  const board = boardFromHash(code, hash);
  if (!board) return null;
  return { ...board, solved: solvesFromHash(solvedHash) };
}

/** `SMEMBERS boards`, then one pipelined `HGETALL` pair per board. Never `KEYS`. */
export async function readPanel(myCode: string | null): Promise<PanelRow[]> {
  const redis = getRedis();
  const codes = (await redis.smembers(boardsKey())).map(String).filter(isValidCode);
  if (codes.length === 0) return [];
  codes.sort();

  const pipeline = redis.pipeline();
  for (const code of codes) {
    pipeline.hgetall<Record<string, unknown>>(boardKey(code));
    pipeline.hgetall<Record<string, unknown>>(solvedKey(code));
  }
  const results = (await pipeline.exec()) as RawHash[];

  const rows: PanelRow[] = [];
  codes.forEach((code, i) => {
    const board = boardFromHash(code, results[i * 2]);
    if (!board) return;
    const { count, furthest, lastAt } = summarise(solvesFromHash(results[i * 2 + 1]));
    rows.push({
      code,
      n: board.n,
      name: board.name,
      solved: count,
      furthest,
      lastAt,
      you: code === myCode,
    });
  });
  return sortPanel(rows);
}

/** One `EXISTS`. Used before a write so a probe cannot mint a fifth board. */
export async function boardExists(code: string): Promise<boolean> {
  if (!isValidCode(code)) return false;
  return (await getRedis().exists(boardKey(code))) > 0;
}

/**
 * `HSETNX` keeps the first value, so a replay never moves an earlier solve. The
 * count is the opposite and is written with `HSET`: a reader who miscounts and
 * types again means the second number, and a stale replay of the first one
 * cannot arrive after it because the outbox holds one write per card.
 *
 * A null count writes nothing at all, which is what makes the whole `PUT`
 * idempotent: replaying a tick made before anyone typed a number leaves the
 * number that was typed afterwards alone.
 */
export async function markSolved(
  code: string,
  card: number,
  at: string,
  moves: number | null = null,
): Promise<Solve[]> {
  const key = solvedKey(code);
  const pipeline = getRedis().pipeline();
  pipeline.hsetnx(key, String(card), at);
  if (moves !== null) pipeline.hset(key, { [movesField(card)]: String(moves) });
  pipeline.hgetall<Record<string, unknown>>(key);
  // The read is taken from the end rather than a fixed index: the conditional
  // write in the middle is what decides whether it sits at 1 or at 2.
  const results = (await pipeline.exec()) as RawHash[];
  return solvesFromHash(results[results.length - 1] ?? null);
}

/** Both fields go, or an untick would leave a count to reattach itself to the
 *  next solve of the same card. */
export async function unmarkSolved(code: string, card: number): Promise<Solve[]> {
  const [, hash] = await getRedis()
    .pipeline()
    .hdel(solvedKey(code), String(card), movesField(card))
    .hgetall<Record<string, unknown>>(solvedKey(code))
    .exec();
  return solvesFromHash(hash);
}

// ── Rate limit ──────────────────────────────────────────────────────────────

let limiter: Ratelimit | undefined;

/** Lazy for the same reason `getRedis()` is. */
export function getRatelimit(): Ratelimit {
  limiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:boards",
    analytics: false,
  });
  return limiter;
}

/** The first hop in `x-forwarded-for`, which is what Vercel sets. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

/** Whole seconds until the window resets, never below 1. */
export function retryAfterSeconds(reset: number, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((reset - now) / 1000));
}
