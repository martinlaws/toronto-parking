/**
 * `src/lib/board.ts`: Fogleman's 36-character strings in and out, the letter
 * gap a pylon leaves, the shapes `parse()` refuses, and the checklist copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BadBoardError,
  cellName,
  cellNameAt,
  checklistParts,
  parse,
  unparse,
} from "../src/lib/board";
import type { Card, Counts, Deck } from "../src/lib/types";

const deck: Deck = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/deck.json", import.meta.url)), "utf8"),
) as Deck;

const fixture: string[] = readFileSync(
  fileURLToPath(new URL("./fixtures/rush1000.txt", import.meta.url)),
  "utf8",
)
  .split("\n")
  .filter((line) => line.length > 0);

/** A 36-character board from six row strings, for the error cases below. */
function board(...rows: string[]): string {
  return rows.join("");
}

const EMPTY = "oooooo";

test("round-trips all 1,000 fixture rows", () => {
  assert.equal(fixture.length, 1000);
  for (const line of fixture) {
    const b = line.split(" ")[1];
    const { pieces, walls } = parse(b);
    assert.equal(unparse(pieces, walls), b);
  }
});

test("round-trips all 60 cards", () => {
  assert.equal(deck.cards.length, 60);
  for (const card of deck.cards) {
    const { pieces, walls } = parse(card.board);
    assert.equal(unparse(pieces, walls), card.board, `card ${card.n}`);
  }
});

test("a pylon consumes a letter index, so the finale board has no C", () => {
  const finale = "IBBxooIooLDDJAALooJoKEEMFFKooMGGHHHM";
  const { pieces, walls } = parse(finale);
  const letters = pieces.map((p) => p.letter);
  assert.ok(letters.includes("B"), "B is present");
  assert.ok(letters.includes("D"), "D is present");
  assert.ok(!letters.includes("C"), "C is the pylon's letter index and is absent");
  assert.deepEqual(
    walls.map((w) => ({ id: w.id, row: w.row, col: w.col })),
    [{ id: "x1", row: 0, col: 3 }],
  );
});

test("two pylons get ids x1 and x2 in reading order", () => {
  const twoPylons = deck.cards.filter((c) => c.needs.pylon === 2);
  assert.equal(twoPylons.length, 4);
  for (const card of twoPylons) {
    const { walls } = parse(card.board);
    assert.deepEqual(
      walls.map((w) => w.id),
      ["x1", "x2"],
      `card ${card.n}`,
    );
    const [first, second] = walls;
    assert.ok(
      first.row * 6 + first.col < second.row * 6 + second.col,
      `card ${card.n}: x1 comes before x2 in reading order`,
    );
  }
});

test("parse refuses boards it cannot read", () => {
  const cases: [string, string][] = [
    ["off-stride group", board("BoBooo", EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["non-contiguous run", board("BBoBoo", EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["wrapped horizontal group", board("oooooB", "Booooo", "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["bad character", board("zzoooo", EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["one-cell group", board("Booooo", EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["four-cell group", board("BBBBoo", EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY)],
    ["no hero", board("BBoooo", EMPTY, EMPTY, EMPTY, EMPTY, EMPTY)],
    ["hero on the wrong row", board("AAoooo", EMPTY, EMPTY, EMPTY, EMPTY, EMPTY)],
    ["hero vertical", board(EMPTY, EMPTY, "Aooooo", "Aooooo", EMPTY, EMPTY)],
    ["hero three long", board(EMPTY, EMPTY, "AAAooo", EMPTY, EMPTY, EMPTY)],
  ];
  for (const [why, b] of cases) {
    assert.equal(b.length, 36, `${why}: fixture is 36 chars`);
    assert.throws(() => parse(b), BadBoardError, why);
  }
  assert.throws(() => parse("AAoooo"), BadBoardError, "too short");
  assert.throws(
    () => parse(board(EMPTY, EMPTY, "AAoooo", EMPTY, EMPTY, EMPTY) + "o"),
    BadBoardError,
    "too long",
  );
});

test("cellName reads the frame grid A-F by 1-6", () => {
  assert.equal(cellName(0), "A1");
  assert.equal(cellName(5), "F1");
  assert.equal(cellName(6), "A2");
  assert.equal(cellName(16), "E3");
  assert.equal(cellName(17), "F3");
  assert.equal(cellName(35), "F6");
  assert.equal(cellNameAt(2, 0), "A3");
  assert.equal(cellNameAt(4, 3), "D5");
});

test("checklistParts spells the spec's example line", () => {
  const counts: Counts = {
    car: { blue: 3, yellow: 2, green: 1 },
    truck: { blue: 1, yellow: 1, green: 0 },
    pylon: 2,
  };
  assert.equal(
    checklistParts(counts, true).join(" · "),
    "3 blue cars · 2 yellow cars · 1 green car · 1 yellow truck · 1 blue truck · 2 pylons · the red car",
  );
});

test("checklistParts spells card #1", () => {
  const one: Card = deck.cards[0];
  assert.equal(one.n, 1);
  assert.equal(
    checklistParts(one.needs, true).join(" · "),
    "2 blue cars · 2 yellow cars · 1 green car · 1 yellow truck · the red car",
  );
  // "Stays in the box" is the same list without the hero, which is never spare.
  assert.equal(
    checklistParts(one.staysInBox, false).join(" · "),
    "2 blue cars · 2 yellow cars · 3 green cars · 1 yellow truck · 1 blue truck · 1 green truck · 2 pylons",
  );
});
