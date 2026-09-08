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
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");

/** `carBlueEdge` → `--color-car-blue-edge`. */
const tokenName = (key: string) => `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;

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
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    assert.ok(luminance(COLOURS.carGreen) - luminance(COLOURS.carBlue) > 0.1);
  });
});
