/**
 * `src/lib/solver.ts` against the two things that can check it: Fogleman's own
 * par and cluster figures for a thousand rows, and the sixty solutions the deck
 * ships, replayed move by move on an independent board model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { N, parse, type ParsedVehicle } from "../src/lib/board";
import { solve } from "../src/lib/solver";
import type { Card, Deck, Dir } from "../src/lib/types";

const deck: Deck = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/deck.json", import.meta.url)), "utf8"),
) as Deck;

const fixture: string[] = readFileSync(
  fileURLToPath(new URL("./fixtures/rush1000.txt", import.meta.url)),
  "utf8",
)
  .split("\n")
  .filter((line) => line.length > 0);

const STEP: Record<Dir, number> = { left: -1, right: 1, up: -N, down: N };

test("par and cluster match Fogleman for all 1,000 fixture rows", () => {
  assert.equal(fixture.length, 1000);
  let states = 0;
  for (const line of fixture) {
    const [moves, board, cluster] = line.split(" ");
    // The fast path: forward BFS only, which is all par and the cluster need.
    const r = solve(board, { analyse: false });
    assert.notEqual(r, null, board);
    assert.equal(r!.moves, Number(moves), `par for ${board}`);
    assert.equal(r!.cluster, Number(cluster), `cluster for ${board}`);
    states += r!.cluster;
  }
  assert.equal(states, 5_868_246, "the sweep visits the whole database of clusters");
});

/**
 * Replays a stored solution on a plain set of occupied cells — no lane masks,
 * no state keys — so a bug in the solver's bitmask arithmetic cannot hide here.
 */
function replay(card: Card): void {
  const { pieces, walls } = parse(card.board);
  const occupied = new Set<number>();
  for (const w of walls) occupied.add(w.cells[0]);
  for (const p of pieces) for (const c of p.cells) occupied.add(c);
  const byId = new Map<string, ParsedVehicle>();
  for (const p of pieces) byId.set(p.id, p);

  card.solution.forEach((move, k) => {
    const where = `card ${card.n} move ${k + 1}`;
    const piece = byId.get(move.pieceId);
    if (piece === undefined) throw new Error(`${where}: ${move.pieceId} is not on the board`);
    assert.equal(
      piece.orientation === "h",
      move.dir === "left" || move.dir === "right",
      `${where}: slides along its own axis`,
    );
    assert.ok(move.cells >= 1, `${where}: slides at least one cell`);
    const step = STEP[move.dir];
    const from: number[] = piece.cells;
    for (const c of from) occupied.delete(c);
    const row = Math.floor(from[0] / N);
    for (let s = 1; s <= move.cells; s++) {
      for (const c of from) {
        const to: number = c + step * s;
        assert.ok(to >= 0 && to < 36, `${where}: stays on the board`);
        if (piece.orientation === "h") {
          assert.equal(Math.floor(to / N), row, `${where}: stays in its lane`);
        }
        assert.ok(!occupied.has(to), `${where}: crosses no occupied cell`);
      }
    }
    piece.cells = from.map((c) => c + step * move.cells);
    for (const c of piece.cells) occupied.add(c);
  });

  const hero = byId.get("A")!;
  assert.deepEqual(hero.cells, [2 * N + 4, 2 * N + 5], `card ${card.n}: hero reaches the exit`);
  assert.equal(card.solution.length, card.moves, `card ${card.n}: in exactly par moves`);
}

test("every stored solution replays legally to the exit in exactly par moves", () => {
  assert.equal(deck.cards.length, 60);
  let total = 0;
  for (const card of deck.cards) {
    replay(card);
    total += card.solution.length;
  }
  assert.equal(total, 1597, "the deck stores 1,597 moves");
});

test("stored moves are canonical-frame direction words", () => {
  const seen: Record<string, number> = { up: 0, down: 0, left: 0, right: 0 };
  for (const card of deck.cards) {
    for (const move of card.solution) {
      assert.ok(move.dir in seen, `card ${card.n}: ${move.dir} is a direction word`);
      seen[move.dir] += 1;
    }
  }
  assert.deepEqual(seen, { left: 421, down: 393, up: 392, right: 391 });
});

test("branching and optimalFirstMoves match a recomputation on all 60 cards", () => {
  for (const card of deck.cards) {
    const r = solve(card.board);
    assert.notEqual(r, null, `card ${card.n}`);
    assert.equal(r!.moves, card.moves, `card ${card.n} par`);
    assert.equal(r!.cluster, card.cluster, `card ${card.n} cluster`);
    assert.equal(r!.branching, card.meta.branching, `card ${card.n} branching`);
    assert.equal(
      r!.optimalFirstMoves,
      card.meta.optimalFirstMoves,
      `card ${card.n} optimalFirstMoves`,
    );
    assert.deepEqual(r!.path, card.solution, `card ${card.n} solution path`);
  }
});
