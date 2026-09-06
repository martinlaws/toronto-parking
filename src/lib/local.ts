import { pickUpAt } from "./code";

/**
 * The device-local mirror. Every `localStorage` touch is wrapped, because a
 * phone in private mode throws on the first read and the page must still work:
 * a lost mirror costs one refresh, never a crash.
 *
 * `tp.board`          `{code, n, name, at}`
 * `tp.solved.<code>`  `{<card>: ISO}` mirror of the server hash
 * `tp.solved.local`   solves made before a board was claimed
 * `tp.outbox.<code>`  `[{op, card, at}]` writes waiting on the network
 */

export type StoredBoard = { code: string; n: number; name: string; at: string };

export type SolvedMap = Record<string, string>;

export type OutboxOp = { op: "put" | "del"; card: number; at: string };

export const BOARD_KEY = "tp.board";
export const LOCAL_SOLVED_KEY = "tp.solved.local";

export const solvedKeyFor = (code: string | null) =>
  code ? `tp.solved.${code}` : LOCAL_SOLVED_KEY;

export const outboxKeyFor = (code: string) => `tp.outbox.${code}`;

/** Fired on `window` whenever this module changes anything, so the toggle, the
 *  chip and the progress overlay on one page agree without a store. */
export const MIRROR_EVENT = "tp:mirror";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = store()?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked store is not an error the reader can act on.
  }
}

function drop(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // As above.
  }
}

export function announce(): void {
  try {
    window.dispatchEvent(new Event(MIRROR_EVENT));
  } catch {
    // Server render, or a window that has gone away.
  }
}

// ── Guards ──────────────────────────────────────────────────────────────────

function isBoard(value: unknown): value is StoredBoard {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.name === "string";
}

function isSolvedMap(value: unknown): value is SolvedMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

function isOutbox(value: unknown): value is OutboxOp[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const e = entry as Record<string, unknown>;
      return (
        (e.op === "put" || e.op === "del") &&
        typeof e.card === "number" &&
        typeof e.at === "string"
      );
    })
  );
}

// ── The remembered board ────────────────────────────────────────────────────

export function getBoard(): StoredBoard | null {
  const board = read(BOARD_KEY, isBoard);
  if (!board) return null;
  return {
    code: board.code,
    n: typeof board.n === "number" ? board.n : 0,
    name: board.name,
    at: typeof board.at === "string" ? board.at : "",
  };
}

/**
 * Claiming a board for the first time carries every anonymous solve across with
 * its original timestamp, and queues each one so the other boards see it.
 */
export function setBoard(board: Omit<StoredBoard, "at"> & { at?: string }): void {
  const stored: StoredBoard = {
    code: board.code,
    n: board.n,
    name: board.name,
    at: board.at ?? new Date().toISOString(),
  };
  write(BOARD_KEY, stored);
  adoptLocalSolves(stored.code);
  announce();
}

export function adoptLocalSolves(code: string): void {
  const local = getSolved(null);
  const entries = Object.entries(local);
  if (entries.length === 0) return;
  const mine = getSolved(code);
  for (const [card, at] of entries) {
    const existing = mine[card];
    if (!existing || at < existing) mine[card] = at;
    queue(code, { op: "put", card: Number(card), at });
  }
  setSolved(code, mine);
  drop(LOCAL_SOLVED_KEY);
}

// ── Solves ──────────────────────────────────────────────────────────────────

export function getSolved(code: string | null): SolvedMap {
  return read(solvedKeyFor(code), isSolvedMap) ?? {};
}

export function setSolved(code: string | null, map: SolvedMap): void {
  write(solvedKeyFor(code), map);
}

export function isSolved(code: string | null, card: number): boolean {
  return typeof getSolved(code)[String(card)] === "string";
}

/** Paints the mirror before the network is asked, so the tap feels immediate. */
export function paintSolved(code: string | null, card: number, at: string): void {
  const map = getSolved(code);
  map[String(card)] = at;
  setSolved(code, map);
  announce();
}

export function paintUnsolved(code: string | null, card: number): void {
  const map = getSolved(code);
  delete map[String(card)];
  setSolved(code, map);
  announce();
}

/**
 * Adopts the server's list, then lays anything still waiting in the outbox back
 * over it. A queued write is one the server has not seen, so it cannot have been
 * contradicted: without this, adopting mid-replay takes the reader's own tick
 * off the deck while their write is still on its way. Last write wins at the
 * server, and there are no tombstones.
 */
export function adoptServerSolves(code: string, solved: { card: number; at: string }[]): void {
  const map: SolvedMap = {};
  for (const solve of solved) map[String(solve.card)] = solve.at;
  for (const pending of getOutbox(code)) {
    if (pending.op === "put") map[String(pending.card)] = pending.at;
    else delete map[String(pending.card)];
  }
  setSolved(code, map);
  announce();
}

export function solvedCards(code: string | null): number[] {
  return Object.keys(getSolved(code))
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
}

