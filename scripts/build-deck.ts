/**
 * `pnpm deck:build` — builds `data/deck.json` from `rush.txt` and nothing else.
 *
 * A port of `scripts/prototype/tp_pass1.py` + `tp_select.py` into one script.
 * The python is the definition; where this and the python disagree, the python
 * is right. The whole thing is a pure function of `rush.txt` plus the constants
 * below: no PRNG, no clock, no reliance on Map or Set iteration beyond
 * insertion order. Two runs are byte-identical, and the acceptance digest is
 *
 *   fe31aa9a478ab285b76a0d9fc39398f2b2054a5fa552e596c83a2149208d2418
 *
 * Changing SEED changes the deck; nothing else does. `deck.json` is never read
 * back in — the only input is `rush.txt`, whose sha256 is asserted before a
 * single row is parsed.
 *
 * Pass 1 streams the 2,577,412 rows once, applies the inventory filters, and
 * keeps per (moves, pylons) bucket the 300 survivors with the smallest
 * sha1("toronto-parking-v1:" + board). Pass 2 walks the five tiers in order,
 * twelve target move counts each, and takes one row per slot under the rules in
 * the table below, solving and verifying every pick against the row it came
 * from.
 */
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  branching,
  footprint,
  needsOf,
  parse,
  similarity,
  staysInBoxOf,
  type ParsedPylon,
  type ParsedVehicle,
} from "../src/lib/board";
import { colour } from "../src/lib/colours";
import { solve } from "../src/lib/solver";
import { BANDS, CARDS_PER_TIER, DECK_SIZE, TIERS, type Tier } from "../src/lib/tiers";
import type { Card, Deck, Move, Piece } from "../src/lib/types";

// ---------------------------------------------------------------- constants

/** Changing this string changes the deck. Nothing else does. */
const SEED = "toronto-parking-v1";

const RUSH_SHA256 = "fca9f04db491415ac257416cd25b304670f2859f5f1bb1f4948c7f30ba14626f";
const RUSH_ROWS = 2_577_412;
/** Rows surviving the inventory filters — a cheap tripwire on pass 1. */
const RUSH_PASSED = 2_518_732;

/** Rows kept per (moves, pylons) bucket: enough choice out of one pass. */
const POOL_PER_BUCKET = 300;

const MIN_BRANCH: Record<Tier, number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 3,
  expert: 3,
  grandmaster: 3,
};
/** No card loses the "one wrong move and you are lost" texture. */
const MAX_CLUSTER = 30_000;
/** Pieces including the hero and pylons. Only Beginner is capped: quick setup. */
const MAX_PIECES: Partial<Record<Tier, number>> = { beginner: 10 };
const MAX_SIMILARITY = 0.5;

/** tier -> slot 0..11 -> pylon count. Fixed indices, so pylon cards spread out. */
const PYLON_SLOTS: Record<Tier, Record<string, number>> = {
  beginner: {},
  intermediate: { "5": 1, "10": 1 },
  advanced: { "3": 1, "7": 1, "11": 2 },
  expert: { "2": 1, "5": 1, "8": 1, "11": 2 },
  grandmaster: { "1": 1, "3": 1, "5": 2, "7": 1, "9": 2, "11": 1 },
};

/** The database's only 60-move board, pinned as card 60. Its opening is forced,
 *  so it is the one card exempt from every filter, the branching rule included. */
const FINALE = "IBBxooIooLDDJAALooJoKEEMFFKooMGGHHHM";
const FINALE_CLUSTER = 2332;
const FINALE_CARS = 8;
const FINALE_TRUCKS = 3;
const FINALE_MOVES = 60;

/** Plus side first, so a slot that cannot hit its target lands harder, not easier. */
const OFFSETS = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];

/** Grand Master's twelve targets space over 41-55; slot 11 is the finale. */
const GRANDMASTER_TARGET_CAP = 55;

// ---------------------------------------------------------------- pass 1

type PoolEntry = {
  hash: string;
  board: string;
  cluster: number;
  cars: number;
  trucks: number;
};

export type Pass1 = {
  rows: number;
  passed: number;
  /** Keyed by `moves * 4 + pylons`; each bucket sorted ascending by hash. */
  pool: Map<number, PoolEntry[]>;
};

/** The python sorts the whole tuple, so the board breaks a hash tie. */
function comparePool(a: PoolEntry, b: PoolEntry): number {
  if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
  if (a.board !== b.board) return a.board < b.board ? -1 : 1;
  if (a.cluster !== b.cluster) return a.cluster - b.cluster;
  if (a.cars !== b.cars) return a.cars - b.cars;
  return a.trucks - b.trucks;
}

