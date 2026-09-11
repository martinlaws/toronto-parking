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
 *
 * The page half is not print-derived and answers to a different question: what
 * a sheet of paper the pieces are photographed against should be. It is a
 * near-white ground a hair cool of neutral, so the seven saturated plastics
 * stay the only colour on the page, and one green accent at 6.3:1 on that
 * ground. The accent exists for two reasons. `glow` cannot do this job: at
 * 1.4:1 on the ground it is a fill behind ink and never type or a lone mark.
 * And solved, at par and a live value all want to be the same colour as each
 * other and a different colour from everything else.
 */
export const COLOURS = {
  ground: "#FAFBF8",
  groundEdge: "#EDF1EE",
  ink: "#131714",
  inkEdge: "#3A423D",
  accent: "#0F6B4B",
  accentPale: "#E7F1EC",
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
