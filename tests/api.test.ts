import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextRequest } from "next/server";

import { badAt, badCard, badMoves, json, notFound, readSolve } from "../src/lib/api";
import { MAX_MOVES, resolveAt, resolveMoves } from "../src/lib/boards";

/** Response shapes only: nothing here opens a store. */

describe("every board response", () => {
  it("carries Cache-Control: no-store", async () => {
    for (const response of [json({ ok: true }), notFound(), badCard(), badAt(), badMoves()]) {
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  });

  it("keeps a caller-set header beside it", () => {
    const response = json({ error: "rate_limited" }, 429, { "Retry-After": "12" });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "12");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("gives an unknown and a mistyped code the same body", async () => {
    assert.equal(notFound().status, 404);
    assert.deepEqual(await notFound().json(), { error: "not_found" });
  });

  it("names the three 400s", async () => {
    assert.equal(badCard().status, 400);
    assert.deepEqual(await badCard().json(), { error: "bad_card" });
    assert.equal(badAt().status, 400);
    assert.deepEqual(await badAt().json(), { error: "bad_at" });
    assert.equal(badMoves().status, 400);
    assert.deepEqual(await badMoves().json(), { error: "bad_moves" });
  });
});

describe("readSolve()", () => {
  const put = (body?: BodyInit) =>
    new Request("https://cars.mlaws.ca/api/boards/h7k2np/solved/5", {
      method: "PUT",
      ...(body === undefined ? {} : { body }),
    }) as unknown as NextRequest;

  it("reads the moment of the tap out of the body", async () => {
    const fields = await readSolve(put(JSON.stringify({ at: "2026-01-01T00:00:00.000Z" })));
    assert.deepEqual(fields, { ok: true, at: "2026-01-01T00:00:00.000Z", moves: undefined });
  });

  it("reads both fields from the one call, which is all the body allows", async () => {
    // `request.text()` consumes the stream, so a second reader beside this one
    // would find the body gone and answer as though nothing had been sent.
    const fields = await readSolve(
      put(JSON.stringify({ at: "2026-01-01T00:00:00.000Z", moves: 28 })),
    );
    assert.deepEqual(fields, { ok: true, at: "2026-01-01T00:00:00.000Z", moves: 28 });
  });

  it("treats an absent or empty body as the absent case, which is server time", async () => {
    for (const body of [undefined, "", "  \n"]) {
      assert.deepEqual(await readSolve(put(body)), { ok: true, at: undefined, moves: undefined });
    }
    assert.deepEqual(await readSolve(put(JSON.stringify({}))), {
      ok: true,
      at: undefined,
      moves: undefined,
    });
  });

  it("reads a count with no moment beside it, which is how a correction is sent", async () => {
    assert.deepEqual(await readSolve(put(JSON.stringify({ moves: 28 }))), {
      ok: true,
      at: undefined,
      moves: 28,
    });
  });

  it("refuses a body that will not parse rather than timing it here", async () => {
    // Without this the route answers 200 and records the reconnect, which is
    // the one thing `at` exists to prevent.
    assert.deepEqual(await readSolve(put("not json")), { ok: false });
    assert.deepEqual(await readSolve(put('{"at":')), { ok: false });
  });

  it("hands an unparseable `at` on to resolveAt, which is the other bad_at", async () => {
    const fields = await readSolve(put(JSON.stringify({ at: "yesterday" })));
    assert.deepEqual(fields, { ok: true, at: "yesterday", moves: undefined });
    assert.equal(resolveAt("yesterday").ok, false);
  });

  it("hands an unparseable count on to resolveMoves, which is the bad_moves", async () => {
    const fields = await readSolve(put(JSON.stringify({ moves: "lots" })));
    assert.deepEqual(fields, { ok: true, at: undefined, moves: "lots" });
    assert.equal(resolveMoves("lots").ok, false);
  });
});

describe("resolveMoves()", () => {
  it("reads a count a reader typed, as a string or as a number", () => {
    assert.deepEqual(resolveMoves("28"), { ok: true, moves: 28 });
    assert.deepEqual(resolveMoves(28), { ok: true, moves: 28 });
    assert.deepEqual(resolveMoves(String(MAX_MOVES)), { ok: true, moves: MAX_MOVES });
  });

  it("reads absence as leave the stored count alone, never as zero", () => {
    // This is what keeps the PUT idempotent: a replayed tick carries no count
    // and must not erase a number typed after it was queued.
    for (const raw of [undefined, null, ""]) {
      assert.deepEqual(resolveMoves(raw), { ok: true, moves: null });
    }
  });

  it("refuses everything that is not a whole count", () => {
    for (const raw of ["0", 0, "-1", -1, "2.5", 2.5, "abc", " ", "1e3", String(MAX_MOVES + 1), true, {}]) {
      assert.equal(resolveMoves(raw).ok, false, String(raw));
    }
  });
});
