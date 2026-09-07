import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  flush,
  getOutbox,
  getSolved,
  resync,
  setBoard,
  solvedCards,
  toggleSolve,
} from "../src/lib/local";

/**
 * The client mirror, driven against a fake `localStorage` and a fake network.
 * Nothing here opens a store: the "server" is a `Map` and `fetch` is a stub, so
 * these run on a laptop with no credentials and no connection.
 */

const CODE = "abc123";
const OTHER = "def456";
const GONE = "zzzzzz";

class FakeStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

/** The server's hash, plus the four ways it can refuse. */
let solved: Map<number, string>;
let offline: boolean;
let refused: Set<number>;
let failing: Set<number>;
let storeDown: boolean;
let knownBoards: Set<string>;
let writes: string[];
/** Every request, the board reads included, in the order they were issued. */
let requests: string[];

/**
 * A request the test holds open. The concurrency cases all need one: a tap
 * landing mid-replay, and a `GET` still in flight when the reader taps.
 */
type Gate = { arrived: Promise<void>; release: () => void };

let gates: Map<string, { open: Promise<void>; announce: () => void; release: () => void }>;

function gate(signature: string): Gate {
  let release!: () => void;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  let announce!: () => void;
  const arrived = new Promise<void>((resolve) => {
    announce = resolve;
  });
  gates.set(signature, { open, announce, release });
  return { arrived, release };
}