export function nextCard(code: string | null): number | null {
  return pickUpAt(solvedCards(code));
}

// ── The outbox ──────────────────────────────────────────────────────────────

export function getOutbox(code: string): OutboxOp[] {
  return read(outboxKeyFor(code), isOutbox) ?? [];
}

export function setOutbox(code: string, ops: OutboxOp[]): void {
  if (ops.length === 0) drop(outboxKeyFor(code));
  else write(outboxKeyFor(code), ops);
}

/** One pending write per card: a later tap replaces an earlier one, in place. */
export function queue(code: string, op: OutboxOp): void {
  const ops = getOutbox(code).filter((pending) => pending.card !== op.card);
  ops.push(op);
  setOutbox(code, ops);
}

/** Drops every pending write for one card, whichever way it went. */
export function dequeueCard(code: string, card: number): void {
  setOutbox(
    code,
    getOutbox(code).filter((pending) => pending.card !== card),
  );
}

export function unqueue(code: string, op: OutboxOp): void {
  setOutbox(
    code,
    getOutbox(code).filter((pending) => !(pending.card === op.card && pending.op === op.op)),
  );
}

// ── The network half ────────────────────────────────────────────────────────

/**
 * A tap paints the mirror, then asks the server. `2xx` adopts what came back;
 * a network error, a `429` or a `5xx` puts the write in the outbox; a `400` or
 * a `404` reverts, because the server will never accept that write.
 */

let holdUntil = 0;

/** True while a `Retry-After` from a 429 is still running. */
export function onHold(now: number = Date.now()): boolean {
  return now < holdUntil;
}

function hold(seconds: number): void {
  holdUntil = Date.now() + Math.max(1, seconds) * 1000;
}

type SendResult = "ok" | "retry" | "drop";

function adoptBody(code: string, body: unknown): void {
  if (!body || typeof body !== "object") return;
  const solved = (body as { solved?: unknown }).solved;
  if (!Array.isArray(solved)) return;
  adoptServerSolves(
    code,
    solved.filter(
      (entry): entry is { card: number; at: string } =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as { card: unknown }).card === "number" &&
        typeof (entry as { at: unknown }).at === "string",
    ),
  );
}

async function send(code: string, op: OutboxOp): Promise<SendResult> {
  const url = `/api/boards/${code}/solved/${op.card}`;
  try {
    const response =
      op.op === "put"
        ? await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ at: op.at }),
          })
        : await fetch(url, { method: "DELETE" });

    if (response.ok) {
      adoptBody(code, await response.json());
      return "ok";
    }
    if (response.status === 429) {
      hold(Number(response.headers.get("Retry-After")) || 60);
      return "retry";
    }
    if (response.status === 400 || response.status === 404) return "drop";
    return "retry";
  } catch {
    return "retry";
  }
}

/** One tap. `code` null means no board is claimed: the solve stays on the phone. */
export async function toggleSolve(
  code: string | null,
  card: number,
  want: boolean,
): Promise<void> {
  const previous = getSolved(code)[String(card)];
  const at = want ? new Date().toISOString() : (previous ?? new Date().toISOString());

  if (want) paintSolved(code, card, at);
  else paintUnsolved(code, card);
  if (!code) return;

  const op: OutboxOp = { op: want ? "put" : "del", card, at };

  // This tap contradicts anything still queued for the card, so that write goes
  // now rather than on the next flush: replaying it would put back a solve the
  // reader has just undone, on the phone and on every other board.
  dequeueCard(code, card);

  if (onHold()) {
    queue(code, op);
    return;
  }

  const result = await send(code, op);
  if (result === "retry") {
    queue(code, op);
  } else if (result === "drop") {
    if (want) paintUnsolved(code, card);
    else paintSolved(code, card, at);
  }
}

/** Pulls the server's list and adopts it. False when the store was unreachable. */
export async function pull(code: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/boards/${code}`, { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 429) hold(Number(response.headers.get("Retry-After")) || 60);
      return false;
    }
    adoptBody(code, await response.json());
    return true;
  } catch {
    return false;
  }
}

const running = new Map<string, Promise<boolean>>();

/**
 * On mount and on `online`: replay the outbox in order, then pull and adopt.
 * The card page and the deck page both start one, so a second call while the
 * first is still going joins it rather than replaying the same writes twice.
 */
export function flush(code: string): Promise<boolean> {
  const started = running.get(code);
  if (started) return started;
  const run = replay(code).finally(() => running.delete(code));
  running.set(code, run);
  return run;
}

async function replay(code: string): Promise<boolean> {
  if (onHold()) return false;
  for (const op of getOutbox(code)) {
    const result = await send(code, op);
    if (result === "retry") return false;
    unqueue(code, op);
    if (result === "drop") {
      // The server will never take this write, so the paint goes back with it.
      if (op.op === "put") paintUnsolved(code, op.card);
      else paintSolved(code, op.card, op.at);
    }
  }
  return pull(code);
}