export function fileSha256(path: string): string {
  const hash = createHash("sha256");
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    for (;;) {
      const nread = readSync(fd, buf, 0, buf.length, null);
      if (nread === 0) break;
      hash.update(buf.subarray(0, nread));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

const CH_NEWLINE = 10;
const CH_SPACE = 32;
const CH_ZERO = 48;
const CH_NINE = 57;
const CH_A = 65;
const CH_Z = 90;
const CH_x = 120;

/**
 * One streaming pass over `rush.txt`, working on raw bytes so the 115 MB never
 * becomes 2.6 million JavaScript strings: only the 2,518,732 survivors get a
 * board string, and only because the pool has to hold one.
 */
export function pass1(rushPath: string): Pass1 {
  const pool = new Map<number, PoolEntry[]>();
  const letters = new Uint8Array(26);
  const hashInput = Buffer.alloc(SEED.length + 1 + 36);
  hashInput.write(`${SEED}:`, 0, "latin1");
  const boardOffset = SEED.length + 1;
  let rows = 0;
  let passed = 0;

  /** Handles one `<moves> <board36> <cluster>` line lying in `buf[start, stop)`. */
  function row(buf: Buffer, start: number, stop: number): void {
    rows++;
    let i = start;
    while (i < stop && buf[i] !== CH_SPACE) i++;
    let moves = 0;
    for (let k = start; k < i; k++) moves = moves * 10 + (buf[k] - CH_ZERO);
    const boardStart = i + 1;
    let j = boardStart;
    while (j < stop && buf[j] !== CH_SPACE) j++;
    const boardStop = j;
    let cluster = 0;
    for (let k = j + 1; k < stop; k++) {
      const c = buf[k];
      if (c >= CH_ZERO && c <= CH_NINE) cluster = cluster * 10 + (c - CH_ZERO);
    }

    letters.fill(0);
    let walls = 0;
    for (let k = boardStart; k < boardStop; k++) {
      const c = buf[k];
      if (c === CH_x) walls++;
      else if (c >= CH_A && c <= CH_Z) letters[c - CH_A]++;
    }
    let cars = 0;
    let trucks = 0;
    for (let k = 0; k < 26; k++) {
      const v = letters[k];
      // The hero is 'A' and is not a car you fetch out of the box.
      if (v === 2) {
        if (k !== 0) cars++;
      } else if (v === 3) trucks++;
    }
    if (trucks > 4) return;
    if (cars > 12) return;
    if (walls > 2) return;

    // A pylon in the exit row to the hero's right would make the card
    // unsolvable. The database holds only solvable rows, so this rejects
    // nothing; it stays as an assertion of that.
    let hero = 0;
    for (let k = boardStart; k < boardStop; k++) {
      if (buf[k] === CH_A) {
        hero = k - boardStart;
        break;
      }
    }
    // `row[hero - 12 + 2:]` in the python, negative indices and all.
    let from = hero - 10;
    if (from < 0) from = Math.max(0, 6 + from);
    for (let k = boardStart + 12 + from; k < boardStart + 18; k++) {
      if (buf[k] === CH_x) return;
    }
    passed++;

    buf.copy(hashInput, boardOffset, boardStart, boardStop);
    const entry: PoolEntry = {
      hash: createHash("sha1").update(hashInput).digest("hex"),
      board: buf.toString("latin1", boardStart, boardStop),
      cluster,
      cars,
      trucks,
    };
    const key = moves * 4 + walls;
    let bucket = pool.get(key);
    if (bucket === undefined) {
      bucket = [];
      pool.set(key, bucket);
    }
    bucket.push(entry);
    if (bucket.length > 2 * POOL_PER_BUCKET) {
      bucket.sort(comparePool);
      bucket.length = POOL_PER_BUCKET;
    }
  }

  const CHUNK = 1 << 22;
  const buf = Buffer.allocUnsafe(CHUNK + 256);
  const fd = openSync(rushPath, "r");
  try {
    let carry = 0;
    for (;;) {
      const nread = readSync(fd, buf, carry, CHUNK, null);
      if (nread === 0) break;
      const stop = carry + nread;
      let pos = 0;
      for (;;) {
        let nl = pos;
        while (nl < stop && buf[nl] !== CH_NEWLINE) nl++;
        if (nl === stop) break;
        if (nl > pos) row(buf, pos, nl);
        pos = nl + 1;
      }
      carry = stop - pos;
      if (carry > 0) buf.copy(buf, 0, pos, stop);
    }
    if (carry > 0) row(buf, 0, carry);
  } finally {
    closeSync(fd);
  }

  for (const bucket of pool.values()) {
    bucket.sort(comparePool);
    if (bucket.length > POOL_PER_BUCKET) bucket.length = POOL_PER_BUCKET;
  }
  return { rows, passed, pool };
}

// ---------------------------------------------------------------- selection

/** Python's `round`, which is half-to-even. No tie arises for the five bands
 *  the deck ships with; the port is faithful anyway. */
export function roundHalfToEven(x: number): number {
  const floor = Math.floor(x);
  const rest = x - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** The twelve move counts a tier aims at, evenly spaced across its band. */
export function targets(lo: number, hi: number, n: number, cap: number | null = null): number[] {
  const top = cap ?? hi;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(lo + roundHalfToEven((i * (top - lo)) / (n - 1)));
  return out;
}

type Pick = {
  tier: Tier;
  board: string;
  moves: number;
  cluster: number;
  pieces: ParsedVehicle[];
  walls: ParsedPylon[];
  solution: Move[];
  optimalFirstMoves: number;
  branching: number;
  piecesTotal: number;
};

function sha1Hex(text: string): string {
  return createHash("sha1").update(text, "latin1").digest("hex");
}

function pieceCount(board: string): number {
  const { pieces, walls } = parse(board);
  return pieces.length + walls.length;
}

function select(pool: Map<number, PoolEntry[]>): Pick[] {
  const deck: Pick[] = [];
  /** Footprints of every card chosen so far, across all tiers, not just this one. */
  const chosen: Set<string>[] = [];

  for (const tier of TIERS) {
    const [lo, hi] = BANDS[tier];
    const tg = targets(
      lo,
      hi,
      CARDS_PER_TIER,
      tier === "grandmaster" ? GRANDMASTER_TARGET_CAP : null,
    );
    const picks: Pick[] = [];

    for (let slot = 0; slot < CARDS_PER_TIER; slot++) {
      let moves = tg[slot];
      const pylons = PYLON_SLOTS[tier][String(slot)] ?? 0;
      let taken: PoolEntry;

      if (tier === "grandmaster" && slot === CARDS_PER_TIER - 1) {
        // The finale is pinned: no filter and no sort key touches it.
        moves = FINALE_MOVES;
        taken = {
          hash: sha1Hex(FINALE),
          board: FINALE,
          cluster: FINALE_CLUSTER,
          cars: FINALE_CARS,
          trucks: FINALE_TRUCKS,
        };
      } else {
        const maxPieces = MAX_PIECES[tier] ?? 99;
        let candidates: PoolEntry[] = [];
        for (const offset of OFFSETS) {
          const at = moves + offset;
          if (at < lo || at > hi) continue;
          candidates = pool.get(at * 4 + pylons) ?? [];
          candidates = candidates.filter(
            (c) => c.cluster <= MAX_CLUSTER && branching(c.board) >= MIN_BRANCH[tier],
          );
          candidates = candidates.filter((c) => pieceCount(c.board) <= maxPieces);
          candidates = candidates.filter((c) => {
            const { pieces, walls } = parse(c.board);
            const fp = footprint(pieces, walls);
            return chosen.every((seen) => similarity(fp, seen) < MAX_SIMILARITY);
          });
          if (candidates.length > 0) {
            moves = at;
            break;
          }
        }
        if (candidates.length === 0) {
          throw new Error(`no candidate for ${tier} slot ${slot} near ${moves} moves`);
        }
        // Steer away from a run of cards that set up the same shape: penalise a
        // piece count or a hero column matching either of this tier's last two
        // picks, then take the smallest hash.
        const recentTotals = picks.slice(-2).map((p) => p.piecesTotal);
        const recentHero = picks.slice(-2).map((p) => p.pieces[0].col);
        const keyed = candidates.map((c) => {
          const { pieces, walls } = parse(c.board);
          return {
            entry: c,
            repeatsPieces: recentTotals.includes(pieces.length + walls.length) ? 1 : 0,
            repeatsHero: recentHero.includes(pieces[0].col) ? 1 : 0,
          };
        });
        keyed.sort(
          (a, b) =>
            a.repeatsPieces - b.repeatsPieces ||
            a.repeatsHero - b.repeatsHero ||
            (a.entry.hash < b.entry.hash ? -1 : a.entry.hash > b.entry.hash ? 1 : 0),
        );
        taken = keyed[0].entry;
      }

      const solved = solve(taken.board);
      if (solved === null || solved.moves !== moves || solved.cluster !== taken.cluster) {
        throw new Error(
          `solver disagrees with rush.txt on ${taken.board}: ` +
            `expected ${moves}/${taken.cluster}, got ${solved?.moves}/${solved?.cluster}`,
        );
      }
      const { pieces, walls } = parse(taken.board);
      colour(pieces, walls);
      picks.push({
        tier,
        board: taken.board,
        moves,
        cluster: taken.cluster,
        pieces,
        walls,
        solution: solved.path,
        optimalFirstMoves: solved.optimalFirstMoves,
        branching: solved.branching,
        piecesTotal: pieces.length + walls.length,
      });
      chosen.push(footprint(pieces, walls));
    }

    // Stable, so two cards with the same par and cluster keep their slot order.
    picks.sort((a, b) => a.moves - b.moves || a.cluster - b.cluster);
    deck.push(...picks);
  }
  return deck;
}

// ---------------------------------------------------------------- output

/** The card's view of a piece: the working `letter` and `cells` fields drop out. */
function toPiece(p: ParsedVehicle | ParsedPylon): Piece {
  if (p.kind === "pylon") {
    return {
      id: p.id,
      kind: "pylon",
      colour: "yellow",
      row: p.row,
      col: p.col,
      orientation: null,
      length: 1,
    };
  }
  const paint = p.colour;
  if (paint === null) throw new Error(`piece ${p.id} was never coloured`);
  return {
    id: p.id,
    kind: p.kind,
    colour: paint,
    row: p.row,
    col: p.col,
    orientation: p.orientation,
    length: p.length,
  };
}

function toCard(pick: Pick, n: number): Card {
  return {
    n,
    tier: pick.tier,
    board: pick.board,
    moves: pick.moves,
    cluster: pick.cluster,
    pieces: [...pick.pieces, ...pick.walls].map(toPiece),
    solution: pick.solution,
    needs: needsOf(pick.pieces, pick.walls),
    staysInBox: staysInBoxOf(pick.pieces, pick.walls),
    meta: { branching: pick.branching, optimalFirstMoves: pick.optimalFirstMoves },
  };
}

/**
 * The whole pipeline: returns the exact bytes `data/deck.json` should hold.
 * Compact, insertion-ordered keys, no trailing newline.
 */
export function buildDeck(rushPath: string, log: (line: string) => void = () => {}): string {
  const digest = fileSha256(rushPath);
  if (digest !== RUSH_SHA256) {
    throw new Error(
      `${rushPath} is not the expected database\n  expected ${RUSH_SHA256}\n  actual   ${digest}`,
    );
  }
  log(`rush.txt sha256 ok (${RUSH_SHA256})`);

  const { rows, passed, pool } = pass1(rushPath);
  if (rows !== RUSH_ROWS) throw new Error(`read ${rows} rows, expected ${RUSH_ROWS}`);
  if (passed !== RUSH_PASSED) throw new Error(`${passed} rows passed, expected ${RUSH_PASSED}`);
  log(`pass 1: ${rows} rows, ${passed} passed, ${pool.size} buckets`);

  const picks = select(pool);
  if (picks.length !== DECK_SIZE) throw new Error(`selected ${picks.length}, expected ${DECK_SIZE}`);
  log(`pass 2: selected, solved and verified ${picks.length} cards`);

  const deck: Deck = {
    source: { file: "rush.txt", sha256: RUSH_SHA256, rows: RUSH_ROWS },
    generator: {
      version: 1,
      seed: SEED,
      deckSize: DECK_SIZE,
      bands: BANDS,
      pylonSlots: PYLON_SLOTS,
    },
    cards: picks.map((pick, i) => toCard(pick, i + 1)),
  };
  return JSON.stringify(deck);
}

// ---------------------------------------------------------------- cli

const here = dirname(fileURLToPath(import.meta.url));

function main(argv: string[]): void {
  const outFlag = argv.indexOf("--out");
  const outPath =
    outFlag >= 0 && argv[outFlag + 1] !== undefined
      ? argv[outFlag + 1]
      : (process.env.DECK_OUT ?? resolve(here, "..", "data", "deck.json"));
  const rushPath = process.env.RUSH_TXT ?? "./rush.txt";
  const started = performance.now();
  const json = buildDeck(rushPath, (line) => process.stdout.write(`${line}\n`));
  writeFileSync(outPath, json);
  const seconds = (performance.now() - started) / 1000;
  const sha = createHash("sha256").update(json).digest("hex");
  process.stdout.write(
    `wrote ${outPath} — ${json.length} bytes, sha256 ${sha}, ${seconds.toFixed(1)}s\n`,
  );
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (invokedDirectly()) main(process.argv.slice(2));
