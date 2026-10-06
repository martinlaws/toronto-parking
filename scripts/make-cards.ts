import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isValidCode } from "../src/lib/code";
import { SITE_URL } from "../src/lib/site";
import { COLOURS } from "../src/lib/theme";
import { BOARD_COUNT, DEFAULT_FILE, validateSeedFile } from "./seed-boards";

/**
 * The card that goes in the box: A7, one per board, printed at true size on a
 * sheet with crop marks. The front carries the QR from `out/qr/` (read, never
 * regenerated, so the printed code is the one already scanned), the code set
 * large enough to type when a camera fails, and the domain. No name and no
 * dedication from the seed file: the surprise is on the page the card opens,
 * and nothing here reads either. A card can still be addressed by hand with
 * `--to <name>`, which prints "To <name>" under the title, and signed with
 * `--from <name>`, which replaces the title with "From <name>"; the name comes from
 * the command line only, so it never lands in the repo.
 *
 * The back is optional and asks for duplex. Its sheet is mirrored left to right
 * so a long-edge flip lands each back behind its front, and the asphalt runs
 * 3 mm past the trim so a printer's drift does not leave a white edge.
 *
 * `--explain` swaps the front's two lines for four that say what the thing is,
 * what the QR opens and what the page does with a solve. Off by default, so a
 * card already printed can be printed again exactly.
 *
 * `--front birthday` is a quarter fold whose cover is a few balloons and
 * "Happy birthday", with the `--to` name. The QR panel moves inside, on the
 * right-hand page, and always carries the `--explain` lines; the left-hand page
 * stays blank for a note. The inside is the top half of the sheet printed
 * upside down, which the two folds turn the right way up.
 *
 * Output goes to the gitignored `out/cards/`. Print at 100%, never "fit".
 */

const CARD_W = 74;
const CARD_H = 105;
const GUTTER = 16;
const BLEED = 3;
const MARK_GAP = 2;
const MARK_LEN = 5;

export const PAPER = {
  letter: { w: 215.9, h: 279.4, css: "letter" },
  a4: { w: 210, h: 297, css: "A4" },
} as const;

export type Paper = keyof typeof PAPER;

export type CardOptions = {
  file: string;
  qr: string;
  out: string;
  boards: number[];
  back: boolean;
  paper: Paper;
  to: string;
  from: string;
  fold: Fold;
  front: Front;
  explain: boolean;
};

export type Fold = "none" | "half" | "quarter";

/** `qr`: the QR panel is the cover, as on every card so far. `birthday`: see the header. */
export type Front = "qr" | "birthday";

export type CardFace = { n: number; code: string; qrSvg: string; to?: string; from?: string };

export type Slot = { x: number; y: number };

const NUMBER_WORDS = ["one", "two", "three", "four", "five"];

/** What the QR panel says, one sentence to a line. `short` is what boards 2 and
 *  3 were printed with. `explain` is for a reader holding the card cold, and
 *  every claim in it is something the board page does: each card has a
 *  `Mark solved` toggle, and the board page ticks the solved ones, counts them
 *  per tier and offers `Pick up at #n`. */
export const WORDS = {
  short: ["I made you a puzzle.", "Scan this for sixty ways to play it."],
  explain: [
    "I 3D-printed you a puzzle.",
    "Slide the cars to get the red one out.",
    "Scan this for sixty setups to try.",
    "Mark them solved and the page keeps track.",
  ],
} as const;

/** The A7 front sheet is a 2 x 2 grid, so a fifth card starts a second sheet. */
export const SHEET_CARDS = 4;

