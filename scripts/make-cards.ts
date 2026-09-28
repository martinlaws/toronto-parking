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
 * `--to <name>`, which prints "To <name>" under the title; the name comes from
 * the command line only, so it never lands in the repo.
 *
 * The back is optional and asks for duplex. Its sheet is mirrored left to right
 * so a long-edge flip lands each back behind its front, and the asphalt runs
 * 3 mm past the trim so a printer's drift does not leave a white edge.
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
};

export type CardFace = { n: number; code: string; qrSvg: string; to?: string };

export type Slot = { x: number; y: number };

const NUMBER_WORDS = ["one", "two", "three", "four"];

export function parseCardArgs(argv: string[]): CardOptions {
  const options: CardOptions = {
    file: DEFAULT_FILE,
    qr: "out/qr",
    out: "out/cards",
    boards: [],
    back: false,
    paper: "letter",
    to: "",
  };
  const value = (token: string, name: string, next: () => string | undefined): string => {
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
    else if (name === "--to") options.to = value(token, name, next).trim();
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

function front(face: CardFace, slot: Slot): string {
  const domain = new URL(SITE_URL).host;
  return `<section class="card front" style="left:${mm(slot.x)};top:${mm(slot.y)}">
  <p class="pk">Toronto Parking</p>
  <div class="pkrule"></div>
  ${face.to ? `<p class="to">To ${escapeHtml(face.to)}</p>\n  ` : ""}<p class="what">I made you a puzzle.<br>Scan this for sixty ways to play it.</p>
  <div class="qrwrap">${face.qrSvg}</div>
  <div class="paddr">
    <p class="crow"><span class="cl">Code</span><span class="cv">${face.code}</span></p>
    <p class="url">${domain}</p>
  </div>
</section>`;
}

function inks(): string {
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
        `<rect x="${Number((8 + i * (w + 1.3)).toFixed(3))}" y="${CARD_H - 7 - 2.86}" width="${Number(w.toFixed(3))}" height="2.86" rx="0.4" fill="${fill}" stroke="rgba(255,255,255,.3)" stroke-width="0.16"/>`,
    )
    .join("");
}

function pegField(): string {
  const dots: string[] = [];
  for (let cx = 4.9 - 10.9; cx < CARD_W + BLEED; cx += 10.9) {
    for (let cy = 6.4 - 10.9; cy < CARD_H + BLEED; cy += 10.9) {
      if (cx < -BLEED || cy < -BLEED) continue;
      dots.push(`<circle cx="${Number(cx.toFixed(2))}" cy="${Number(cy.toFixed(2))}" r="0.45"/>`);
    }
  }
  return `<g fill="${COLOURS.frame}" fill-opacity=".13">${dots.join("")}</g>`;
}

function back(face: CardFace, slot: Slot): string {
  const g = COLOURS.glow;
  return `<section class="card back" style="left:${mm(slot.x)};top:${mm(slot.y)}">
  <svg class="ground" viewBox="${-BLEED} ${-BLEED} ${CARD_W + 2 * BLEED} ${CARD_H + 2 * BLEED}" aria-hidden="true">
    <rect x="${-BLEED}" y="${-BLEED}" width="${CARD_W + 2 * BLEED}" height="${CARD_H + 2 * BLEED}" fill="${COLOURS.asphalt}"/>
    ${pegField()}
    ${inks()}
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

function styles(paper: Paper): string {
  const p = PAPER[paper];
  return `@page{size:${p.css};margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:${p.w}mm;height:${p.h}mm;overflow:hidden;break-after:page}
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
.back .ground{position:absolute;left:-${BLEED}mm;top:-${BLEED}mm;width:${CARD_W + 2 * BLEED}mm;height:${CARD_H + 2 * BLEED}mm}
.backin{position:absolute;inset:0;padding:8mm 8mm 20mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
.exitmark{width:27mm;height:auto;display:block}
.bk{margin-top:7mm;font-family:"DM Mono",ui-monospace,monospace;font-size:2.47mm;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:#95908A}
.bsig{margin-top:3.38mm;font-family:"Newsreader",Georgia,serif;font-style:italic;font-variation-settings:"opsz" 20;font-size:5.97mm;line-height:1;color:${COLOURS.glow}}`;
}

export function renderSheet(faces: CardFace[], options: Pick<CardOptions, "back" | "paper">): string {
  if (faces.length === 0 || faces.length > BOARD_COUNT) {
    throw new Error(`A sheet holds 1 to ${BOARD_COUNT} cards`);
  }
  const { w, h } = PAPER[options.paper];
  const slots = frontSlots(faces.length, options.paper);
  const fronts = `<div class="sheet">
<svg class="marks" viewBox="0 0 ${w} ${h}" aria-hidden="true">${slots.map(cropMarks).join("")}</svg>
${faces.map((face, i) => front(face, slots[i])).join("\n")}
</div>`;
  const backs = options.back
    ? `\n<div class="sheet">
${faces.map((face, i) => back(face, backSlots(slots, options.paper)[i])).join("\n")}
</div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Toronto Parking cards</title>
<link rel="stylesheet" href="${FONTS}">
<style>${styles(options.paper)}</style>
</head>
<body>
${fronts}${backs}
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
    faces.push({ n, code: entry.code, qrSvg: svg, ...(options.to ? { to: options.to } : {}) });
  }

  mkdirSync(options.out, { recursive: true });
  const name = options.boards.length === 0 ? "cards" : `board-${[...wanted].sort((a, b) => a - b).join("-")}`;
  const path = join(options.out, `${name}${options.back ? "-duplex" : ""}.html`);
  writeFileSync(path, renderSheet(faces, options), "utf8");
  process.stdout.write(
    `✓ ${path} · ${faces.length} card${faces.length === 1 ? "" : "s"}${options.back ? ", backs on page 2 for a long-edge flip" : ""}\n` +
      `Open it in Chrome and print at 100% on ${options.paper === "a4" ? "A4" : "Letter"}, with Background graphics on.\n`,
  );
}

if (/make-cards\.(ts|mts|js|mjs)$/.test(process.argv[1] ?? "")) {
  main(process.argv.slice(2));
}
