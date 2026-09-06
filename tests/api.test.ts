import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { badAt, badCard, json, notFound } from "../src/lib/api";

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
