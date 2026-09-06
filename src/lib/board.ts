/**
 * Board geometry: Fogleman's 36-character strings in and out, cell addresses,
 * the physical checklist, and the two cheap board measures the deck build
 * filters on. A port of `scripts/prototype/tp_core.py`, which is the
 * definition; where this and the python disagree, the python is right.
 *
 * Row-major 6x6. `o` empty, `x` pylon, `A` the hero, `B`..`Q` other vehicles.
 * Cells are grouped by letter and never by alphabet position: a pylon consumes
 * a letter index in Fogleman's writer, so `IBBxooI...` has no `C`.
 *
 * Safe for client components: nothing here imports the deck.
 */
import type { Card, Colour, Counts, Piece } from "./types";

export const N = 6;

/** The exit sits on the right wall, third row from the top. */
export const HERO_ROW = 2;

export const COLOUR_ORDER = ["blue", "yellow", "green"] as const;

export type PieceColour = (typeof COLOUR_ORDER)[number];

/** What one printed box holds, hero aside. */
export const INVENTORY = {
  car: { blue: 4, yellow: 4, green: 4 },
  truck: { blue: 1, yellow: 2, green: 1 },
  pylon: 2,
} as const;

/** Colour capacities the greedy assignment spends. Truck order is the spelling
 *  order the checklist uses, yellow first, as in the prototype. */
export const CAR_CAP: Record<PieceColour, number> = { blue: 4, yellow: 4, green: 4 };
export const TRUCK_CAP: Record<PieceColour, number> = { yellow: 2, blue: 1, green: 1 };

export class BadBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadBoardError";
  }
}

/** A vehicle mid-pipeline: `cells` and `letter` are working fields the card
 *  JSON drops, and `colour` is null until `colours.ts` fills it in. */
export type ParsedVehicle = {
  id: string;
  letter: string;
  kind: "hero" | "car" | "truck";
  colour: Colour | null;
  row: number;
  col: number;
  orientation: "h" | "v";
  length: 2 | 3;
  cells: number[];
};

export type ParsedPylon = {
  id: string;
  letter: "x";
  kind: "pylon";
  colour: "yellow";
  row: number;
  col: number;
  orientation: null;
  length: 1;
  cells: number[];
};

export type ParsedPiece = ParsedVehicle | ParsedPylon;

export type Parsed = { pieces: ParsedVehicle[]; walls: ParsedPylon[] };

/** Groups cells by letter. Pieces come back in letter order with the hero
 *  first; pylons come back separately, ids `x1`, `x2` in reading order. */
export function parse(board: string): Parsed {
  if (board.length !== 36) throw new BadBoardError("board must be 36 chars");
  const pos = new Map<string, number[]>();
  for (let i = 0; i < board.length; i++) {
    const ch = board[i];
    if (ch === "." || ch === "o") continue;
    if (!(ch === "x" || (ch >= "A" && ch <= "Z"))) {
      throw new BadBoardError(`bad char ${JSON.stringify(ch)}`);
    }
    const at = pos.get(ch);
    if (at) at.push(i);
    else pos.set(ch, [i]);
  }
  const pieces: ParsedVehicle[] = [];
  const walls: ParsedPylon[] = [];
  for (const label of [...pos.keys()].sort()) {
    const ps = pos.get(label)!;
    if (label === "x") {
      ps.forEach((p, k) => {
        walls.push({
          id: `x${k + 1}`,
          letter: "x",
          kind: "pylon",
          colour: "yellow",
          row: Math.floor(p / N),
          col: p % N,
          orientation: null,
          length: 1,
          cells: [p],
        });
      });
      continue;
    }
    if (ps.length !== 2 && ps.length !== 3) {
      throw new BadBoardError(`piece ${label} has ${ps.length} cells`);
    }
    const stride = ps[1] - ps[0];
    if (stride !== 1 && stride !== N) {
      throw new BadBoardError(`piece ${label} invalid shape`);
    }
    for (let i = 2; i < ps.length; i++) {
      if (ps[i] - ps[i - 1] !== stride) {
        throw new BadBoardError(`piece ${label} not contiguous`);
      }
    }
    if (stride === 1 && Math.floor(ps[0] / N) !== Math.floor(ps[ps.length - 1] / N)) {
      throw new BadBoardError(`piece ${label} wraps a row`);
    }
    const orientation = stride === 1 ? "h" : "v";
    const kind = label === "A" ? "hero" : ps.length === 2 ? "car" : "truck";
    pieces.push({
      id: label,
      letter: label,
      kind,
      colour: null,
      row: Math.floor(ps[0] / N),
      col: ps[0] % N,
      orientation,
      length: ps.length as 2 | 3,
      cells: [...ps],
    });
  }
  if (pieces.length === 0 || pieces[0].letter !== "A") throw new BadBoardError("no hero");
  const h = pieces[0];
  if (h.orientation !== "h" || h.row !== HERO_ROW || h.length !== 2) {
    throw new BadBoardError("hero must be horizontal, length 2, on row 2");
  }
  return { pieces, walls };
}

export function unparse(pieces: ParsedVehicle[], walls: ParsedPylon[]): string {
  const s: string[] = new Array(36).fill("o");
  for (const p of pieces) for (const c of p.cells) s[c] = p.letter;
  for (const w of walls) s[w.cells[0]] = "x";
  return s.join("");
}

export function inventoryOk(cars: number, trucks: number, walls: number): boolean {
  return cars <= 12 && trucks <= 4 && walls <= 2;
}

