import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import {
  boardFromHash,
  boardKey,
  boardsKey,
  clientIp,
  CODE_ALPHABET,
  CODE_LENGTH,
  generateCode,
  isValidCode,
  normalizeCode,
  panelRowText,
  parseCard,
  pickUpAt,
  relativeTime,
  resolveAt,
  retryAfterSeconds,
  solvedKey,
  solvesFromHash,
  sortPanel,
  summarise,
  type PanelRow,
} from "../src/lib/boards";
import { prefixFor } from "../src/lib/store";
import { DECK_SIZE } from "../src/lib/tiers";

/** Nothing in this file reaches a store: every export under test is pure. */

const originalEnv = process.env.VERCEL_ENV;
after(() => {
  if (originalEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnv;
});

describe("k()", () => {
  it("prefixes production only for VERCEL_ENV=production", () => {
    assert.equal(prefixFor("production"), "tp:prod:");
    assert.equal(prefixFor("preview"), "tp:dev:");
    assert.equal(prefixFor("development"), "tp:dev:");
    assert.equal(prefixFor(undefined), "tp:dev:");
    assert.equal(prefixFor(""), "tp:dev:");
  });

  it("builds the three key shapes in the dev branch", () => {
    process.env.VERCEL_ENV = "development";
    assert.equal(boardsKey(), "tp:dev:boards");
    assert.equal(boardKey("abc123"), "tp:dev:board:abc123");
    assert.equal(solvedKey("abc123"), "tp:dev:board:abc123:solved");
  });

  it("builds the three key shapes in the production branch", () => {
    process.env.VERCEL_ENV = "production";
    assert.equal(boardsKey(), "tp:prod:boards");
    assert.equal(boardKey("abc123"), "tp:prod:board:abc123");
    assert.equal(solvedKey("abc123"), "tp:prod:board:abc123:solved");
  });

  it("counts an unset environment as dev", () => {
    delete process.env.VERCEL_ENV;
    assert.equal(boardsKey(), "tp:dev:boards");
  });
});

describe("normalizeCode()", () => {
  it("folds the three look-alikes a reader can produce from print", () => {
    assert.equal(normalizeCode("OoIiLl"), "001111");
    assert.equal(normalizeCode("o"), "0");
    assert.equal(normalizeCode("I"), "1");
    assert.equal(normalizeCode("L"), "1");
  });

  it("lowercases and trims", () => {
    assert.equal(normalizeCode("  ABC23F "), "abc23f");
  });

  it("is idempotent, so the canonical redirect cannot loop", () => {
    for (const raw of ["OoIiLl", " ZZ9-Pl ", "abc123", ""]) {
      assert.equal(normalizeCode(normalizeCode(raw)), normalizeCode(raw));
    }
  });
});

describe("isValidCode()", () => {
  it("accepts a real six-character code", () => {
    assert.equal(isValidCode("h7k2np"), true);
    assert.equal(isValidCode("000000"), true);
    assert.equal(isValidCode("zzzzzz"), true);
  });

  it("rejects the wrong length", () => {
    assert.equal(isValidCode("h7k2n"), false);
    assert.equal(isValidCode("h7k2npq"), false);
  });

  it("rejects characters outside the alphabet", () => {
    for (const bad of ["h7k2ni", "h7k2nl", "h7k2no", "h7k2nu", "H7K2NP", "h7k2n-", "h7k2n "]) {
      assert.equal(isValidCode(bad), false, bad);
    }
  });

  it("rejects the empty string", () => {
    assert.equal(isValidCode(""), false);
  });
});

describe("generateCode()", () => {
  it("makes 1,000 codes that are all six characters inside the alphabet", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const code = generateCode();
      assert.equal(code.length, CODE_LENGTH);
      for (const character of code) {
        assert.ok(CODE_ALPHABET.includes(character), `${code} has ${character}`);
      }
      assert.equal(isValidCode(code), true, code);
      assert.equal(normalizeCode(code), code, `${code} is already canonical`);
      seen.add(code);
    }
    assert.ok(seen.size > 990, "30 bits should not collide over 1,000 draws");
  });
});

