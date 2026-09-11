import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BoardProgress, { PICK_UP_BAR, PickUp } from "../src/components/BoardProgress";
import SolvedChip, { Chip } from "../src/components/SolvedChip";
import { CHIP, CONTROL } from "../src/lib/ui";

/**
 * The board page's look, held to the two things the spec fixes and a browser
 * would otherwise be the only witness to: the pick-up line is a real link to
 * the next card, and the solved state is a filled chip.
 *
 * `renderToStaticMarkup` runs no effects, so the mirror-aware wrappers render
 * their empty first shape here; the presentational halves are exported beside
 * them and are what these assertions read. Nothing in this file touches a
 * store, a board code or a name.
 */

const src = (file: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", file), "utf8");

/** Every `<Link>` opening tag in a file, formatting and attribute order aside. */
function linkTags(file: string): string[] {
  return src(file).match(/<Link\b[\s\S]*?>/g) ?? [];
}

describe("the pick-up chip", () => {
  it("links to the next card", () => {
    const html = renderToStaticMarkup(createElement(PickUp, { next: 14 }));
    assert.match(html, /^<a /);
    assert.match(html, /href="\/cards\/14"/);
    assert.match(html, />Pick up at #14</);
  });

  it("carries the 44 px floor and the focus ring", () => {
    const html = renderToStaticMarkup(createElement(PickUp, { next: 14 }));
    assert.ok(html.includes(CONTROL), "the chip is a CONTROL");
    assert.match(CONTROL, /\bmin-h-11\b/);
    assert.match(CONTROL, /focus-visible:outline/);
  });

  it("keeps the attribute the stylesheet and the tests hook onto", () => {
    const html = renderToStaticMarkup(createElement(PickUp, { next: 7 }));
    assert.match(html, /data-pick-up="7"/);
  });

  it("rides in a sticky bar with a ground behind it", () => {
    // Bounded by its containing block, so the bar has to be the component's
    // outermost element; a background keeps the deck from scrolling through it.
    assert.match(PICK_UP_BAR, /\bsticky\b/);
    assert.match(PICK_UP_BAR, /\btop-0\b/);
    assert.match(PICK_UP_BAR, /\bbg-ground\b/);
    assert.match(PICK_UP_BAR, /\bz-10\b/);
  });

  it("renders nothing before the mirror has spoken", () => {
    assert.equal(renderToStaticMarkup(createElement(BoardProgress, {})), "");
  });
});

describe("the solved chip", () => {
  it("is a filled glow chip, not body text", () => {
    const html = renderToStaticMarkup(createElement(Chip));
    assert.ok(html.includes(CHIP), "the chip is a CHIP");
    assert.match(CHIP, /\bbg-glow\b/);
    assert.match(CHIP, /\brounded-full\b/);
    assert.match(html, />Solved</);
  });

  it("does not borrow a control's touch target or focus ring", () => {
    // Nothing here is tappable or focusable, so `CONTROL_ON` would size a
    // label like a button and promise a focus state that never arrives.
    assert.doesNotMatch(CHIP, /\bmin-h-11\b/);
    assert.doesNotMatch(CHIP, /focus-visible/);
  });

  it("renders nothing before the mirror has spoken", () => {
    assert.equal(renderToStaticMarkup(createElement(SolvedChip, { card: 1 })), "");
  });
});

describe("the two remembered-board links", () => {
  // Both are controls a thumb has to hit. They only render once `localStorage`
  // has been read, which `renderToStaticMarkup` cannot reach, so the shape is
  // read off the source instead of off a render.
  for (const file of ["src/components/RootBoardBar.tsx", "src/components/BoardClaim.tsx"]) {
    it(`${file} gives every link the control shape`, () => {
      const tags = linkTags(file);
      assert.ok(tags.length > 0, "there is a link to check");
      for (const tag of tags) assert.match(tag, /className=\{CONTROL\}/);
    });
  }
});

describe("the board page", () => {
  it("takes the deck's measure and keeps the gutters off `<main>`", () => {
    const page = src("src/app/b/[code]/page.tsx");
    const main = page.match(/<main className="[^"]*"/)?.[0] ?? "";
    assert.ok(main.length > 0, "there is a main to read");
    // The same cap the listing puts on itself, so a tier row reads identically
    // on this page and on the deck. And no horizontal padding: the leaf is a
    // full-bleed object that needs the column's edge, so the gutters live on
    // the wrappers inside and the leaf is the one thing that bleeds back out.
    assert.match(main, /\bmax-w-xl\b/);
    assert.doesNotMatch(main, /(^|\s)(sm:)?px-\d/);
  });

  it("sets the dedication in the serif, at a size a narrow phone can hold", () => {
    const header = src("src/components/BoardHeader.tsx");
    // Both branches take one class string, because a name and a bare board
    // number are the same line saying different words. A seeded name can run
    // to 40 characters, so the size is tied to the column rather than fixed.
    assert.match(header, /const DISPLAY =\s*"[^"]*\bfont-serif\b[^"]*"/);
    assert.match(header, /const DISPLAY =\s*"[^"]*clamp\([^"]*"/);
    const tags = header.match(/<h1\b[^>]*>/g) ?? [];
    assert.equal(tags.length, 2, "a greeting and a bare number, and nothing else");
    for (const tag of tags) assert.match(tag, /className=\{DISPLAY\}/);
  });

  it("drops the greeting on a board with no dedication and titles it by number", () => {
    const header = src("src/components/BoardHeader.tsx");
    const bare = header.slice(header.indexOf('if (board.dedication === "")'), header.indexOf("return (", header.indexOf('if (board.dedication === "")') + 40));
    assert.ok(bare.length > 0, "the no-dedication branch exists");
    assert.match(bare, /<h1[^>]*>\s*Board \{board\.n\} of 4\.\s*<\/h1>/);
    assert.doesNotMatch(bare, /For \{board\.name\}/);
  });
});
