import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  flush,
  getOutbox,
  getSolved,
  solvedCards,
  toggleSolve,
} from "../src/lib/local";

/**
 * The client mirror, driven against a fake `localStorage` and a fake network.
 * Nothing here opens a store: the "server" is a `Map` and `fetch` is a stub, so
 * these run on a laptop with no credentials and no connection.
 */

const CODE = "abc123";

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

/** The server's hash, plus the three ways it can refuse. */
let solved: Map<number, string>;
let offline: boolean;
let refused: Set<number>;
let failing: Set<number>;
let storeDown: boolean;
let writes: string[];

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
  const card = match[2] === undefined ? null : Number(match[2]);
  const method = init.method ?? "GET";

  if (card === null) {
    if (storeDown) return new Response("", { status: 500 });
    return new Response(body(), { status: 200 });
  }

  writes.push(`${method} ${card}`);
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
  writes = [];

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
