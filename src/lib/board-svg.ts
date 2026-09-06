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
 * The hero: a cabriolet with the roof off. The open cockpit and its two seat
 * arcs are the shape a red/green-blind reader picks it out by, so they stay in
 * every mode that draws detail.
 */
function heroArt(b: Box, detail: boolean): string {
  const skin = SKINS.red;
  let out = shell(b, skin, detail);
  const cw = b.w * 0.46;
  const ch = b.h - 30;
  const cxL = b.cx - cw / 2;
  const cyT = b.cy - ch / 2;
  out += `<rect x="${n(cxL)}" y="${n(cyT)}" width="${n(cw)}" height="${n(ch)}" rx="16" fill="${COLOURS.asphalt}" fill-opacity="0.72"/>`;
  out += `<rect x="${n(cxL)}" y="${n(cyT)}" width="${n(cw)}" height="${n(ch)}" rx="16" fill="none" stroke="${skin.edge}" stroke-width="2.5"/>`;
  const r = ch * 0.3;
  for (const seat of [b.cx - cw * 0.22, b.cx + cw * 0.22]) {
    out += `<path d="M ${n(seat - r)} ${n(b.cy + r * 0.7)} A ${n(r)} ${n(r)} 0 0 1 ${n(seat + r)} ${n(b.cy + r * 0.7)}" fill="none" stroke="${skin.edge}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (detail) {
    out += `<rect x="${n(b.x + 10)}" y="${n(b.y + 8)}" width="${n(b.w - 20)}" height="7" rx="3.5" fill="${skin.edge}" opacity="${HIGHLIGHT_OPACITY}"/>`;
  }
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
 *                through satori, which has no stylesheet and no font for it)
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
