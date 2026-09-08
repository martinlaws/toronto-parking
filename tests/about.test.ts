import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The About page's two obligations that nothing else would catch: the print
 * credits the model it remixes, with the attribution CC BY-NC-SA 4.0 asks
 * for, and the vendor's mark appears in prose exactly once (the trademark
 * line is attribution, not a second mention).
 */

const about = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src/app/about/page.tsx"),
  "utf8",
);

describe("the about page", () => {
  it("credits the model the print remixes, with author, source and licence", () => {
    assert.doesNotMatch(about, /Placeholder/);
    assert.match(about, /Martin Kozak/);
    assert.match(about, /href="https:\/\/makerworld\.com\/en\/models\/78940[^"]*"/);
    assert.match(about, /href="https:\/\/creativecommons\.org\/licenses\/by-nc-sa\/4\.0\/"/);
    assert.match(about, /CC BY-NC-SA 4\.0/);
    assert.match(about, /edits and the colours are this set/);
  });

  it("names the vendor's mark once in prose", () => {
    const prose = about.match(/Rush Hour/g) ?? [];
    assert.equal(prose.length, 1);
    assert.match(about, /RUSH HOUR is a registered trademark/);
  });
});
