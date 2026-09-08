/**
 * The board and page palette, in one place so `manifest.ts` and the SVG
 * renderer read the same values `globals.css` publishes as Tailwind tokens.
 *
 * The seven print-derived values were picked against printed pieces on a phone
 * (issue 1, 2026-09-08): asphalt, frame, glow, blue and hero are final;
 * yellow and green are provisional, one step paler like the rest, until the
 * yellow and green pieces get the same check. Keep this file, the `@theme`
 * block in `src/app/globals.css` and `assets/icon.svg` in step: they are the
 * same palette written three times, and `tests/theme.test.ts` holds them to it.
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
  carBlue: "#63B6F0",
  carBlueEdge: "#A9DBF9",
  carYellow: "#F6C04A",
  carYellowEdge: "#FBE19A",
  carGreen: "#8FD960",
  carGreenEdge: "#C3EF9F",
  hero: "#F76A55",
  heroEdge: "#FFB0A0",
} as const;

/** The manifest's `background_color` and `theme_color`, and the icon ground. */
export const GROUND = COLOURS.ground;

/** Peg grey, the one colour that is not a palette token: it is hardware. */
export const PEG = "#9A9A9A";
