/**
 * `data/deck.json` as a physical object: sixty cards you can actually set up
 * out of one box, in an order that climbs, with no two cards that look alike —
 * and a build that produces the same bytes twice.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildDeck } from "../scripts/build-deck";
import { COLOUR_ORDER, INVENTORY, N, footprint, parse, similarity } from "../src/lib/board";
import { BANDS, CARDS_PER_TIER, DECK_SIZE, TIERS } from "../src/lib/tiers";
import type { Colour, Deck, Tier } from "../src/lib/types";

const DECK_PATH = fileURLToPath(new URL("../data/deck.json", import.meta.url));
const DECK_SHA256 = "fe31aa9a478ab285b76a0d9fc39398f2b2054a5fa552e596c83a2149208d2418";

const text = readFileSync(DECK_PATH, "utf8");
const deck: Deck = JSON.parse(text) as Deck;
const cards = deck.cards;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

test("sixty cards numbered 1..60 with par climbing", () => {
  assert.equal(cards.length, DECK_SIZE);
  assert.deepEqual(
    cards.map((c) => c.n),
    Array.from({ length: DECK_SIZE }, (_, i) => i + 1),
  );
  for (let i = 1; i < cards.length; i++) {
    assert.ok(
      cards[i].moves >= cards[i - 1].moves,
      `card ${cards[i].n} is not easier than card ${cards[i - 1].n}`,
    );
  }
});

test("twelve cards per tier, each inside its band", () => {
  for (const tier of TIERS) {
    const inTier = cards.filter((c) => c.tier === tier);
    assert.equal(inTier.length, CARDS_PER_TIER, `${tier} card count`);
    const [lo, hi] = BANDS[tier];
    for (const card of inTier) {
      assert.ok(
        card.moves >= lo && card.moves <= hi,
        `card ${card.n} at ${card.moves} moves is outside ${tier} ${lo}-${hi}`,
      );
    }
  }
  // Tiers run in order, so card numbers do not interleave.
  assert.deepEqual(
    [...new Set(cards.map((c) => c.tier))],
    TIERS.map((t) => t),
  );
});

test("every card fits in one box", () => {
  for (const card of cards) {
    const used = new Map<string, number>();
    let heroes = 0;
    let pylons = 0;
    for (const piece of card.pieces) {
      if (piece.kind === "hero") {
        heroes++;
        assert.equal(piece.colour, "red", `card ${card.n}: the hero is red`);
        continue;
      }
      if (piece.kind === "pylon") {
        pylons++;
        assert.equal(piece.colour, "yellow", `card ${card.n}: pylons are yellow`);
        continue;
      }
      const key = `${piece.kind}:${piece.colour}`;
      used.set(key, (used.get(key) ?? 0) + 1);
    }
    assert.equal(heroes, 1, `card ${card.n}: exactly one hero`);
    assert.equal(card.pieces[0].kind, "hero", `card ${card.n}: the hero comes first`);
    assert.ok(pylons <= INVENTORY.pylon, `card ${card.n}: at most two pylons`);
    assert.equal(pylons, card.needs.pylon, `card ${card.n}: needs.pylon counts the pylons`);
    for (const colour of COLOUR_ORDER) {
      assert.ok(
        (used.get(`car:${colour}`) ?? 0) <= INVENTORY.car[colour],
        `card ${card.n}: ${colour} cars within ${INVENTORY.car[colour]}`,
      );
      assert.ok(
        (used.get(`truck:${colour}`) ?? 0) <= INVENTORY.truck[colour],
        `card ${card.n}: ${colour} trucks within ${INVENTORY.truck[colour]}`,
      );
      assert.equal(
        used.get(`car:${colour}`) ?? 0,
        card.needs.car[colour],
        `card ${card.n}: needs.car.${colour}`,
      );
      assert.equal(
        used.get(`truck:${colour}`) ?? 0,
        card.needs.truck[colour],
        `card ${card.n}: needs.truck.${colour}`,
      );
    }
  }
});

test("needs and staysInBox partition the box", () => {
  for (const card of cards) {
    for (const kind of ["car", "truck"] as const) {
      for (const colour of COLOUR_ORDER) {
        assert.equal(
          card.needs[kind][colour] + card.staysInBox[kind][colour],
          INVENTORY[kind][colour],
          `card ${card.n}: ${colour} ${kind}s`,
        );
      }
    }
    assert.equal(card.needs.pylon + card.staysInBox.pylon, INVENTORY.pylon, `card ${card.n} pylons`);
  }
});

test("no pylon sits in the exit row to the hero's right", () => {
  for (const card of cards) {
    const hero = card.pieces[0];
    for (const piece of card.pieces) {
      if (piece.kind !== "pylon") continue;
      assert.ok(
        !(piece.row === 2 && piece.col > hero.col + 1),
        `card ${card.n}: pylon at row ${piece.row} col ${piece.col} blocks the exit`,
      );
    }
  }
});

test("no two cards are near-twins", () => {
  const prints = cards.map((c) => {
    const { pieces, walls } = parse(c.board);
    return footprint(pieces, walls);
  });
  let worst = 0;
  let worstPair = "";
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const s = similarity(prints[i], prints[j]);
      if (s > worst) {
        worst = s;
        worstPair = `#${cards[i].n} and #${cards[j].n}`;
      }
    }
  }
  assert.ok(worst < 0.5, `${worstPair} are ${worst.toFixed(2)} similar`);
});

test("pylon cards land on the slots the header declares", () => {
  const expected: Record<Tier, number> = {
    beginner: 0,
    intermediate: 2,
    advanced: 3,
    expert: 4,
    grandmaster: 6,
  };
  for (const tier of TIERS) {
    const slots = Object.values(deck.generator.pylonSlots[tier]);
    assert.equal(
      slots.filter((v) => v > 0).length,
      expected[tier],
      `${tier}: pylon slots in the header`,
    );
    const inTier = cards.filter((c) => c.tier === tier);
    assert.equal(
      inTier.filter((c) => c.needs.pylon > 0).length,
      expected[tier],
      `${tier}: pylon cards in the deck`,
    );
    assert.equal(
      inTier.reduce((sum, c) => sum + c.needs.pylon, 0),
      slots.reduce((sum, v) => sum + v, 0),
      `${tier}: total pylons`,
    );
  }
  assert.equal(cards.filter((c) => c.needs.pylon === 1).length, 11, "one-pylon cards");
  assert.equal(cards.filter((c) => c.needs.pylon === 2).length, 4, "two-pylon cards");
  assert.equal(cards.filter((c) => c.needs.pylon > 0).length, 15, "pylon cards");
});

/**
 * Pieces that hold the same lane offset in every state of the cluster: a
 * vehicle you have to read as a wall. Fogleman's rows are minimal, so these are
 * not filtered out — but there should be very few, and this counts them with a
 * BFS of its own, sweeping the whole lane per candidate offset rather than
 * walking outward the way `solver.ts` does.
 */