describe("parseCard()", () => {
  it("takes an integer in 1..DECK_SIZE and nothing else", () => {
    assert.equal(parseCard("0"), null);
    assert.equal(parseCard("1"), 1);
    assert.equal(parseCard("60"), 60);
    assert.equal(parseCard("61"), null);
    assert.equal(parseCard("x"), null);
    assert.equal(parseCard("1.5"), null);
    assert.equal(parseCard(""), null);
    assert.equal(parseCard("-1"), null);
    assert.equal(parseCard("01"), null);
    assert.equal(parseCard(undefined), null);
    assert.equal(parseCard(DECK_SIZE), DECK_SIZE);
  });
});

describe("resolveAt()", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("takes the client's stamp when it is in the past", () => {
    const result = resolveAt("2026-09-05T22:15:00.000Z", now);
    assert.deepEqual(result, { ok: true, at: "2026-09-05T22:15:00.000Z" });
  });

  it("clamps a future stamp to now", () => {
    const result = resolveAt("2030-01-01T00:00:00.000Z", now);
    assert.deepEqual(result, { ok: true, at: now.toISOString() });
  });

  it("uses server time when absent", () => {
    assert.deepEqual(resolveAt(undefined, now), { ok: true, at: now.toISOString() });
    assert.deepEqual(resolveAt(null, now), { ok: true, at: now.toISOString() });
    assert.deepEqual(resolveAt("", now), { ok: true, at: now.toISOString() });
  });

  it("refuses anything unparseable", () => {
    for (const bad of ["yesterday", "2026-13-45", {}, [], true]) {
      assert.deepEqual(resolveAt(bad, now), { ok: false }, JSON.stringify(bad));
    }
  });
});

describe("solvesFromHash()", () => {
  it("reads card numbers and drops anything else", () => {
    const solved = solvesFromHash({
      "3": "2026-09-03T00:00:00.000Z",
      "1": "2026-09-01T00:00:00.000Z",
      "61": "2026-09-04T00:00:00.000Z",
      junk: "2026-09-05T00:00:00.000Z",
      "2": "",
    });
    assert.deepEqual(solved, [
      { card: 1, at: "2026-09-01T00:00:00.000Z" },
      { card: 3, at: "2026-09-03T00:00:00.000Z" },
    ]);
  });

  it("treats a missing hash as no solves", () => {
    assert.deepEqual(solvesFromHash(null), []);
    assert.deepEqual(solvesFromHash({}), []);
  });
});

