/**
 * The solver: breadth-first search over the whole cluster of a board.
 *
 * A port of `scripts/prototype/tp_core.py`'s `solve()`, which is the
 * definition; where this and the python disagree, the python is right. Every
 * ordering decision below is load-bearing, because the stored solution path is
 * whichever shortest path this exact traversal order finds first.
 *
 * A state is the tuple of lane offsets of the movable pieces: `col` for a
 * horizontal piece, `row` for a vertical one. Pylons never move, so they are a
 * fixed occupancy mask and contribute no state. One slide of any length is one
 * move, one edge. The goal is the hero at offset 4, occupying columns 4-5.
 *
 * Occupancy is a 36-bit mask, which does not fit in a JavaScript number under
 * `|`/`&`/`~`: those coerce to 32 bits and would silently drop the last row.
 * Every mask here is therefore a pair of 32-bit words, `lo` for cells 0-31 and
 * `hi` for cells 32-35.
 *
 * The python's unused `full_cluster=False` shortcut is deliberately not ported:
 * it leaves `dist` holding a partial component, which the reverse BFS below is
 * not written to survive, and nothing in the pipeline calls it. `analyse: false`
 * is the option that exists here, and it skips only the work after the forward
 * BFS.
 */
import { BadBoardError, N, parse, type ParsedVehicle } from "./board";
import type { Dir, Move } from "./types";

/** The hero occupies columns 4-5 when solved. */
export const GOAL_OFFSET = N - 2;

/**
 * State keys are packed base-5 (offsets run 0..4) into a double, so the packing
 * is exact while `5 ** pieces < 2 ** 53`. Twenty-two pieces cannot fit on a 6x6
 * board anyway; the guard is here so a bad board fails loudly rather than
 * silently colliding two states.
 */
const MAX_PIECES = 22;

export type SolveStats = {
  /** Par: the length of a shortest solution, in slides. */
  moves: number;
  /** States reachable from the setup, the setup included. */
  cluster: number;
};

export type SolveResult = SolveStats & {
  /** A shortest solution, in the canonical exit-right frame. */
  path: Move[];
  /** Distinct first moves that keep the solution shortest. */
  optimalFirstMoves: number;
  /** Distinct (piece, direction) pairs with a legal slide from the setup. */
  branching: number;
};

export type SolveOptions = {
  /**
   * `false` skips the solution path and the reverse BFS, leaving only the
   * forward pass that par and the cluster size need. Default `true`, which is
   * the python's behaviour.
   */
  analyse?: boolean;
};

type Lane = { lo: Int32Array; hi: Int32Array };

/** Every mask the piece can occupy, indexed by lane offset. */
function laneMasks(p: ParsedVehicle): Lane {
  const span = N - p.length + 1;
  const lo = new Int32Array(span);
  const hi = new Int32Array(span);
  for (let off = 0; off < span; off++) {
    let l = 0;
    let h = 0;
    for (let k = 0; k < p.length; k++) {
      const cell = p.orientation === "h" ? p.row * N + off + k : (off + k) * N + p.col;
      if (cell < 32) l |= 1 << cell;
      else h |= 1 << (cell - 32);
    }
    lo[off] = l;
    hi[off] = h;
  }
  return { lo, hi };
}

