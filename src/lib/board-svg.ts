/**
 * The board diagram, as an SVG string.
 *
 * A string and not React on purpose: the per-card Open Graph route compiles in
 * Next's `rsc` layer, where `react-dom/server` throws, so the only renderer
 * that can serve both the page and the image is one built from template
 * literals. `src/components/Board.tsx` hands the result to
 * `dangerouslySetInnerHTML` — every byte here comes from `data/deck.json` at
 * build time and none of it from a user.
 *
 * Geometry, cell = 100: interior 600x600, frame band 40, margin 20, so the
 * viewBox is `0 0 720 720` and the box stays square in every orientation.
 * The board is always drawn in the canonical frame with EXIT on the right
 * wall; rotation is a CSS transform on the wrapper, so nothing re-lays out.
 */
import { COLOURS, PEG } from "./theme";
import type { Piece } from "./types";
import { pieceLabel } from "./board";

export type BoardMode = "card" | "thumb" | "og";

const CELL = 100;
const MARGIN = 20;
const BAND = 40;
/** Where the asphalt starts: margin plus the frame band. */
const IN = MARGIN + BAND; // 60
const INTERIOR = 6 * CELL; // 600
const SIZE = MARGIN * 2 + BAND * 2 + INTERIOR; // 720
/** Pieces are inset 8 a side, so a car box is 184x84 and a truck 284x84. */
const INSET = 8;
const THICK = CELL - INSET * 2; // 84
/** The exit sits on the right wall, third row from the top. */
const EXIT_ROW = 2;
/** The frame segment across the exit row keeps only its outer 12 units. */
const LIP = 12;

const FILL_OPACITY = 0.86;
const HIGHLIGHT_OPACITY = 0.18;
const PEG_OPACITY = 0.55;

type Skin = { body: string; edge: string };

const SKINS: Record<string, Skin> = {
  red: { body: COLOURS.hero, edge: COLOURS.heroEdge },
  blue: { body: COLOURS.carBlue, edge: COLOURS.carBlueEdge },
  yellow: { body: COLOURS.carYellow, edge: COLOURS.carYellowEdge },
  green: { body: COLOURS.carGreen, edge: COLOURS.carGreenEdge },
};