describe("boardFromHash()", () => {
  it("returns null for a hash that does not exist", () => {
    assert.equal(boardFromHash("abc123", null), null);
    assert.equal(boardFromHash("abc123", {}), null);
  });

  it("coerces n, which Upstash hands back as a number", () => {
    const board = boardFromHash("abc123", {
      n: 2,
      name: "Alex",
      dedication: "For the drive home.",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    assert.deepEqual(board, {
      code: "abc123",
      n: 2,
      name: "Alex",
      dedication: "For the drive home.",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
  });
});

describe("summarise()", () => {
  it("counts, finds the furthest card and the last solve", () => {
    const summary = summarise([
      { card: 1, at: "2026-09-01T00:00:00.000Z" },
      { card: 14, at: "2026-09-05T00:00:00.000Z" },
      { card: 7, at: "2026-09-03T00:00:00.000Z" },
    ]);
    assert.deepEqual(summary, {
      count: 3,
      furthest: 14,
      lastAt: "2026-09-05T00:00:00.000Z",
    });
  });

  it("reports nothing for an empty board", () => {
    assert.deepEqual(summarise([]), { count: 0, furthest: 0, lastAt: null });
  });
});

function row(partial: Partial<PanelRow>): PanelRow {
  return {
    code: "aaaaaa",
    n: 1,
    name: "Alex",
    solved: 0,
    furthest: 0,
    lastAt: null,
    you: false,
    ...partial,
  };
}

describe("sortPanel()", () => {
  it("sorts by furthest, then count, ties by name", () => {
    const sorted = sortPanel([
      row({ code: "cccccc", name: "Sam", furthest: 12, solved: 9 }),
      row({ code: "aaaaaa", name: "Bo", furthest: 31, solved: 20 }),
      row({ code: "dddddd", name: "Ali", furthest: 12, solved: 9 }),
      row({ code: "bbbbbb", name: "Kit", furthest: 12, solved: 11 }),
    ]);
    assert.deepEqual(
      sorted.map((entry) => entry.name),
      ["Bo", "Kit", "Ali", "Sam"],
    );
  });

  it("does not mutate what it was given", () => {
    const rows = [row({ name: "Bo", furthest: 1 }), row({ name: "Ali", furthest: 9 })];
    sortPanel(rows);
    assert.equal(rows[0].name, "Bo");
  });
});

describe("relativeTime()", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("reads in plain words", () => {
    assert.equal(relativeTime(ago(5_000), now), "just now");
    assert.equal(relativeTime(ago(60_000), now), "1 minute ago");
    assert.equal(relativeTime(ago(25 * 60_000), now), "25 minutes ago");
    assert.equal(relativeTime(ago(3 * 3_600_000), now), "3 hours ago");
    assert.equal(relativeTime(ago(2 * 86_400_000), now), "2 days ago");
    assert.equal(relativeTime(ago(14 * 86_400_000), now), "2 weeks ago");
    assert.equal(relativeTime(ago(120 * 86_400_000), now), "4 months ago");
  });

  it("never says fortnight", () => {
    for (const days of [13, 14, 15, 16]) {
      assert.ok(!relativeTime(ago(days * 86_400_000), now).includes("fortnight"));
    }
  });

  it("says nothing yet when there is no solve", () => {
    assert.equal(relativeTime(null, now), "nothing yet");
    assert.equal(relativeTime("not a date", now), "nothing yet");
  });
});

describe("panelRowText()", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("prints name, furthest, count and the relative time", () => {
    assert.equal(
      panelRowText(
        row({ name: "Alex", furthest: 14, solved: 11, lastAt: "2026-09-06T09:00:00.000Z" }),
        now,
      ),
      `Alex · card 14 · 11 of ${DECK_SIZE} · 3 hours ago`,
    );
  });

  it("drops the furthest cell for a board with nothing solved", () => {
    assert.equal(
      panelRowText(row({ name: "Alex" }), now),
      `Alex · 0 of ${DECK_SIZE} · nothing yet`,
    );
  });
});

describe("pickUpAt()", () => {
  it("is hidden at nothing solved and at the whole deck", () => {
    assert.equal(pickUpAt([]), null);
    assert.equal(
      pickUpAt(Array.from({ length: DECK_SIZE }, (_, i) => i + 1)),
      null,
    );
  });

  it("is the first unsolved card after the highest solved", () => {
    assert.equal(pickUpAt([1, 2, 3]), 4);
    assert.equal(pickUpAt([13]), 14);
    assert.equal(pickUpAt([1, 5, 13]), 14);
  });

  it("falls back to the earliest gap once the tail is done", () => {
    const all = Array.from({ length: DECK_SIZE }, (_, i) => i + 1).filter((n) => n !== 7);
    assert.equal(pickUpAt(all), 7);
  });
});

describe("clientIp() and retryAfterSeconds()", () => {
  it("takes the first hop of x-forwarded-for", () => {
    assert.equal(
      clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" })),
      "203.0.113.5",
    );
    assert.equal(clientIp(new Headers({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
    assert.equal(clientIp(new Headers()), "0.0.0.0");
  });

  it("rounds Retry-After up and never below one second", () => {
    const now = 1_000_000;
    assert.equal(retryAfterSeconds(now + 4_200, now), 5);
    assert.equal(retryAfterSeconds(now, now), 1);
    assert.equal(retryAfterSeconds(now - 9_000, now), 1);
  });
});