export function parseCardArgs(argv: string[]): CardOptions {
  const options: CardOptions = {
    file: DEFAULT_FILE,
    qr: "out/qr",
    out: "out/cards",
    boards: [],
    back: false,
    paper: "letter",
    to: "",
    from: "",
    fold: "none",
    front: "qr",
    explain: false,
  };
  const value =(token: string, name: string, next: () => string | undefined): string => {
    const inline = token.startsWith(`${name}=`) ? token.slice(name.length + 1) : undefined;
    const raw = inline ?? next();
    if (raw === undefined || raw === "") throw new Error(`${name} needs a value`);
    return raw;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i];
    const name = token.split("=")[0];
    if (name === "--file") options.file = value(token, name, next);
    else if (name === "--qr") options.qr = value(token, name, next);
    else if (name === "--out") options.out = value(token, name, next);
    else if (name === "--back") options.back = true;
    else if (token === "--fold") {
      const word = argv[i + 1];
      options.fold = word === "half" || word === "quarter" ? (i++, word) : "half";
    }
    else if (name === "--fold") {
      const fold = value(token, name, next);
      if (fold !== "half" && fold !== "quarter") throw new Error(`--fold is half or quarter, not ${fold}`);
      options.fold = fold;
    }
    else if (name === "--explain") options.explain = true;
    else if (name === "--front") {
      const front = value(token, name, next);
      if (front !== "qr" && front !== "birthday") throw new Error(`--front is qr or birthday, not ${front}`);
      options.front = front;
    }
    else if (name === "--to") options.to = value(token, name, next).trim();
    else if (name === "--from") options.from = value(token, name, next).trim();
    else if (name === "--paper") {
      const paper = value(token, name, next);
      if (paper !== "letter" && paper !== "a4") throw new Error(`--paper is letter or a4, not ${paper}`);
      options.paper = paper;
    } else if (name === "--board") {
      const n = Number(value(token, name, next));
      if (!Number.isInteger(n) || n < 1 || n > BOARD_COUNT) {
        throw new Error(`--board is a number from 1 to ${BOARD_COUNT}`);
      }
      if (!options.boards.includes(n)) options.boards.push(n);
    } else throw new Error(`Unknown argument ${token}`);
  }
  if (options.to !== "" && options.boards.length !== 1) {
    throw new Error("--to addresses one card, so it needs exactly one --board");
  }
  if (options.explain && options.to !== "" && options.front === "qr") {
    throw new Error(
      "--explain takes the room the --to line needs on the QR panel. Drop --to, or use --front birthday, which puts the name on the cover",
    );
  }
  if (options.front === "birthday" && options.fold !== "quarter") {
    throw new Error("--front birthday puts the QR inside, so it needs --fold quarter");
  }
  return options;
}

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** One card sits in the middle of the page; two to four take a 2 x 2 grid. */
export function frontSlots(count: number, paper: Paper): Slot[] {
  const { w, h } = PAPER[paper];
  if (count === 1) return [{ x: (w - CARD_W) / 2, y: (h - CARD_H) / 2 }];
  const x0 = (w - (2 * CARD_W + GUTTER)) / 2;
  const y0 = (h - (2 * CARD_H + GUTTER)) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + (i % 2) * (CARD_W + GUTTER),
    y: y0 + Math.floor(i / 2) * (CARD_H + GUTTER),
  }));
}

/** A long-edge flip mirrors the sheet left to right and leaves the rows alone. */
export function backSlots(front: Slot[], paper: Paper): Slot[] {
  const { w } = PAPER[paper];
  return front.map(({ x, y }) => ({ x: w - x - CARD_W, y }));
}

/** The white margin round each panel of a folded card: home printers cannot
 *  print to the edge, so the dark back sits inside a border that looks meant. */
export const FOLD_MARGIN = 8;

/**
 * A folded card, printed on one side. `half`: the sheet turned landscape and
 * folded down the middle, the back on the left half and the front on the
 * right. `quarter`: the sheet upright and folded twice, top half behind and
 * then left half behind, so the back and front take the bottom two quarters
 * and the top half becomes the inside, left blank for a note.
 *
 * The A7 design scales up uniformly to the largest size that fits a panel
 * inside the margin, centred across it; the spare height goes to the gap above
 * the code, as on A7.
 */