/** One macrotask, which is long enough for every promise the fake network
 *  makes: nothing in here waits on a timer. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function cardsOn(): number[] {
  return [...solved.keys()].sort((a, b) => a - b);
}

function body(): string {
  return JSON.stringify({
    solved: [...solved.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([card, at]) => ({ card, at })),
  });
}

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (offline) throw new Error("offline");
  const url = String(input);
  const match = /^\/api\/boards\/([0-9a-z]+)(?:\/solved\/([0-9]+))?$/.exec(url);
  assert.ok(match, `unexpected url ${url}`);
  const code = match[1];
  const card = match[2] === undefined ? null : Number(match[2]);
  const method = init.method ?? "GET";

  // Logged when the request is issued, not when it answers, so a held one is
  // on the record while the test decides what happens next to it.
  const signature = card === null ? `GET ${code}` : `${method} ${card}`;
  requests.push(signature);
  if (card !== null) writes.push(signature);

  const held = gates.get(signature);
  if (held) {
    gates.delete(signature);
    held.announce();
    await held.open;
  }

  if (card === null) {
    if (storeDown) return new Response("", { status: 500 });
    if (!knownBoards.has(code)) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    }
    return new Response(body(), { status: 200 });
  }

  if (failing.has(card)) return new Response("", { status: 500 });
  if (refused.has(card)) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  if (method === "PUT") {
    const at = (JSON.parse(String(init.body)) as { at: string }).at;
    if (!solved.has(card)) solved.set(card, at); // HSETNX keeps the first value
  } else {
    solved.delete(card);
  }
  return new Response(body(), { status: 200 });
}

beforeEach(() => {
  solved = new Map();
  offline = false;
  refused = new Set();
  failing = new Set();
  storeDown = false;
  knownBoards = new Set([CODE, OTHER]);
  writes = [];
  requests = [];
  gates = new Map();

  const target = new EventTarget();
  const fake = {
    localStorage: new FakeStorage(),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  const global = globalThis as unknown as { window: unknown; fetch: unknown };
  global.window = fake;
  global.fetch = fakeFetch;
});

describe("a tap that reaches the store", () => {
  it("clears the write the same card left in the outbox", async () => {
    offline = true;
    await toggleSolve(CODE, 5, true);
    assert.deepEqual(getOutbox(CODE).map((op) => op.card), [5]);

    offline = false;
    await toggleSolve(CODE, 5, false);

    // The queued `put` is contradicted by the untick and must not outlive it.
    assert.deepEqual(getOutbox(CODE), []);
    assert.deepEqual(solvedCards(CODE), []);

    assert.equal(await flush(CODE), true);
    assert.deepEqual(solvedCards(CODE), []);
    assert.deepEqual(cardsOn(), []);
  });

  it("keeps another card's pending solve painted while it adopts", async () => {
    offline = true;
    await toggleSolve(CODE, 3, true);
    offline = false;
    await toggleSolve(CODE, 8, true);

    assert.deepEqual(solvedCards(CODE), [3, 8]);
    assert.deepEqual(getOutbox(CODE).map((op) => op.card), [3]);
  });
});

describe("replaying the outbox", () => {
  it("leaves a still-queued solve on the deck when a later write fails", async () => {
    offline = true;
    await toggleSolve(CODE, 3, true);
    await toggleSolve(CODE, 8, true);
    offline = false;
    failing.add(8); // a 5xx keeps the write queued rather than dropping it

    assert.equal(await flush(CODE), false);
    assert.deepEqual(solvedCards(CODE), [3, 8]);
    assert.deepEqual(getOutbox(CODE).map((op) => op.card), [8]);
    assert.deepEqual(cardsOn(), [3]);
  });

  it("reverts the paint on a write the server refuses", async () => {
    offline = true;
    await toggleSolve(CODE, 12, true);
    offline = false;
    refused.add(12);
    storeDown = true; // so only the revert, and not the closing pull, can clear it

    assert.equal(await flush(CODE), false);
    assert.deepEqual(solvedCards(CODE), []);
    assert.deepEqual(getOutbox(CODE), []);
  });

  it("keeps the first timestamp when an old solve replays", async () => {
    offline = true;
    await toggleSolve(CODE, 4, true);
    const queued = getOutbox(CODE)[0].at;
    offline = false;

    assert.equal(await flush(CODE), true);
    assert.equal(getSolved(CODE)["4"], queued);
    assert.equal(solved.get(4), queued);
  });

  it("replays once when two components ask at the same time", async () => {
    offline = true;
    await toggleSolve(CODE, 9, true);
    offline = false;

    const [a, b] = await Promise.all([flush(CODE), flush(CODE)]);
    assert.equal(a, true);
    assert.equal(b, true);
    assert.deepEqual(writes, ["PUT 9"]);
  });
});

describe("a tap that lands while a replay is running", () => {
  it("does not let the replay put back the write the tap undid", async () => {
    offline = true;
    await toggleSolve(CODE, 3, true);
    await toggleSolve(CODE, 5, true);
    offline = false;

    const first = gate("PUT 3");
    const replaying = flush(CODE);
    await first.arrived;

    // The reader unticks card 5 while the replay is still on card 3, so the
    // queued `put 5` it is about to reach is a write they have contradicted.
    await toggleSolve(CODE, 5, false);
    first.release();
    await replaying;

    assert.deepEqual(writes, ["PUT 3", "DELETE 5"]);
    assert.deepEqual(solvedCards(CODE), [3]);
    assert.deepEqual(cardsOn(), [3]);
    assert.deepEqual(getOutbox(CODE), []);
  });

  it("sends a card's second write after the first, not beside it", async () => {
    offline = true;
    await toggleSolve(CODE, 4, true);
    offline = false;

    const open = gate("PUT 4");
    const replaying = flush(CODE);
    await open.arrived;

    const untick = toggleSolve(CODE, 4, false);
    await settled();
    // Two writes for one card open at once and the store keeps whichever
    // landed last, which need not be the tap the reader made last.
    assert.deepEqual(requests, ["PUT 4"]);

    open.release();
    await Promise.all([replaying, untick]);

    assert.deepEqual(writes, ["PUT 4", "DELETE 4"]);
    assert.deepEqual(solvedCards(CODE), []);
    assert.deepEqual(cardsOn(), []);
    assert.deepEqual(getOutbox(CODE), []);
  });
});

describe("a second tap while the first write is still open", () => {
  it("does not re-queue the write that tap undid", async () => {
    const put = gate("PUT 5");
    const ticking = toggleSolve(CODE, 5, true);
    await put.arrived;

    // The reader unticks the card while its `put` is still on the wire, so the
    // untick chains behind it rather than racing it.
    const del = gate("DELETE 5");
    const unticking = toggleSolve(CODE, 5, false);
    await settled();
    assert.deepEqual(requests, ["PUT 5"]);

    // The connection drops under the open `put` and comes back for the untick.
    failing.add(5);
    put.release();
    await del.arrived;
    failing.delete(5);
    del.release();
    await Promise.all([ticking, unticking]);

    // The failed `put` must not go back in the outbox: the untick is the
    // reader's last word, and a replay would put card 5 back on the deck and
    // on every other board's panel.
    assert.deepEqual(writes, ["PUT 5", "DELETE 5"]);
    assert.deepEqual(getOutbox(CODE), []);
    assert.deepEqual(solvedCards(CODE), []);
    assert.deepEqual(cardsOn(), []);
  });
});

describe("a pull that is already open when the reader taps", () => {
  it("keeps the tap rather than painting the older list back over it", async () => {
    solved.set(7, "2026-09-01T00:00:00.000Z");
    assert.equal(await flush(CODE), true);
    assert.deepEqual(solvedCards(CODE), [7]);

    const pulling = gate(`GET ${CODE}`);
    const syncing = flush(CODE);
    await pulling.arrived;

    // The untick leaves the outbox at once, so the outbox alone cannot tell
    // the arriving list that card 7 is stale.
    const writing = gate("DELETE 7");
    const tapping = toggleSolve(CODE, 7, false);
    await writing.arrived;

    pulling.release();
    await syncing;
    assert.deepEqual(solvedCards(CODE), []);

    writing.release();
    await tapping;
    assert.deepEqual(solvedCards(CODE), []);
    assert.deepEqual(cardsOn(), []);
    assert.deepEqual(getOutbox(CODE), []);
  });
});

describe("a board the store has never heard of", () => {
  it("is an answer, not an unreachable store", async () => {
    offline = true;
    await toggleSolve(GONE, 2, true);
    offline = false;
    refused.add(2);

    assert.equal(await flush(GONE), true);
    assert.deepEqual(requests, ["PUT 2", `GET ${GONE}`]);
    assert.deepEqual(solvedCards(GONE), []);
    assert.deepEqual(getOutbox(GONE), []);
  });
});

describe("claiming a board", () => {
  it("sends the solves it carries over rather than only queueing them", async () => {
    await toggleSolve(null, 2, true);
    assert.deepEqual(solvedCards(null), [2]);

    setBoard({ code: CODE, n: 1, name: "Alpha" });
    await settled();

    assert.deepEqual(writes, ["PUT 2"]);
    assert.deepEqual(cardsOn(), [2]);
    assert.deepEqual(solvedCards(CODE), [2]);
    assert.deepEqual(getOutbox(CODE), []);
  });

  it("sends them when a run for the new code is already in flight", async () => {
    await toggleSolve(null, 2, true);
    assert.deepEqual(solvedCards(null), [2]);

    // The deck's replay is already past its snapshot of the outbox when the
    // header streams in and the claim lands, so joining that run sends nothing.
    const pulling = gate(`GET ${CODE}`);
    const syncing = flush(CODE);
    await pulling.arrived;

    setBoard({ code: CODE, n: 1, name: "Alpha" });
    pulling.release();
    assert.equal(await syncing, true);
    await settled();

    assert.deepEqual(writes, ["PUT 2"]);
    assert.deepEqual(cardsOn(), [2]);
    assert.deepEqual(solvedCards(CODE), [2]);
    assert.deepEqual(getOutbox(CODE), []);
  });

  it("drains the board being switched away from", async () => {
    setBoard({ code: CODE, n: 1, name: "Alpha" });
    offline = true;
    await toggleSolve(CODE, 6, true);
    assert.deepEqual(getOutbox(CODE).map((op) => op.card), [6]);

    offline = false;
    setBoard({ code: OTHER, n: 2, name: "Bravo" });
    await settled();

    assert.deepEqual(writes, ["PUT 6"]);
    assert.deepEqual(cardsOn(), [6]);
    assert.deepEqual(getOutbox(CODE), []);
  });
});

describe("coming back online", () => {
  it("starts a fresh pass rather than joining the request that hung", async () => {
    offline = true;
    await toggleSolve(CODE, 1, true);
    offline = false;

    const stuck = gate("PUT 1");
    const mounted = flush(CODE);
    await stuck.arrived;

    // The connection drops under the open request, then comes back.
    failing.add(1);
    const back = resync(CODE);
    assert.notStrictEqual(mounted, back);

    const retry = gate("PUT 1");
    stuck.release();
    assert.equal(await mounted, false);

    await retry.arrived;
    failing.delete(1);
    retry.release();

    assert.equal(await back, true);
    assert.deepEqual(writes, ["PUT 1", "PUT 1"]);
    assert.deepEqual(cardsOn(), [1]);
    assert.deepEqual(getOutbox(CODE), []);
  });
});
