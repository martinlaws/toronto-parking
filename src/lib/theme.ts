/**
 * The board and page palette, in one place so `manifest.ts` and the SVG
 * renderer read the same values `globals.css` publishes as Tailwind tokens.
 *
 * Checked against the finished print on 2026-09-11, with all four boards in
 * hand. The pieces came out of the printer far paler than the palette assumed:
 * the filament is semi-translucent, so a car reads as the light, milky value
 * this file used to call the *edge* rather than the saturated one it called the
 * body. Blue, yellow, green and the hero are therefore swapped — body takes the
 * old edge, edge takes the old body — which also matches how a translucent
 * piece actually looks, pale across the face with the colour gathering where
 * the wall turns.
 *
 * Frame and asphalt are unchanged: they were right, and neither is translucent.
 *
 * Two deliberate exceptions, both recorded on issue 1:
 *
 * `carBlue` is one step deeper than the swap alone would give. The straight
 * swap put it at `#A9DBF9`, which leaves only 0.099 of relative luminance
 * between blue and green, under the 0.1 floor `tests/theme.test.ts` holds. That
 * floor is the whole reason a red/green-blind reader can tell a blue car from a
 * green one with hue removed, and the pale family converges exactly where it
 * matters. `#93CEF5` clears it at 0.189 and reads closer to the real piece
 * anyway.
 *
 * `glow` is not swapped. It is a printed board marking rather than a
 * translucent piece, and the finished boards read yellower in the markings than
 * either candidate. Left alone until it gets its own check.
 *
 * Keep this file, the `@theme` block in `src/app/globals.css` and
 * `assets/icon.svg` in step: they are the same palette written three times, and
 * `tests/theme.test.ts` holds them to it.
 */
export const COLOURS = {
  ground: "#FAF7F2",
  groundEdge: "#EFE9E0",
  ink: "#14110E",
  inkEdge: "#3C3630",
  asphalt: "#1E1C1A",
  asphaltEdge: "#3A3734",
  frame: "#F4F1EC",
  frameEdge: "#D9D3C9",
  glow: "#84EAAC",
  glowEdge: "#BDF7D5",
  carBlue: "#93CEF5",
  carBlueEdge: "#63B6F0",
  carYellow: "#FBE19A",
  carYellowEdge: "#F6C04A",
  carGreen: "#C3EF9F",
  carGreenEdge: "#8FD960",
  hero: "#FFB0A0",
  heroEdge: "#F76A55",
} as const;

/** The manifest's `background_color` and `theme_color`, and the icon ground. */
export const GROUND = COLOURS.ground;

/** Peg grey, the one colour that is not a palette token: it is hardware. */
export const PEG = "#9A9A9A";