export function solve(board: string): SolveResult | null;
export function solve(board: string, options: { analyse: false }): SolveStats | null;
export function solve(board: string, options: SolveOptions): SolveResult | SolveStats | null;
export function solve(board: string, options: SolveOptions = {}): SolveResult | SolveStats | null {
  const analyse = options.analyse ?? true;
  const { pieces, walls } = parse(board);
  const n = pieces.length;
  if (n > MAX_PIECES) throw new BadBoardError(`board has ${n} pieces, more than ${MAX_PIECES}`);

  let wallLo = 0;
  let wallHi = 0;
  for (const w of walls) {
    const c = w.cells[0];
    if (c < 32) wallLo |= 1 << c;
    else wallHi |= 1 << (c - 32);
  }

  const lanesLo: Int32Array[] = [];
  const lanesHi: Int32Array[] = [];
  for (const p of pieces) {
    const lane = laneMasks(p);
    lanesLo.push(lane.lo);
    lanesHi.push(lane.hi);
  }

  const pow = new Float64Array(n);
  for (let i = 0, p = 1; i < n; i++, p *= 5) pow[i] = p;

  const start = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    start[i] = p.orientation === "h" ? p.col : p.row;
  }

  // The frontier is the tail of the discovery order, so the flat arrays below
  // are the FIFO queue: pop by walking `head` forward, push by appending.
  let cap = 1024;
  let offs = new Uint8Array(cap * n);
  let keys = new Float64Array(cap);
  let dist = new Int32Array(cap);
  let parentIdx = new Int32Array(cap);
  let parentPiece = new Int8Array(cap);
  let parentOff = new Int8Array(cap);
  let count = 0;
  const index = new Map<number, number>();

  function grow(): void {
    cap *= 2;
    const o = new Uint8Array(cap * n);
    o.set(offs);
    offs = o;
    const k = new Float64Array(cap);
    k.set(keys);
    keys = k;
    const d = new Int32Array(cap);
    d.set(dist);
    dist = d;
    const pi = new Int32Array(cap);
    pi.set(parentIdx);
    parentIdx = pi;
    const pp = new Int8Array(cap);
    pp.set(parentPiece);
    parentPiece = pp;
    const po = new Int8Array(cap);
    po.set(parentOff);
    parentOff = po;
  }

  /** Appends the state reached by moving piece `i` of state `fromBase` to offset `j`. */
  function push(fromBase: number, i: number, j: number, key: number, d: number, from: number): void {
    if (count === cap) grow();
    const base = count * n;
    offs.copyWithin(base, fromBase, fromBase + n);
    offs[base + i] = j;
    keys[count] = key;
    dist[count] = d;
    parentIdx[count] = from;
    parentPiece[count] = i;
    parentOff[count] = j;
    index.set(key, count);
    count++;
  }

  const nbI = new Int32Array(n * 5);
  const nbJ = new Int32Array(n * 5);

  /**
   * Legal slides from the state at `base`, in the python's order: pieces in
   * `pieces[]` order, and within a piece the negative direction first, walking
   * outward one offset at a time and stopping at the first blocked one. That
   * walk is what makes the whole-mask test below equivalent to sweeping the
   * path: everything between the piece and `j` has already been cleared.
   */
  function neighbours(base: number): number {
    let mLo = wallLo;
    let mHi = wallHi;
    for (let i = 0; i < n; i++) {
      const o = offs[base + i];
      mLo |= lanesLo[i][o];
      mHi |= lanesHi[i][o];
    }
    let c = 0;
    for (let i = 0; i < n; i++) {
      const ll = lanesLo[i];
      const hh = lanesHi[i];
      const k = offs[base + i];
      const blockedLo = mLo & ~ll[k];
      const blockedHi = mHi & ~hh[k];
      for (let j = k - 1; j >= 0; j--) {
        if ((ll[j] & blockedLo) !== 0 || (hh[j] & blockedHi) !== 0) break;
        nbI[c] = i;
        nbJ[c] = j;
        c++;
      }
      for (let j = k + 1, span = ll.length; j < span; j++) {
        if ((ll[j] & blockedLo) !== 0 || (hh[j] & blockedHi) !== 0) break;
        nbI[c] = i;
        nbJ[c] = j;
        c++;
      }
    }
    return c;
  }

  {
    let key = 0;
    for (let i = 0; i < n; i++) key += start[i] * pow[i];
    offs.set(start, 0);
    keys[0] = key;
    dist[0] = 0;
    parentIdx[0] = -1;
    parentPiece[0] = -1;
    parentOff[0] = -1;
    index.set(key, 0);
    count = 1;
  }

  // Forward BFS. `goal` is the first state POPPED with the hero at offset 4,
  // not the first discovered; the search then keeps going to size the cluster.
  let goal = -1;
  let goalDist = -1;
  for (let s = 0; s < count; s++) {
    const base = s * n;
    const d = dist[s];
    if (goal < 0 && offs[base] === GOAL_OFFSET) {
      goal = s;
      goalDist = d;
    }
    const key = keys[s];
    const c = neighbours(base);
    for (let e = 0; e < c; e++) {
      const i = nbI[e];
      const j = nbJ[e];
      const t = key + (j - offs[base + i]) * pow[i];
      if (!index.has(t)) push(base, i, j, t, d + 1, s);
    }
  }

  if (goal < 0) return null;
  const stats: SolveStats = { moves: goalDist, cluster: count };
  if (!analyse) return stats;

  const path: Move[] = [];
  for (let s = goal; parentIdx[s] !== -1; ) {
    const from = parentIdx[s];
    const i = parentPiece[s];
    const delta = parentOff[s] - offs[from * n + i];
    const p = pieces[i];
    const dir: Dir =
      p.orientation === "h" ? (delta > 0 ? "right" : "left") : delta > 0 ? "down" : "up";
    path.push({ pieceId: p.letter, dir, cells: Math.abs(delta) });
    s = from;
  }
  path.reverse();

  // Every slide reverses, so the move graph is undirected: one BFS out of all
  // the goal states at once gives distance-to-goal for the whole cluster.
  const toGoal = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);
  let tail = 0;
  for (let s = 0; s < count; s++) {
    if (offs[s * n] === GOAL_OFFSET) {
      toGoal[s] = 0;
      queue[tail++] = s;
    }
  }
  for (let head = 0; head < tail; head++) {
    const s = queue[head];
    const base = s * n;
    const d = toGoal[s];
    const key = keys[s];
    const c = neighbours(base);
    for (let e = 0; e < c; e++) {
      const i = nbI[e];
      const t = key + (nbJ[e] - offs[base + i]) * pow[i];
      const at = index.get(t);
      if (at !== undefined && toGoal[at] === -1) {
        toGoal[at] = d + 1;
        queue[tail++] = at;
      }
    }
  }

  let optimalFirstMoves = 0;
  const directions = new Set<number>();
  const rootKey = keys[0];
  const roots = neighbours(0);
  for (let e = 0; e < roots; e++) {
    const i = nbI[e];
    const j = nbJ[e];
    const t = rootKey + (j - start[i]) * pow[i];
    const at = index.get(t);
    if (at !== undefined && toGoal[at] === goalDist - 1) optimalFirstMoves++;
    directions.add(i * 2 + (j > start[i] ? 1 : 0));
  }

  return { ...stats, path, optimalFirstMoves, branching: directions.size };
}
