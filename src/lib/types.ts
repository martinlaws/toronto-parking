/**
 * The deck's data shapes. `data/deck.json` is exactly one `Deck`, written by
 * `scripts/build-deck.ts` and never hand-edited.
 *
 * `moves` is what every page calls Par: there is no `par` field, and no `walls`
 * field either — the pylon count is `needs.pylon`. `pieces[0]` is always the
 * hero. `row` and `col` are 0-indexed; the renderer adds 1 for people.
 */
export type Tier =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
  | "grandmaster";

export type Colour = "red" | "blue" | "yellow" | "green";

/** Direction words in the canonical exit-right frame; rotation maps them at render time. */
export type Dir = "up" | "down" | "left" | "right";

export type Vehicle = {
  id: string;
  kind: "hero" | "car" | "truck";
  colour: Colour;
  row: number;
  col: number;
  orientation: "h" | "v";
  length: 2 | 3;
};

export type Pylon = {
  id: string;
  kind: "pylon";
  colour: "yellow";
  row: number;
  col: number;
  orientation: null;
  length: 1;
};

export type Piece = Vehicle | Pylon;

export type Move = { pieceId: string; dir: Dir; cells: number };

/** Physical pieces, by kind and colour. The hero is excluded: there is always exactly one. */
export type Counts = {
  car: Record<Exclude<Colour, "red">, number>;
  truck: Record<Exclude<Colour, "red">, number>;
  pylon: number;
};

export type Card = {
  n: number;
  tier: Tier;
  board: string;
  moves: number;
  cluster: number;
  pieces: Piece[];
  solution: Move[];
  needs: Counts;
  staysInBox: Counts;
  meta: { branching: number; optimalFirstMoves: number };
};

export type Deck = {
  source: { file: "rush.txt"; sha256: string; rows: number };
  generator: {
    version: number;
    seed: string;
    deckSize: number;
    bands: Record<Tier, [number, number]>;
    pylonSlots: Record<Tier, Record<string, number>>;
  };
  cards: Card[];
};
