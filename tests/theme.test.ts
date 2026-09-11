import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COLOURS } from "../src/lib/theme";

/**
 * The palette is written three times: as Tailwind tokens in `globals.css`, as
 * strings in `theme.ts` for the renderer and manifest, and as literal fills in
 * `icon.svg`. Nothing else keeps them in step.
 *
 * The check runs one way only, and deliberately: every `COLOURS` key must have
 * a token, but `globals.css` may hold tokens with no key. That is where the
 * page greys live, meaning the hairlines, the unplayed mark, the secondary
 * text and the rail's off state. Nothing outside a stylesheet has ever wanted
 * a hairline colour, and a `COLOURS` key is a thing to keep in step forever.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");

/** `carBlueEdge` → `--color-car-blue-edge`. */
const tokenName = (key: string) => `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;

/** WCAG 2.1 relative luminance of a `#rrggbb` string. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the palette", () => {
  it("is the same in globals.css and theme.ts", () => {
    const css = read("src/app/globals.css");
    for (const [key, hex] of Object.entries(COLOURS)) {
      const m = css.match(new RegExp(`${tokenName(key)}: (#[0-9a-fA-F]{6});`));
      assert.ok(m, `${tokenName(key)} missing from globals.css`);
      assert.equal(m[1].toLowerCase(), hex.toLowerCase(), tokenName(key));
    }
  });

  it("is what icon.svg is drawn with, in both copies", () => {
    for (const file of ["assets/icon.svg", "src/app/icon.svg"]) {
      const svg = read(file).toUpperCase();
      for (const key of ["ground", "asphalt", "glow", "hero", "heroEdge"] as const) {
        assert.ok(svg.includes(COLOURS[key].toUpperCase()), `${file} lacks ${key} ${COLOURS[key]}`);
      }
    }
  });

  it("keeps blue and green apart with colour removed", () => {
    assert.ok(luminance(COLOURS.carGreen) - luminance(COLOURS.carBlue) > 0.1);
  });

  it("sets both inks on the ground at better than AAA", () => {
    // `ink` is display and `inkEdge` is running text, so the page is only ever
    // one of the two and both have to hold at 9px labels and 13px notes.
    assert.ok(contrast(COLOURS.ink, COLOURS.ground) >= 7, "ink");
    assert.ok(contrast(COLOURS.inkEdge, COLOURS.ground) >= 7, "inkEdge");
  });

  it("gives the accent the contrast glow cannot have", () => {
    // This is the whole reason a second green exists. `glow` is print-derived
    // and matches plastic, which leaves it far too light to carry type on a
    // near-white ground; the accent was added to say solved, at par and live
    // in a colour a reader can actually read. Let the accent drift lighter and
    // it stops being able to do the job it was added for, so the floor is
    // pinned here rather than left to whoever picks the next shade.
    assert.ok(contrast(COLOURS.accent, COLOURS.ground) >= 4.5, "accent on ground");
    assert.ok(contrast(COLOURS.glow, COLOURS.ground) < 3, "glow is a fill, not type");
    // `accentPale` is a ground in its own right, under the ringed figure and
    // behind the live score cell, so the accent has to clear it as well.
    assert.ok(contrast(COLOURS.accent, COLOURS.accentPale) >= 4.5, "accent on accentPale");
  });
});
