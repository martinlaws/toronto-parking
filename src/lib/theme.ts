/**
 * The board and page palette, in one place so `manifest.ts` and the SVG
 * renderer read the same values `globals.css` publishes as Tailwind tokens.
 *
 * ⚠ Every hex here is a placeholder. Issue 1 picks the final seven print-derived
 * values by holding a printed piece against the phone under daylight and
 * lamplight; translucent prints read one to two steps paler than screen
 * swatches. Keep this file and the `@theme` block in `src/app/globals.css` in
 * step: they are the same palette written twice, once for CSS and once for the
 * places that need a JavaScript string.
 */
export const COLOURS = {
  ground: "#FAF7F2",
  groundEdge: "#EFE9E0",
  ink: "#14110E",
  inkEdge: "#3C3630",
  asphalt: "#121212",
  asphaltEdge: "#2A2A2A",
  frame: "#F4F1EC",
  frameEdge: "#D9D3C9",
  glow: "#6FE39B",
  glowEdge: "#A8F2C6",
  carBlue: "#4FA8E8",
  carBlueEdge: "#93CEF5",
  carYellow: "#F0B429",
  carYellowEdge: "#F8D77A",
  carGreen: "#7FD14A",
  carGreenEdge: "#B4E88B",
  hero: "#F2543D",
  heroEdge: "#FF9C88",
} as const;

/** The manifest's `background_color` and `theme_color`, and the icon ground. */
export const GROUND = COLOURS.ground;

/** Peg grey, the one colour that is not a palette token: it is hardware. */
export const PEG = "#9A9A9A";