export function foldGeometry(paper: Paper, fold: Exclude<Fold, "none">) {
  const { w, h } = PAPER[paper];
  const sheet = fold === "half" ? { w: h, h: w } : { w, h };
  const panel = fold === "half" ? { w: sheet.w / 2, h: sheet.h } : { w: sheet.w / 2, h: sheet.h / 2 };
  const scale = Math.min((panel.w - 2 * FOLD_MARGIN) / CARD_W, (panel.h - 2 * FOLD_MARGIN) / CARD_H);
  const cardH = (panel.h - 2 * FOLD_MARGIN) / scale;
  const inset = { x: (panel.w - CARD_W * scale) / 2, y: FOLD_MARGIN };
  const top = fold === "half" ? 0 : panel.h;
  return {
    sheet,
    panel,
    scale,
    cardH,
    inset,
    back: { x: 0, y: top },
    front: { x: panel.w, y: top },
    // A quarter fold's inside spread, drawn upright in a box the size of the
    // top half that is then turned 180 degrees: the right-hand page lands top
    // left on the sheet, upside down, and the folds right it.
    inside: { left: { x: 0, y: 0 }, right: { x: panel.w, y: 0 } },
  };
}

export function numberWord(n: number): string {
  const word = NUMBER_WORDS[n - 1];
  if (!word) throw new Error(`No board ${n}`);
  return word;
}

/** The QR as `make-qr` wrote it, checked to be that and nothing else. */
export function checkQrSvg(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>") || /<script|on\w+=/i.test(trimmed)) {
    throw new Error("not a QR svg from pnpm qr:build");
  }
  return trimmed;
}

const mm = (value: number) => `${Number(value.toFixed(2))}mm`;

function cropMarks({ x, y }: Slot): string {
  const lines: string[] = [];
  for (const cx of [x, x + CARD_W]) {
    for (const cy of [y, y + CARD_H]) {
      const dx = cx === x ? -1 : 1;
      const dy = cy === y ? -1 : 1;
      const h0 = cx + dx * MARK_GAP;
      const v0 = cy + dy * MARK_GAP;
      lines.push(
        `<line x1="${h0}" y1="${cy}" x2="${h0 + dx * MARK_LEN}" y2="${cy}"/>`,
        `<line x1="${cx}" y1="${v0}" x2="${cx}" y2="${v0 + dy * MARK_LEN}"/>`,
      );
    }
  }
  return lines.join("");
}

const heightStyle = (h: number) => (h === CARD_H ? "" : `;height:${mm(h)}`);

function front(face: CardFace, slot: Slot, h = CARD_H, explain = false): string {
  const domain = new URL(SITE_URL).host;
  const words = explain ? WORDS.explain : WORDS.short;
  return `<section class="card front" style="left:${mm(slot.x)};top:${mm(slot.y)}${heightStyle(h)}">
  <p class="pk">${face.from ? `From ${escapeHtml(face.from)}` : "Toronto Parking"}</p>
  <div class="pkrule"></div>
  ${face.to ? `<p class="to">To ${escapeHtml(face.to)}</p>\n  ` : ""}${
    explain
      ? `<p class="what explain">${words.map((line) => `<span>${line}</span>`).join("")}</p>`
      : `<p class="what">${words.join("<br>")}</p>`
  }
  <div class="qrwrap">${face.qrSvg}</div>
  <div class="paddr">
    <p class="crow"><span class="cl">Code</span><span class="cv">${face.code}</span></p>
    <p class="url">${domain}</p>
  </div>
</section>`;
}

/** Three balloons in the piece colours, each a pale body with its edge colour
 *  round the rim, the way a translucent piece reads. Card millimetres. */
const BALLOONS = [
  { fill: COLOURS.carBlue, edge: COLOURS.carBlueEdge, x: 29, y: 33, w: 12.4, h: 15.2, turn: -10 },
  { fill: COLOURS.carYellow, edge: COLOURS.carYellowEdge, x: 47.5, y: 36.5, w: 12, h: 14.8, turn: 11 },
  { fill: COLOURS.hero, edge: COLOURS.heroEdge, x: 38.5, y: 26, w: 13, h: 16, turn: 2 },
] as const;

const GATHER = { x: 37.5, y: 67 };

const n2 = (value: number) => Number(value.toFixed(2));