/** The letter the `Label colours` toggle prints on a piece. */
const COLOUR_INITIAL: Record<string, string> = {
  blue: "B",
  yellow: "Y",
  green: "G",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trim a float to two places and drop a trailing `.00`, keeping markup small. */
function n(value: number): string {
  const r = Math.round(value * 100) / 100;
  return String(r);
}

/**
 * A piece drawn as if it were horizontal, centred on the cells it occupies.
 * Vertical pieces get the same art inside a `rotate(90 cx cy)` group, so the
 * car, truck and cabriolet are each described once.
 */
type Box = { cx: number; cy: number; x: number; y: number; w: number; h: number };

function boxOf(piece: Piece): Box {
  const len = piece.length;
  const long = len * CELL - INSET * 2;
  const cx =
    piece.orientation === "h"
      ? IN + piece.col * CELL + (len * CELL) / 2
      : IN + piece.col * CELL + CELL / 2;
  const cy =
    piece.orientation === "h"
      ? IN + piece.row * CELL + CELL / 2
      : IN + piece.row * CELL + (len * CELL) / 2;
  return { cx, cy, x: cx - long / 2, y: cy - THICK / 2, w: long, h: THICK };
}

/** Body, lit edge, inner highlight: the three layers a translucent print shows. */
function shell(b: Box, skin: Skin, highlight: boolean): string {
  const parts = [
    `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="22" fill="${skin.body}" fill-opacity="${FILL_OPACITY}" stroke="${skin.edge}" stroke-width="3"/>`,
  ];
  if (highlight) {
    parts.push(
      `<rect x="${n(b.x + 12)}" y="${n(b.y + 9)}" width="${n(b.w - 24)}" height="${n(b.h * 0.3)}" rx="12" fill="${skin.edge}" opacity="${HIGHLIGHT_OPACITY}"/>`,
    );
  }
  return parts.join("");
}

function carArt(b: Box, skin: Skin, detail: boolean): string {
  let out = shell(b, skin, detail);
  if (detail) {
    // One band across the short axis: enough of a windscreen to tell a car
    // from half a truck at a glance.
    out += `<rect x="${n(b.x + b.w * 0.36)}" y="${n(b.y + 7)}" width="30" height="${n(b.h - 14)}" rx="8" fill="${skin.edge}" fill-opacity="0.5"/>`;
  }
  return out;
}

function truckArt(b: Box, skin: Skin, detail: boolean): string {
  let out = shell(b, skin, detail);
  if (detail) {
    const split = b.x + b.w / 3;
    out += `<line x1="${n(split)}" y1="${n(b.y + 5)}" x2="${n(split)}" y2="${n(b.y + b.h - 5)}" stroke="${skin.edge}" stroke-width="3" stroke-linecap="round"/>`;
    const boxLen = b.w - b.w / 3;
    for (let i = 1; i <= 3; i++) {
      const rx = split + (boxLen * i) / 4;
      out += `<line x1="${n(rx)}" y1="${n(b.y + 16)}" x2="${n(rx)}" y2="${n(b.y + b.h - 16)}" stroke="${skin.edge}" stroke-width="2" opacity="0.35"/>`;
    }
  }
  return out;
}

/**
 * The hero: a cabriolet with the roof off, drawn as the printed piece actually
 * moulds it. Front is to the right, toward the exit, and the cockpit is a
 * shallow tub set BEHIND centre — short boot behind it, long bonnet ahead — so
 * the piece is asymmetric along its length. A well centred on the box with a
 * pair of arcs in it reads as a face, which is the shape this replaces.
 *
 * The open cockpit is the tell a red/green-blind reader picks the hero out by,
 * so it survives with hue removed and at 58px: no other piece has a dark
 * interior at all. At `thumb` the tub deepens and everything inside it goes,
 * for the reason the rest of the file drops sub-pixel detail.
 */
const WELL_BACK = 0.24;
const WELL_FRONT = 0.575;
/** Half-height of the tub at the bulkhead and at the screen: it tapers forward. */
const WELL_REAR_H = 27;
const WELL_FRONT_H = 24;
const WELL_R = 9;

/** The tub outline, as one closed path with quadratic fillets at the corners. */
function cockpitPath(b: Box): string {
  const ax = b.x + b.w * WELL_BACK;
  const bx = b.x + b.w * WELL_FRONT;
  const hr = WELL_REAR_H;
  const hf = WELL_FRONT_H;
  const r = WELL_R;
  return (
    `M ${n(ax + r)} ${n(b.cy - hr)}` +
    ` L ${n(bx - r)} ${n(b.cy - hf)}` +
    ` Q ${n(bx)} ${n(b.cy - hf)} ${n(bx)} ${n(b.cy - hf + r)}` +
    ` L ${n(bx)} ${n(b.cy + hf - r)}` +
    ` Q ${n(bx)} ${n(b.cy + hf)} ${n(bx - r)} ${n(b.cy + hf)}` +
    ` L ${n(ax + r)} ${n(b.cy + hr)}` +
    ` Q ${n(ax)} ${n(b.cy + hr)} ${n(ax)} ${n(b.cy + hr - r)}` +
    ` L ${n(ax)} ${n(b.cy - hr + r)}` +
    ` Q ${n(ax)} ${n(b.cy - hr)} ${n(ax + r)} ${n(b.cy - hr)} Z`
  );
}

function heroArt(b: Box, detail: boolean): string {
  const skin = SKINS.red;
  let out = shell(b, skin, detail);

  const ax = b.x + b.w * WELL_BACK;
  const bx = b.x + b.w * WELL_FRONT;
  const well = cockpitPath(b);

  // A tint, not a hole. 0.72 asphalt printed a black rectangle; this is the
  // dusky rose a shallow recess makes in a pale translucent piece. The thumb
  // takes it deeper because at 58px the tub is five pixels across and the only
  // thing left to carry the tell is its value.
  out += `<path d="${well}" fill="${COLOURS.asphalt}" fill-opacity="${detail ? 0.32 : 0.66}"/>`;

  if (detail) {
    // Near wall in shadow, far wall catching the light: the pair of them is
    // what says recess rather than cut-out.
    out += `<path d="M ${n(ax + WELL_R + 3)} ${n(b.cy - WELL_REAR_H + 4)} L ${n(bx - WELL_R - 3)} ${n(b.cy - WELL_FRONT_H + 4)}" fill="none" stroke="${COLOURS.asphalt}" stroke-width="7" stroke-opacity="0.38" stroke-linecap="round"/>`;
    out += `<path d="M ${n(ax + WELL_R + 3)} ${n(b.cy + WELL_REAR_H - 4)} L ${n(bx - WELL_R - 3)} ${n(b.cy + WELL_FRONT_H - 4)}" fill="none" stroke="${skin.body}" stroke-width="5" stroke-opacity="0.55" stroke-linecap="round"/>`;
  }
  out += `<path d="${well}" fill="none" stroke="${skin.edge}" stroke-width="2.5"/>`;

  if (detail) {
    // Two seat backs across the car, not two arcs along it. Side by side on the
    // short axis they are a cockpit; side by side on the long axis they were
    // eyes.
    for (const sy of [b.cy - 12.5, b.cy + 12.5]) {
      out += `<rect x="${n(ax + 8)}" y="${n(sy - 9)}" width="17" height="18" rx="5.5" fill="${skin.body}" fill-opacity="0.88" stroke="${skin.edge}" stroke-width="2"/>`;
    }
    // The wheel sits in front of one seat only. It is the asymmetry that a real
    // interior has, and it costs eight units.
    out += `<ellipse cx="${n(ax + 36)}" cy="${n(b.cy + 12.5)}" rx="7.5" ry="6.5" fill="none" stroke="${skin.edge}" stroke-width="3"/>`;
    out += `<circle cx="${n(ax + 36)}" cy="${n(b.cy + 12.5)}" r="2" fill="${skin.edge}"/>`;
    // Bonnet shut line, bowed forward: the long end is empty without it, and the
    // printed piece has the same seam.
    const cut = b.x + b.w - 36;
    out += `<path d="M ${n(cut - 5)} ${n(b.cy - 23)} Q ${n(cut + 4)} ${n(b.cy)} ${n(cut - 5)} ${n(b.cy + 23)}" fill="none" stroke="${skin.edge}" stroke-width="2.5" opacity="0.32" stroke-linecap="round"/>`;
    // Headlamps, so the long end reads as the bonnet.
    for (const ly of [b.cy - 19, b.cy + 19]) {
      out += `<rect x="${n(b.x + b.w - 21)}" y="${n(ly - 4)}" width="9" height="8" rx="4" fill="${skin.edge}" fill-opacity="0.35"/>`;
    }
  }

  // The windscreen: a blade astride the front of the opening, bowed forward and
  // no taller than the tub it closes. It throws a shadow back into the well —
  // that sliver is most of what says the screen stands proud of the floor.
  const sx = bx - 3;
  out += `<path d="M ${n(sx - 7)} ${n(b.cy - 21)} Q ${n(sx + 1)} ${n(b.cy)} ${n(sx - 7)} ${n(b.cy + 21)} L ${n(sx - 12)} ${n(b.cy + 20)} Q ${n(sx - 4)} ${n(b.cy)} ${n(sx - 12)} ${n(b.cy - 20)} Z" fill="${COLOURS.asphalt}" fill-opacity="0.22"/>`;
  out += `<path d="M ${n(sx)} ${n(b.cy - 22)} Q ${n(sx + 6)} ${n(b.cy)} ${n(sx)} ${n(b.cy + 22)} L ${n(sx - 7)} ${n(b.cy + 21)} Q ${n(sx - 1)} ${n(b.cy)} ${n(sx - 7)} ${n(b.cy - 21)} Z" fill="${skin.body}" fill-opacity="0.95" stroke="${skin.edge}" stroke-width="2" stroke-linejoin="round"/>`;

  return out;
}

/**
 * A cone, never a rounded square: a trapezoid 60 wide at the base tapering to
 * 16, standing on a 56x14 plate, with two white bands.
 */
function pylonArt(b: Box): string {
  const skin = SKINS.yellow;
  const baseY = b.y + b.h - 12;
  const topY = b.y + 8;
  const left = b.cx - 30;
  const right = b.cx + 30;
  const tipL = b.cx - 8;
  const tipR = b.cx + 8;
  let out = `<path d="M ${n(left)} ${n(baseY)} L ${n(tipL)} ${n(topY)} L ${n(tipR)} ${n(topY)} L ${n(right)} ${n(baseY)} Z" fill="${skin.body}" fill-opacity="${FILL_OPACITY}" stroke="${skin.edge}" stroke-width="3" stroke-linejoin="round"/>`;
  for (const t of [0.42, 0.62]) {
    const y = topY + (baseY - topY) * t;
    const halfWidth = 8 + (30 - 8) * t;
    out += `<line x1="${n(b.cx - halfWidth + 2)}" y1="${n(y)}" x2="${n(b.cx + halfWidth - 2)}" y2="${n(y)}" stroke="#FFFFFF" stroke-width="6" opacity="0.8"/>`;
  }
  out += `<rect x="${n(b.cx - 28)}" y="${n(baseY)}" width="56" height="14" rx="4" fill="${skin.body}" fill-opacity="${FILL_OPACITY}" stroke="${skin.edge}" stroke-width="3"/>`;
  return out;
}

function pieceSvg(piece: Piece, mode: BoardMode): string {
  const b = boxOf(piece);
  const detail = mode !== "thumb";
  let art: string;
  if (piece.kind === "pylon") art = pylonArt(b);
  else if (piece.kind === "hero") art = heroArt(b, detail);
  else if (piece.kind === "truck") art = truckArt(b, SKINS[piece.colour], detail);
  else art = carArt(b, SKINS[piece.colour], detail);

  const spin =
    piece.orientation === "v" ? ` transform="rotate(90 ${n(b.cx)} ${n(b.cy)})"` : "";
  const title = mode === "thumb" ? "" : `<title>${esc(pieceLabel(piece))}</title>`;
  let out = `<g${spin}>${title}${art}</g>`;

  // The colour letter sits outside the rotated group so it turns only with the
  // board, and the counter-rotation in globals.css keeps it upright.
  if (mode === "card") {
    const initial = COLOUR_INITIAL[piece.colour];
    if (initial) {
      out += `<text class="tp-piece-label" x="${n(b.cx)}" y="${n(b.cy)}" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="700" fill="${COLOURS.asphalt}" opacity="0">${initial}</text>`;
    }
  }
  return out;
}

function chrome(mode: BoardMode): string {
  const gapTop = IN + EXIT_ROW * CELL;
  const lipX = MARGIN + BAND + INTERIOR + BAND - LIP; // 688
  const notchX = IN + INTERIOR; // 660
  const mid = gapTop + CELL / 2; // 310

  let out = "";
  // Frame: rounded on the outside, square against the asphalt.
  out += `<rect x="${MARGIN}" y="${MARGIN}" width="${SIZE - MARGIN * 2}" height="${SIZE - MARGIN * 2}" rx="24" fill="${COLOURS.frame}"/>`;
  out += `<rect x="${IN}" y="${IN}" width="${INTERIOR}" height="${INTERIOR}" fill="${COLOURS.asphalt}"/>`;
  // The road runs on through the gap and stops at the lip.
  out += `<rect x="${notchX}" y="${gapTop}" width="${BAND - LIP}" height="${CELL}" fill="${COLOURS.asphalt}"/>`;
  out += `<rect x="${lipX}" y="${gapTop}" width="${LIP}" height="${CELL}" rx="4" fill="${COLOURS.glow}"/>`;

  if (mode === "card") {
    out += `<text class="tp-exit-label" x="${n(notchX + (BAND - LIP) / 2)}" y="${mid}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" letter-spacing="2" fill="${COLOURS.glow}">EXIT</text>`;
  }

  // Centre line down the exit row, with a chevron at each end pointing out.
  out += `<line x1="${IN + 4}" y1="${mid}" x2="${lipX - 4}" y2="${mid}" stroke="${COLOURS.glow}" stroke-width="4" stroke-dasharray="28 22" opacity="0.55"/>`;
  for (const cx of [IN + 22, notchX - 26]) {
    out += `<polyline points="${n(cx - 11)},${mid - 15} ${n(cx + 5)},${mid} ${n(cx - 11)},${mid + 15}" fill="none" stroke="${COLOURS.glow}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
  }

  // Thumbs drop both of these on top of the highlight, ribs and windscreens the
  // spec names: 85 sub-pixel circles per tile, times sixty tiles, that read as
  // grey haze rather than as detail at 56px.
  if (mode !== "thumb") {
    // White dots at cell centres, under the pieces: the translucent bodies let
    // them through, as on the real print.
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        out += `<circle cx="${IN + c * CELL + CELL / 2}" cy="${IN + r * CELL + CELL / 2}" r="9" fill="#FFFFFF" opacity="0.9"/>`;
      }
    }
    // Pegs at the 7x7 grid corners.
    for (let r = 0; r <= 6; r++) {
      for (let c = 0; c <= 6; c++) {
        out += `<circle cx="${IN + c * CELL}" cy="${IN + r * CELL}" r="7" fill="${PEG}" opacity="${PEG_OPACITY}"/>`;
      }
    }
  }
  return out;
}

/** Columns A-F and rows 1-6, faint on the frame and turning with the board. */
function frameLabels(): string {
  let out = "";
  const letters = "ABCDEF";
  for (let i = 0; i < 6; i++) {
    out += `<text class="tp-frame-label" x="${IN + i * CELL + CELL / 2}" y="${MARGIN + BAND / 2}" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="600" fill="${COLOURS.ink}" opacity="0.35">${letters[i]}</text>`;
    out += `<text class="tp-frame-label" x="${MARGIN + BAND / 2}" y="${IN + i * CELL + CELL / 2}" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="600" fill="${COLOURS.ink}" opacity="0.35">${i + 1}</text>`;
  }
  return out;
}

/**
 * The whole diagram as one SVG string.
 *
 * @param pieces  the card's pieces, hero first, in `data/deck.json` order
 * @param mode    `card` full detail and lettering, `thumb` the 56px deck tile,
 *                `og` full detail with no text (the image route rasterises this
 *                through satori, which has no stylesheet and no font for it).
 *                `thumb` drops more than the spec's highlight, ribs and
 *                windscreens: the 49 pegs and the 36 white cell dots go too.
 *                At 56px they land under a pixel each and only turn the
 *                asphalt grey, and dropping them takes 85 nodes out of every
 *                one of the sixty tiles on the deck page.
 * @param board   Fogleman's 36-character string, carried as `data-board`
 * @param label   the `aria-label`; defaults to the piece list
 */
export function renderBoard(
  pieces: readonly Piece[],
  mode: BoardMode = "card",
  board?: string,
  label?: string,
): string {
  const body =
    chrome(mode) +
    pieces.map((p) => pieceSvg(p, mode)).join("") +
    (mode === "card" ? frameLabels() : "");

  const data = board ? ` data-board="${esc(board)}"` : "";
  if (mode === "thumb") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true" focusable="false"${data}>${body}</svg>`;
  }
  const aria = esc(label ?? pieces.map((p) => pieceLabel(p)).join(", "));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${aria}" focusable="false"${data}>${body}</svg>`;
}