function immovable(board: string): { ids: string[]; cluster: number } {
  const { pieces, walls } = parse(board);
  const n = pieces.length;
  const spans = pieces.map((p) => N - p.length + 1);
  const cellsAt = (i: number, off: number): number[] => {
    const p = pieces[i];
    const out: number[] = [];
    for (let k = 0; k < p.length; k++) {
      out.push(p.orientation === "h" ? p.row * N + off + k : (off + k) * N + p.col);
    }
    return out;
  };
  const start = pieces.map((p) => (p.orientation === "h" ? p.col : p.row));
  const reached = pieces.map((_, i) => new Set<number>([start[i]]));
  const seen = new Set<string>([start.join(",")]);
  const queue: number[][] = [start];

  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    const occupied = new Uint8Array(36);
    for (const w of walls) occupied[w.cells[0]] = 1;
    for (let i = 0; i < n; i++) for (const c of cellsAt(i, state[i])) occupied[c] = 1;
    for (let i = 0; i < n; i++) {
      for (const c of cellsAt(i, state[i])) occupied[c] = 0;
      for (let j = 0; j < spans[i]; j++) {
        if (j === state[i]) continue;
        const from = Math.min(j, state[i]);
        const to = Math.max(j, state[i]);
        let clear = true;
        for (let k = from; k <= to && clear; k++) {
          for (const c of cellsAt(i, k)) {
            if (occupied[c] === 1) {
              clear = false;
              break;
            }
          }
        }
        if (!clear) continue;
        reached[i].add(j);
        const next = state.slice();
        next[i] = j;
        const key = next.join(",");
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
      for (const c of cellsAt(i, state[i])) occupied[c] = 1;
    }
  }
  return {
    ids: pieces.filter((_, i) => reached[i].size === 1).map((p) => p.id),
    cluster: seen.size,
  };
}

test("three cards carry a vehicle that never moves", () => {
  const found: [number, string[]][] = [];
  for (const card of cards) {
    const { ids, cluster } = immovable(card.board);
    assert.equal(cluster, card.cluster, `card ${card.n}: independent cluster size`);
    if (ids.length > 0) found.push([card.n, ids]);
  }
  assert.equal(found.length, 3, `cards with an immovable piece: ${JSON.stringify(found)}`);
  assert.deepEqual(found, [
    [21, ["D"]],
    [36, ["H"]],
    [52, ["D"]],
  ]);
});

test("the header describes the file it heads", () => {
  assert.equal(deck.source.file, "rush.txt");
  assert.equal(deck.source.rows, 2_577_412);
  assert.equal(
    deck.source.sha256,
    "fca9f04db491415ac257416cd25b304670f2859f5f1bb1f4948c7f30ba14626f",
  );
  assert.equal(deck.generator.version, 1);
  assert.equal(deck.generator.seed, "toronto-parking-v1");
  assert.equal(deck.generator.deckSize, DECK_SIZE);
  assert.deepEqual(deck.generator.bands, BANDS);
  assert.equal(sha256(text), DECK_SHA256, "the committed deck is the accepted one");
  // Every colour a card mentions is one of the four the box holds.
  const colours: Colour[] = ["red", ...COLOUR_ORDER];
  for (const card of cards) {
    for (const piece of card.pieces) {
      assert.ok(colours.includes(piece.colour), `card ${card.n}: ${piece.colour}`);
    }
  }
});

const rushPath = process.env.RUSH_TXT ?? "./rush.txt";
const haveRush = existsSync(rushPath);

test(
  "building twice from rush.txt gives the same bytes",
  { skip: haveRush ? false : "rush.txt not found; set RUSH_TXT to run this" },
  () => {
    const first = buildDeck(rushPath);
    const second = buildDeck(rushPath);
    assert.equal(sha256(first), sha256(second), "two builds disagree");
    assert.equal(sha256(first), DECK_SHA256, "the build misses the acceptance digest");
    assert.equal(first, text, "the build differs from the committed data/deck.json");
  },
);