/** A pylon in the exit row to the hero's right makes the card unsolvable. */
export function wallBlocksExit(pieces: ParsedVehicle[], walls: ParsedPylon[]): boolean {
  const heroEnd = pieces[0].col + 1;
  return walls.some((w) => w.row === HERO_ROW && w.col > heroEnd);
}

/** Cell address in the frame grid: columns A-F, rows 1-6. The labels turn with
 *  the board, so an address is true in every orientation. */
export function cellName(cell: number): string {
  return "ABCDEF"[cell % N] + String(Math.floor(cell / N) + 1);
}

export function cellNameAt(row: number, col: number): string {
  return cellName(row * N + col);
}

/** Root branching factor: distinct (piece, direction) pairs with a legal slide. */
export function branching(board: string): number {
  const { pieces, walls } = parse(board);
  const occupied = new Uint8Array(36);
  for (const w of walls) occupied[w.cells[0]] = 1;
  for (const p of pieces) for (const c of p.cells) occupied[c] = 1;
  let b = 0;
  for (const p of pieces) {
    const a = p.cells[0];
    const z = p.cells[p.cells.length - 1];
    if (p.orientation === "h") {
      if (a % N > 0 && !occupied[a - 1]) b++;
      if (z % N < N - 1 && !occupied[z + 1]) b++;
    } else {
      if (a >= N && !occupied[a - N]) b++;
      if (z < 30 && !occupied[z + N]) b++;
    }
  }
  return b;
}

/** The set of (row, col, orientation, length) slots a board fills; pylons carry
 *  the pseudo-orientation `x`. Jaccard over two of these is the similarity rule. */
export function footprint(pieces: ParsedVehicle[], walls: ParsedPylon[]): Set<string> {
  const s = new Set<string>();
  for (const p of pieces) s.add(`${p.row},${p.col},${p.orientation},${p.length}`);
  for (const w of walls) s.add(`${w.row},${w.col},x,1`);
  return s;
}

export function similarity(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  return inter / (a.size + b.size - inter);
}

function emptyCounts(): Counts {
  return {
    car: { blue: 0, yellow: 0, green: 0 },
    truck: { blue: 0, yellow: 0, green: 0 },
    pylon: 0,
  };
}

/** Physical pieces this card uses, hero excluded. Requires coloured pieces. */
export function needsOf(pieces: ParsedVehicle[], walls: ParsedPylon[]): Counts {
  const out = emptyCounts();
  out.pylon = walls.length;
  for (const p of pieces.slice(1)) {
    const colour = p.colour;
    if (colour === null || colour === "red") {
      throw new BadBoardError(`piece ${p.id} has no playable colour`);
    }
    out[p.kind === "truck" ? "truck" : "car"][colour] += 1;
  }
  return out;
}

/** The complement of `needsOf` against one box. */
export function staysInBoxOf(pieces: ParsedVehicle[], walls: ParsedPylon[]): Counts {
  const used = needsOf(pieces, walls);
  const out = emptyCounts();
  for (const c of COLOUR_ORDER) {
    out.car[c] = INVENTORY.car[c] - used.car[c];
    out.truck[c] = INVENTORY.truck[c] - used.truck[c];
  }
  out.pylon = INVENTORY.pylon - used.pylon;
  return out;
}

const CAR_ORDER = COLOUR_ORDER;
/** Trucks spell out yellow first, matching the physical box's two-yellow bias. */
const TRUCK_ORDER = ["yellow", "blue", "green"] as const;

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/**
 * The checklist, in the order the card page reads it: cars, trucks, pylons,
 * hero last. Zero counts are left out. `withHero` adds `the red car`, which
 * belongs on "What you need" and never on "Stays in the box".
 */
export function checklistParts(counts: Counts, withHero: boolean): string[] {
  const parts: string[] = [];
  for (const c of CAR_ORDER) if (counts.car[c]) parts.push(plural(counts.car[c], `${c} car`));
  for (const c of TRUCK_ORDER) if (counts.truck[c]) parts.push(plural(counts.truck[c], `${c} truck`));
  if (counts.pylon) parts.push(plural(counts.pylon, "pylon"));
  if (withHero) parts.push("the red car");
  return parts;
}

/** Sentence-case name for a piece: `Blue car`, `Yellow truck`, `Red car`, `Pylon`. */
export function pieceLabel(piece: Piece): string {
  if (piece.kind === "pylon") return "Pylon";
  if (piece.kind === "hero") return "Red car";
  const colour = piece.colour[0].toUpperCase() + piece.colour.slice(1);
  return `${colour} ${piece.kind}`;
}

function firstCell(piece: Piece): number {
  return piece.row * N + piece.col;
}

function lastCell(piece: Piece): number {
  const step = piece.orientation === "v" ? N : 1;
  return firstCell(piece) + step * (piece.length - 1);
}

/**
 * The read-aloud setup list: pieces top-left to bottom-right, each as its span
 * in frame coordinates. No orientation word — the span already says it, and a
 * spoken "vertical" would be wrong in three of the four rotations.
 */
export function setupSentences(pieces: readonly Piece[]): string[] {
  return [...pieces]
    .sort((a, b) => firstCell(a) - firstCell(b))
    .map((p) => {
      if (p.kind === "pylon") return `Pylon at ${cellName(firstCell(p))}.`;
      const span = `${cellName(firstCell(p))} to ${cellName(lastCell(p))}`;
      const tail = p.kind === "hero" ? ", facing the exit" : "";
      return `${pieceLabel(p)}, ${span}${tail}.`;
    });
}

/** The `aria-label` the board diagram carries, equal to the disclosure text. */
export function boardAriaLabel(card: Pick<Card, "n" | "pieces">): string {
  return `Card ${card.n} setup. ${setupSentences(card.pieces).join(" ")}`;
}
