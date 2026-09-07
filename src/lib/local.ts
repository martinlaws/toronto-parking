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
 *
 * Both directions then get a send. Queueing alone leaves the carried solves
 * sitting until something remounts with this code, and the board being switched
 * away from keeps its pending writes for good: no page the reader is likely to
 * open next syncs a code that is no longer `tp.board`.
 */
export function setBoard(board: Omit<StoredBoard, "at"> & { at?: string }): void {
  const previous = getBoard()?.code;
  const stored: StoredBoard = {
    code: board.code,
    n: board.n,
    name: board.name,
    at: board.at ?? new Date().toISOString(),
  };
  write(BOARD_KEY, stored);
  const carried = adoptLocalSolves(stored.code);
  announce();

  if (previous && previous !== stored.code && getOutbox(previous).length > 0) {
    void flush(previous);
  }
  if (carried) void flush(stored.code);
}

/** True when it carried something across, so the caller knows to send. */
export function adoptLocalSolves(code: string): boolean {
  const local = getSolved(null);
  const entries = Object.entries(local);
  if (entries.length === 0) return false;
  const mine = getSolved(code);
  for (const [card, at] of entries) {
    const existing = mine[card];
    if (!existing || at < existing) mine[card] = at;
    queue(code, { op: "put", card: Number(card), at });
  }
  setSolved(code, mine);
  drop(LOCAL_SOLVED_KEY);
  return true;
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
 * Adopts the server's list, then lays every write the server cannot have seen
 * yet back over it. Such a write cannot have been contradicted, so without this
 * an adopt mid-replay takes the reader's own tick off the deck while their
 * write is still on its way. Last write wins at the server, and there are no
 * tombstones.
 */
export function adoptServerSolves(code: string, solved: { card: number; at: string }[]): void {
  const map: SolvedMap = {};
  for (const solve of solved) map[String(solve.card)] = solve.at;
  for (const pending of pendingWrites(code)) {
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

/** Drops one exact write, leaving a newer one for the same card alone. */
export function unqueue(code: string, op: OutboxOp): void {
  setOutbox(
    code,
    getOutbox(code).filter((pending) => !isSameOp(pending, op)),
  );
}

function isSameOp(a: OutboxOp, b: OutboxOp): boolean {
  return a.card === b.card && a.op === b.op && a.at === b.at;
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

type OpenWrite = { op: OutboxOp; done: Promise<SendResult> };

/**
 * Writes that have left the outbox and are open on the network, one per card
 * per board. The outbox on its own is not the whole of "what the server has not
 * seen yet": between `dequeueCard()` and the response a write is in neither
 * place, and both `adoptServerSolves()` and `replay()` have to account for it.
 */
const inFlight = new Map<string, Map<number, OpenWrite>>();

/**
 * Every write the server's list cannot reflect yet. The outbox comes last: a
 * queued write for a card that already has one on the wire is the later tap.
 */
function pendingWrites(code: string): OutboxOp[] {
  const open = [...(inFlight.get(code)?.values() ?? [])].map((write) => write.op);
  return [...open, ...getOutbox(code)];
}

/**
 * True when a later tap has replaced this queued write or put one for the same
 * card on the wire. Sending it then would put back a solve the reader has just
 * undone, on the phone, in the store and on every other board's panel.
 */
function superseded(code: string, op: OutboxOp): boolean {
  if (inFlight.get(code)?.has(op.card)) return true;
  return !getOutbox(code).some((pending) => isSameOp(pending, op));
}

/**
 * `send()`, on the record for as long as it is open. A second write to the same
 * card waits for the first rather than racing it: two open at once and the
 * store keeps whichever landed last, which need not be the tap the reader made
 * last.
 */
function sendPending(code: string, op: OutboxOp): Promise<SendResult> {
  const open = inFlight.get(code) ?? new Map<number, OpenWrite>();
  inFlight.set(code, open);

  const ahead = open.get(op.card)?.done;
  const after = ahead
    ? ahead.then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve();
  const done = after.then(() => send(code, op));

  const write: OpenWrite = { op, done };
  open.set(op.card, write);

  return done.finally(() => {
    // Identity, not card: a newer write for the card owns the slot by now.
    if (open.get(op.card) === write) open.delete(op.card);
    if (open.size === 0 && inFlight.get(code) === open) inFlight.delete(code);
  });
}

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

/** How long a single mirror write waits before it becomes an outbox entry. */
const SEND_TIMEOUT_MS = 8000;

async function send(code: string, op: OutboxOp): Promise<SendResult> {
  const url = `/api/boards/${code}/solved/${op.card}`;
  try {
    // A request that never answers must not hold the toggle open forever: the
    // control no longer disables itself, so a hung fetch would look live and
    // silently swallow taps. On timeout this falls into the catch below and
    // takes the ordinary retry path into the outbox.
    const response =
      op.op === "put"
        ? await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ at: op.at }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          })
        : await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });

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

  const result = await sendPending(code, op);
  // A later tap for this card is on the wire or already queued: this write lost,
  // and re-queuing it (or reverting its paint) would undo that tap.
  const overtaken = () =>
    inFlight.get(code)?.has(card) || getOutbox(code).some((pending) => pending.card === card);
  if (result === "retry") {
    if (!overtaken()) queue(code, op);
  } else if (result === "drop" && !overtaken()) {
    if (want) paintUnsolved(code, card);
    else paintSolved(code, card, at);
  }
}

/** Pulls the server's list and adopts it. False when the store was unreachable. */
export async function pull(code: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/boards/${code}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      if (response.status === 429) hold(Number(response.headers.get("Retry-After")) || 60);
      // A 404 is the store answering, not an outage: there is no board at this
      // code, so nothing is on its way to one and the offline line would be a
      // lie under the notice that already says the code is not one of the four.
      return response.status === 404;
    }
    adoptBody(code, await response.json());
    return true;
  } catch {
    return false;
  }
}

const running = new Map<string, Promise<boolean>>();

/**
 * On mount: replay the outbox in order, then pull and adopt. The card page and
 * the deck page both start one, so a second call while the first is still going
 * joins it rather than replaying the same writes twice.
 */
export function flush(code: string): Promise<boolean> {
  const started = running.get(code);
  if (started) return started;
  return track(code, replay(code));
}

/**
 * The reconnect. Joining is right for two components mounting together and
 * wrong for `online`, where the replay already in `running` is the one stuck on
 * the connection that just came back: this chains a fresh pass behind it.
 */
export function resync(code: string): Promise<boolean> {
  const started = running.get(code);
  if (!started) return flush(code);
  return track(
    code,
    started.then(
      () => replay(code),
      () => replay(code),
    ),
  );
}

/** Holds the current run for `flush()` to join, and clears it only if it is
 *  still the current one: `resync()` can replace it before it settles. */
function track(code: string, run: Promise<boolean>): Promise<boolean> {
  const held = run.finally(() => {
    if (running.get(code) === held) running.delete(code);
  });
  running.set(code, held);
  return held;
}

async function replay(code: string): Promise<boolean> {
  if (onHold()) return false;
  // The snapshot fixes the order; the outbox stays the truth. A tap landing
  // while this runs takes its card's write out of the outbox or puts a
  // contradicting one on the wire, and either way the old one must not go.
  for (const op of getOutbox(code)) {
    if (superseded(code, op)) continue;
    const result = await sendPending(code, op);
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
