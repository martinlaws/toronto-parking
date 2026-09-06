/**
 * Colour assignment: which physical piece out of the box each letter on a
 * Fogleman board becomes.
 *
 * A port of `scripts/prototype/tp_core.py`'s `colour()`, which is the
 * definition. Deterministic from the board alone — no PRNG, nothing to seed —
 * so a rebuild produces the same deck and a card's colours are a property of
 * its layout rather than of when it was generated.
 *
 * The hero is red and pylons are yellow, both fixed. Everything else is a
 * greedy graph colouring, most-constrained first, over a conflict graph that
 * joins two pieces with weight 1 when any of their cells are edge-adjacent and
 * weight 2 when they are the same kind sharing a lane, since two same-colour
 * cars nose to tail read as one truck and break "the blue car in column 3".
 * Pylons sit in the graph already yellow, so a yellow car gets steered off
 * touching one.
 *
 * Capacities (car 4/4/4, truck yellow 2, blue 1, green 1) are exactly the box's
 * contents, so any board that passes the inventory filter is colourable and the
 * greedy can never paint itself into a corner.
 */
import {
  CAR_CAP,
  COLOUR_ORDER,
  N,
  TRUCK_CAP,
  type ParsedPiece,
  type ParsedPylon,
  type ParsedVehicle,
  type PieceColour,
} from "./board";

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** True when any cell of `p` shares an edge with any cell of `q`. */
function adjacent(p: ParsedPiece, q: ParsedPiece): boolean {
  const b = new Set(q.cells);
  for (const c of p.cells) {
    const row = Math.floor(c / N);
    const col = c % N;
    for (const [dr, dc] of STEPS) {
      const r = row + dr;
      const k = col + dc;
      if (r >= 0 && r < N && k >= 0 && k < N && b.has(r * N + k)) return true;
    }
  }
  return false;
}

/** True when `p` and `q` are the same kind of vehicle in the same lane. */
function laneMates(p: ParsedPiece, q: ParsedPiece): boolean {
  if (p.kind !== q.kind || p.orientation !== q.orientation || p.kind === "pylon") return false;
  return p.orientation === "h" ? p.row === q.row : p.col === q.col;
}

type Edge = { to: ParsedPiece; weight: number };

/**
 * Assigns `colour` in place on every piece and returns the total conflict score
 * paid, which is a quality measure for the board rather than anything the card
 * stores.
 */
export function colour(pieces: ParsedVehicle[], walls: ParsedPylon[]): number {
  pieces[0].colour = "red";
  const nodes: ParsedPiece[] = [...pieces.slice(1), ...walls];
  const edges = new Map<string, Edge[]>();
  for (const p of nodes) edges.set(p.id, []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const p = nodes[i];
      const q = nodes[j];
      let w = 0;
      if (adjacent(p, q)) w += 1;
      if (laneMates(p, q)) w += 2;
      if (w > 0) {
        edges.get(p.id)!.push({ to: q, weight: w });
        edges.get(q.id)!.push({ to: p, weight: w });
      }
    }
  }
  // The hero is left out of the graph: nothing else is ever red, so it can
  // never conflict with anything.

  const cap: Record<"car" | "truck", Record<PieceColour, number>> = {
    car: { ...CAR_CAP },
    truck: { ...TRUCK_CAP },
  };
  const total = new Map<string, number>();
  for (const p of nodes) {
    let sum = 0;
    for (const e of edges.get(p.id)!) sum += e.weight;
    total.set(p.id, sum);
  }
  // Most-constrained first: the piece with the most conflict weight to lose
  // chooses while there is still capacity in every colour.
  const order = pieces.slice(1).sort((a, b) => {
    const d = total.get(b.id)! - total.get(a.id)!;
    return d !== 0 ? d : a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0;
  });

  let conflicts = 0;
  for (const p of order) {
    const kind = p.kind === "truck" ? "truck" : "car";
    const caps = cap[kind];
    let bestColour: PieceColour | null = null;
    let bestScore = 0;
    let bestKey: [number, number, number] | null = null;
    for (let ci = 0; ci < COLOUR_ORDER.length; ci++) {
      const c = COLOUR_ORDER[ci];
      if (caps[c] <= 0) continue;
      let score = 0;
      for (const e of edges.get(p.id)!) if (e.to.colour === c) score += e.weight;
      const key: [number, number, number] = [score, -caps[c], ci];
      if (bestKey === null || less(key, bestKey)) {
        bestKey = key;
        bestColour = c;
        bestScore = score;
      }
    }
    if (bestColour === null) throw new Error("colour capacities exhausted");
    p.colour = bestColour;
    caps[bestColour] -= 1;
    conflicts += bestScore;
  }
  return conflicts;
}

function less(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}