function balloons(): string {
  const strings: string[] = [];
  const bodies: string[] = [];
  for (const b of BALLOONS) {
    const { w, h } = b;
    const r = w / 2;
    const knot = h / 2 + 1.2;
    const shape =
      `M0 ${n2(h / 2)}` +
      `C${n2(0.18 * w)} ${n2(0.4 * h)} ${n2(r)} ${n2(0.16 * h)} ${n2(r)} ${n2(-0.08 * h)}` +
      `C${n2(r)} ${n2(-0.36 * h)} ${n2(0.27 * w)} ${n2(-h / 2)} 0 ${n2(-h / 2)}` +
      `C${n2(-0.27 * w)} ${n2(-h / 2)} ${n2(-r)} ${n2(-0.36 * h)} ${n2(-r)} ${n2(-0.08 * h)}` +
      `C${n2(-r)} ${n2(0.16 * h)} ${n2(-0.18 * w)} ${n2(0.4 * h)} 0 ${n2(h / 2)}Z`;
    bodies.push(
      `<g transform="translate(${b.x} ${b.y}) rotate(${b.turn})">` +
        `<path d="${shape}" fill="${b.fill}" stroke="${b.edge}" stroke-width="0.3"/>` +
        `<path d="M0 ${n2(h / 2)}L-0.8 ${n2(knot)}L0.8 ${n2(knot)}Z" fill="${b.edge}"/>` +
        `<ellipse cx="${n2(-0.2 * w)}" cy="${n2(-0.2 * h)}" rx="${n2(0.08 * w)}" ry="${n2(0.15 * h)}" transform="rotate(20 ${n2(-0.2 * w)} ${n2(-0.2 * h)})" fill="#fff" fill-opacity=".55"/>` +
        `</g>`,
    );
    // Where the knot sits once the balloon is turned, so the string starts on it.
    const t = (b.turn * Math.PI) / 180;
    const kx = b.x - knot * Math.sin(t);
    const ky = b.y + knot * Math.cos(t);
    const drop = GATHER.y - ky;
    strings.push(
      `<path d="M${n2(kx)} ${n2(ky)}C${n2(kx)} ${n2(ky + drop * 0.45)} ${n2(GATHER.x + (kx - GATHER.x) * 0.3)} ${n2(GATHER.y - drop * 0.35)} ${GATHER.x} ${GATHER.y}"/>`,
    );
  }
  const tail = `<path d="M${GATHER.x} ${GATHER.y}c0.6 2.2 -0.5 3.6 0.2 5.6"/>`;
  return `<g fill="none" stroke="#9A9384" stroke-width="0.22" stroke-linecap="round">${strings.join("")}${tail}</g>${bodies.join("")}`;
}

/** The birthday cover: balloons, one line, and white paper. No QR and no name
 *  but the one given with `--to`. */
function cover(face: CardFace, slot: Slot, h = CARD_H): string {
  const line = face.to ? `Happy birthday, ${escapeHtml(face.to)}.` : "Happy birthday.";
  return `<section class="card cover" style="left:${mm(slot.x)};top:${mm(slot.y)}${heightStyle(h)}">
  <svg class="balloons" viewBox="0 0 ${CARD_W} ${n2(h)}" aria-hidden="true">${balloons()}</svg>
  <p class="hb">${line}</p>
</section>`;
}

function inks(h: number): string {
  const colours = [
    COLOURS.asphalt,
    COLOURS.frame,
    COLOURS.glow,
    COLOURS.carBlue,
    COLOURS.carYellow,
    COLOURS.carGreen,
    COLOURS.hero,
  ];
  const w = (CARD_W - 16 - 6 * 1.3) / 7;
  return colours
    .map(
      (fill, i) =>
        `<rect x="${Number((8 + i * (w + 1.3)).toFixed(3))}" y="${Number((h - 7 - 2.86).toFixed(3))}" width="${Number(w.toFixed(3))}" height="2.86" rx="0.4" fill="${fill}" stroke="rgba(255,255,255,.3)" stroke-width="0.16"/>`,
    )
    .join("");
}

function pegField(h: number, bleed: number): string {
  const dots: string[] = [];
  for (let cx = 4.9 - 10.9; cx < CARD_W + bleed; cx += 10.9) {
    for (let cy = 6.4 - 10.9; cy < h + bleed; cy += 10.9) {
      if (cx < -bleed || cy < -bleed) continue;
      dots.push(`<circle cx="${Number(cx.toFixed(2))}" cy="${Number(cy.toFixed(2))}" r="0.45"/>`);
    }
  }
  return `<g fill="${COLOURS.frame}" fill-opacity=".13">${dots.join("")}</g>`;
}

