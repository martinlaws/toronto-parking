import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextRequest } from "next/server";

import { badAt, badCard, json, notFound, readAt } from "../src/lib/api";
import { resolveAt } from "../src/lib/boards";

/** Response shapes only: nothing here opens a store. */

describe("every board response", () => {
  it("carries Cache-Control: no-store", async () => {
    for (const response of [json({ ok: true }), notFound(), badCard(), badAt()]) {
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

  it("names the two 400s", async () => {
    assert.equal(badCard().status, 400);
    assert.deepEqual(await badCard().json(), { error: "bad_card" });
    assert.equal(badAt().status, 400);
    assert.deepEqual(await badAt().json(), { error: "bad_at" });
  });
});

describe("readAt()", () => {
  const put = (body?: BodyInit) =>
    new Request("https://cars.mlaws.ca/api/boards/h7k2np/solved/5", {
      method: "PUT",
      ...(body === undefined ? {} : { body }),
    }) as unknown as NextRequest;

  it("reads the moment of the tap out of the body", async () => {
    const field = await readAt(put(JSON.stringify({ at: "2026-01-01T00:00:00.000Z" })));
    assert.deepEqual(field, { ok: true, at: "2026-01-01T00:00:00.000Z" });
  });

  it("treats an absent or empty body as the absent case, which is server time", async () => {
    for (const body of [undefined, "", "  \n"]) {
      assert.deepEqual(await readAt(put(body)), { ok: true, at: undefined });
    }
    assert.deepEqual(await readAt(put(JSON.stringify({}))), { ok: true, at: undefined });
  });

  it("refuses a body that will not parse rather than timing it here", async () => {
    // Without this the route answers 200 and records the reconnect, which is
    // the one thing `at` exists to prevent.
    assert.deepEqual(await readAt(put("not json")), { ok: false });
    assert.deepEqual(await readAt(put('{"at":')), { ok: false });
  });

  it("hands an unparseable `at` on to resolveAt, which is the other bad_at", async () => {
    const field = await readAt(put(JSON.stringify({ at: "yesterday" })));
    assert.deepEqual(field, { ok: true, at: "yesterday" });
    assert.equal(resolveAt("yesterday").ok, false);
  });
});
