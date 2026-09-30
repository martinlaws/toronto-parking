import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * A board's page shows that board and nothing of the other three. The only
 * way the site could learn who else holds a board is to read the whole boards
 * set, so nothing it serves may do that: listing the set is the seed script's
 * job alone (Martin, 2026-09-30).
 */

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("board privacy", () => {
  const files = sources("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("never lists the boards set from anything the site serves", () => {
    const listing = files.filter(({ text }) => /\.smembers\s*\(/.test(text)).map(({ path }) => path);
    assert.deepEqual(listing, []);
  });

  it("names the boards set only where it is defined", () => {
    const uses = files
      .flatMap(({ path, text }) => text.split("\n").map((line) => ({ path, line })))
      .filter(({ line }) => line.includes("boardsKey"))
      .map(({ path, line }) => `${path}: ${line.trim()}`);
    assert.deepEqual(uses, ['src/lib/boards.ts: export const boardsKey = () => k("boards");']);
  });
});