function back(face: CardFace, slot: Slot, h = CARD_H, bleed = BLEED): string {
  const g = COLOURS.glow;
  const gw = CARD_W + 2 * bleed;
  const gh = Number((h + 2 * bleed).toFixed(3));
  return `<section class="card back" style="left:${mm(slot.x)};top:${mm(slot.y)}${heightStyle(h)}">
  <svg class="ground" style="left:${mm(-bleed)};top:${mm(-bleed)};width:${mm(gw)};height:${mm(gh)}" viewBox="${-bleed} ${-bleed} ${gw} ${gh}" aria-hidden="true">
    <rect x="${-bleed}" y="${-bleed}" width="${gw}" height="${gh}" fill="${COLOURS.asphalt}"/>
    ${pegField(h, bleed)}
    ${inks(h)}
  </svg>
  <div class="backin">
    <svg class="exitmark" viewBox="0 0 132 40" aria-hidden="true">
      <line x1="2" y1="20" x2="88" y2="20" stroke="${g}" stroke-width="2.4" stroke-dasharray="11 9" opacity=".55"/>
      <polyline points="96,10 106,20 96,30" fill="none" stroke="${g}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="124" y="3" width="5.5" height="34" rx="2.75" fill="${g}"/>
    </svg>
    <p class="bk">Board ${numberWord(face.n)} of ${numberWord(BOARD_COUNT)}</p>
    <p class="bsig">&#8212;&#160;Martin</p>
  </div>
</section>`;
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=DM+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=block";

/** Rules a sheet needs only when it uses them, so a card printed before they
 *  existed renders byte for byte as it did. */
type Extras = { explain?: boolean; birthday?: boolean };

function extraStyles({ explain = false, birthday = false }: Extras): string {
  const rules: string[] = [];
  // Four sentences where the short front has two: a step smaller, so four
  // lines sit where two did without moving the QR. Each sentence is its own
  // line, balanced if a long name of a word ever pushes it to two.
  if (explain) {
    rules.push(".what.explain{margin-top:2mm;font-size:3mm;line-height:1.3}", ".what.explain span{display:block;text-wrap:balance}");
  }
  if (birthday) {
    rules.push(
      ".inside{position:absolute;left:0;top:0;transform:rotate(180deg)}",
      ".cover{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:6mm 6mm 13mm}",
      ".cover .balloons{position:absolute;left:0;top:0;width:100%;height:100%}",
      `.hb{position:relative;font-family:"Newsreader",Georgia,serif;font-style:italic;font-variation-settings:"opsz" 20;font-size:5.6mm;line-height:1.15;text-align:center;text-wrap:balance;color:#0F6B4B}`,
    );
  }
  return rules.length > 0 ? `\n${rules.join("\n")}` : "";
}

function styles(paper: Paper, fold: Fold = "none", extras: Extras = {}): string {
  const p = PAPER[paper];
  const sheet = fold === "half" ? { w: p.h, h: p.w } : p;
  return `@page{size:${p.css}${fold === "half" ? " landscape" : ""};margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:${sheet.w}mm;height:${sheet.h}mm;overflow:hidden;break-after:page}
.panel{position:absolute;transform-origin:0 0}
.sheet:last-child{break-after:auto}
.marks{position:absolute;inset:0;width:100%;height:100%}
.marks line{stroke:#000;stroke-width:.2}
.card{position:absolute;width:${CARD_W}mm;height:${CARD_H}mm}
.front{padding:6mm;display:flex;flex-direction:column;align-items:center;color:#5F5A4C}
.pk{align-self:stretch;font-family:"DM Mono",ui-monospace,monospace;font-size:2.21mm;line-height:1;letter-spacing:.28em;text-transform:uppercase;color:#7C7568}
.pkrule{align-self:stretch;height:.26mm;background:#DED8CB;margin-top:2.08mm}
.to{align-self:stretch;margin-top:3.2mm;font-family:"Newsreader",Georgia,serif;font-style:italic;font-variation-settings:"opsz" 20;font-size:5.6mm;line-height:1.1;color:#0F6B4B}
.to + .what{margin-top:1.6mm}
.what{align-self:stretch;margin-top:2.34mm;font-family:"Newsreader",Georgia,serif;font-variation-settings:"opsz" 13;font-size:3.5mm;line-height:1.36;text-wrap:balance}
.qrwrap{width:49mm;height:49mm;margin-top:3.4mm}
.qrwrap svg{display:block;width:100%;height:100%}
.paddr{align-self:stretch;margin-top:auto;padding-top:3.1mm;border-top:.26mm solid #DED8CB}
.crow{display:flex;align-items:baseline;gap:2.6mm}
.cl{font-family:"DM Mono",ui-monospace,monospace;font-size:1.95mm;line-height:1;letter-spacing:.2em;text-transform:uppercase;color:#9A9384}
.cv{font-family:"DM Mono",ui-monospace,monospace;font-weight:500;font-size:5.45mm;line-height:1;letter-spacing:.22em;color:#131714}
.url{margin-top:2.86mm;font-family:"Archivo",system-ui,sans-serif;font-variation-settings:"wdth" 100,"wght" 650;font-size:3.5mm;letter-spacing:.01em}
.back{overflow:visible}
.back .ground{position:absolute}
.backin{position:absolute;inset:0;padding:8mm 8mm 20mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
.exitmark{width:27mm;height:auto;display:block}
.bk{margin-top:7mm;font-family:"DM Mono",ui-monospace,monospace;font-size:2.47mm;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:#95908A}
.bsig{margin-top:3.38mm;font-family:"Newsreader",Georgia,serif;font-style:italic;font-variation-settings:"opsz" 20;font-size:5.97mm;line-height:1;color:${COLOURS.glow}}${extraStyles(extras)}`;
}

export function renderSheet(
  faces: CardFace[],
  options: Pick<CardOptions, "back" | "paper"> & { explain?: boolean },
): string {
  if (faces.length === 0 || faces.length > BOARD_COUNT) {
    throw new Error(`A run holds 1 to ${BOARD_COUNT} cards`);
  }
  const { w, h } = PAPER[options.paper];
  const explain = options.explain ?? false;
  const runs: CardFace[][] = [];
  for (let i = 0; i < faces.length; i += SHEET_CARDS) runs.push(faces.slice(i, i + SHEET_CARDS));
  // Each sheet of fronts is followed by its own backs, so duplex pairs them.
  const sheets = runs.map((run) => {
    const slots = frontSlots(run.length, options.paper);
    const fronts = `<div class="sheet">
<svg class="marks" viewBox="0 0 ${w} ${h}" aria-hidden="true">${slots.map(cropMarks).join("")}</svg>
${run.map((face, i) => front(face, slots[i], CARD_H, explain)).join("\n")}
</div>`;
    const backs = options.back
      ? `\n<div class="sheet">
${run.map((face, i) => back(face, backSlots(slots, options.paper)[i])).join("\n")}
</div>`
      : "";
    return `${fronts}${backs}`;
  });
  return documentOf(sheets.join("\n"), styles(options.paper, "none", { explain }));
}

/** One sheet per card, laid out by `foldGeometry()`. */
export function renderFoldSheet(
  faces: CardFace[],
  paper: Paper,
  fold: Exclude<Fold, "none"> = "half",
  options: { front?: Front; explain?: boolean } = {},
): string {
  if (faces.length === 0 || faces.length > BOARD_COUNT) {
    throw new Error(`A run holds 1 to ${BOARD_COUNT} cards`);
  }
  const birthday = options.front === "birthday";
  if (birthday && fold !== "quarter") throw new Error("A birthday card is a quarter fold");
  const explain = birthday || (options.explain ?? false);
  const g = foldGeometry(paper, fold);
  const panel = (at: Slot, inner: string) =>
    `<div class="panel" style="left:${mm(at.x + g.inset.x)};top:${mm(at.y + g.inset.y)};width:${mm(CARD_W)};height:${mm(g.cardH)};transform:scale(${Number(g.scale.toFixed(5))})">
${inner}
</div>`;
  const origin = { x: 0, y: 0 };
  const sheets = faces.map((face) => {
    if (!birthday) {
      return `<div class="sheet">
${panel(g.back, back(face, origin, g.cardH, 0))}
${panel(g.front, front(face, origin, g.cardH, explain))}
</div>`;
    }
    // The greeting is on the cover, so the QR panel inside carries no To line.
    const inside: CardFace = { n: face.n, code: face.code, qrSvg: face.qrSvg, ...(face.from ? { from: face.from } : {}) };
    return `<div class="sheet">
<div class="inside" style="width:${mm(g.sheet.w)};height:${mm(g.panel.h)}">
${panel(g.inside.right, front(inside, origin, g.cardH, true))}
</div>
${panel(g.back, back(face, origin, g.cardH, 0))}
${panel(g.front, cover(face, origin, g.cardH))}
</div>`;
  });
  return documentOf(sheets.join("\n"), styles(paper, fold, { explain, birthday }));
}

function documentOf(body: string, css: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Toronto Parking cards</title>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

function main(argv: string[]): void {
  let options: CardOptions;
  try {
    options = parseCardArgs(argv);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(options.file, "utf8"));
  } catch (error) {
    fail(`Could not read ${options.file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = validateSeedFile(raw, { isCode: isValidCode });
  if (!parsed.ok) fail(`${options.file} is not a seed file:\n  ${parsed.problems.join("\n  ")}`);

  const wanted = options.boards.length > 0 ? options.boards : parsed.entries.map((entry) => entry.n);
  const faces: CardFace[] = [];
  for (const n of [...wanted].sort((a, b) => a - b)) {
    const entry = parsed.entries.find((candidate) => candidate.n === n);
    if (!entry || entry.code === "") fail(`Board ${n} has no code yet. Run pnpm boards:seed first.`);
    let svg: string;
    try {
      svg = checkQrSvg(readFileSync(join(options.qr, `${entry.code}.svg`), "utf8"));
    } catch (error) {
      fail(
        `No usable QR for board ${n} in ${options.qr}: ${error instanceof Error ? error.message : String(error)}. Run pnpm qr:build.`,
      );
    }
    faces.push({ n, code: entry.code, qrSvg: svg, ...(options.to ? { to: options.to } : {}), ...(options.from ? { from: options.from } : {}) });
  }

  mkdirSync(options.out, { recursive: true });
  const name = options.boards.length === 0 ? "cards" : `board-${[...wanted].sort((a, b) => a - b).join("-")}`;
  const suffix = options.fold === "half" ? "-folded" : options.fold === "quarter" ? "-quarter" : options.back ? "-duplex" : "";
  // A new front or new words get their own file, so the plain card beside it survives.
  const variant = options.front === "birthday" ? "-birthday" : options.explain ? "-explain" : "";
  const path = join(options.out, `${name}${suffix}${variant}.html`);
  writeFileSync(
    path,
    options.fold === "none"
      ? renderSheet(faces, options)
      : renderFoldSheet(faces, options.paper, options.fold, { front: options.front, explain: options.explain }),
    "utf8",
  );
  const how =
    options.fold === "half"
      ? ", one landscape sheet each, fold down the middle with the print outside"
      : options.fold === "quarter"
        ? `, one sheet each, fold the top half behind, then the left half behind${options.front === "birthday" ? "; the QR is inside, on the right" : ""}`
        : options.back
      ? faces.length > SHEET_CARDS
        ? ", each page of backs after its fronts, for a long-edge flip"
        : ", backs on page 2 for a long-edge flip"
      : "";
  process.stdout.write(
    `✓ ${path} · ${faces.length} card${faces.length === 1 ? "" : "s"}${how}\n` +
      `Open it in Chrome and print at 100% on ${options.paper === "a4" ? "A4" : "Letter"}, with Background graphics on.\n`,
  );
}

if (/make-cards\.(ts|mts|js|mjs)$/.test(process.argv[1] ?? "")) {
  main(process.argv.slice(2));
}
