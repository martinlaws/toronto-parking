import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { isValidCode } from "../src/lib/code";
import {
  BOARD_COUNT,
  DEDICATION_MAX,
  DEFAULT_FILE,
  guardCodeWrite,
  guardKnownCodes,
  guardNewBoards,
  guardVerb,
  isIgnored,
  isTracked,
  NAME_MAX,
  parseArgs,
  validateSeedFile,
  type ExistingBoard,
  type SeedEntry,
} from "../scripts/seed-boards";

/** Importing the script runs nothing: `main()` is behind an argv check. */

const entry = (partial: Partial<SeedEntry> = {}): SeedEntry => ({
  n: 1,
  code: "",
  name: "Recipient",
  dedication: "Two lines at most.",
  ...partial,
});

describe("parseArgs()", () => {
  it("defaults to seeding the gitignored file in dev", () => {
    assert.deepEqual(parseArgs([]), {
      verb: "seed",
      production: false,
      yes: false,
      file: DEFAULT_FILE,
      codes: [],
    });
  });

  it("dispatches on the verb flags", () => {
    assert.equal(parseArgs(["--ls"]).verb, "ls");
    assert.equal(parseArgs(["--reset", "abc123"]).verb, "reset");
    assert.equal(parseArgs(["--rm", "abc123"]).verb, "rm");
    assert.deepEqual(parseArgs(["--rm", "abc123"]).codes, ["abc123"]);
  });

  it("reads --file in both spellings and --production and --yes", () => {
    assert.equal(parseArgs(["--file", "boards.throwaway.json"]).file, "boards.throwaway.json");
    assert.equal(parseArgs(["--file=boards.throwaway.json"]).file, "boards.throwaway.json");
    assert.equal(parseArgs(["--production"]).production, true);
    assert.equal(parseArgs(["--yes"]).yes, true);
  });

  it("refuses a flag it does not know", () => {
    assert.throws(() => parseArgs(["--force"]), /Unknown flag --force/);
  });
});

describe("validateSeedFile()", () => {
  it("accepts the committed example", () => {
    const example = [1, 2, 3, 4].map((n) => entry({ n }));
    const result = validateSeedFile(example, { isCode: isValidCode });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.entries.length, 4);
  });

  it("wants n an integer 1 to 4", () => {
    for (const n of [0, 5, 1.5, "1"]) {
      const result = validateSeedFile([{ ...entry(), n }]);
      assert.equal(result.ok, false, String(n));
    }
  });

  it("refuses a repeated n", () => {
    const result = validateSeedFile([entry({ n: 2 }), entry({ n: 2 })]);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.problems.some((p) => p.includes("used twice")));
  });

  it("caps the name at 40 characters and wants one at all", () => {
    assert.equal(validateSeedFile([entry({ name: "a".repeat(NAME_MAX) })]).ok, true);
    assert.equal(validateSeedFile([entry({ name: "a".repeat(NAME_MAX + 1) })]).ok, false);
    assert.equal(validateSeedFile([entry({ name: "   " })]).ok, false);
  });

  it("caps the dedication at 280 characters and allows none", () => {
    assert.equal(validateSeedFile([entry({ dedication: "a".repeat(DEDICATION_MAX) })]).ok, true);
    assert.equal(
      validateSeedFile([entry({ dedication: "a".repeat(DEDICATION_MAX + 1) })]).ok,
      false,
    );
    assert.equal(validateSeedFile([entry({ dedication: "" })]).ok, true);
  });

  it("refuses a code that is not a board code", () => {
    assert.equal(validateSeedFile([entry({ code: "nope" })], { isCode: isValidCode }).ok, false);
    assert.equal(validateSeedFile([entry({ code: "h7k2np" })], { isCode: isValidCode }).ok, true);
  });

  it("refuses a file that is not an array of entries", () => {
    assert.equal(validateSeedFile({}).ok, false);
    assert.equal(validateSeedFile([]).ok, false);
    assert.equal(validateSeedFile(["nope"]).ok, false);
    assert.equal(
      validateSeedFile([1, 2, 3, 4, 5].map((n) => entry({ n: Math.min(n, BOARD_COUNT) }))).ok,
      false,
    );
  });
});

describe("guardVerb()", () => {
  it("never removes a production board", () => {
    const guard = guardVerb({ verb: "rm", production: true, yes: true, codes: ["h7k2np"] });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("--rm never runs against production"));
  });

  it("wants --yes before clearing a production board's solves", () => {
    assert.equal(
      guardVerb({ verb: "reset", production: true, yes: false, codes: ["h7k2np"] }).ok,
      false,
    );
    assert.equal(
      guardVerb({ verb: "reset", production: true, yes: true, codes: ["h7k2np"] }).ok,
      true,
    );
  });

  it("clears a dev board without a --yes", () => {
    assert.equal(
      guardVerb({ verb: "reset", production: false, yes: false, codes: ["h7k2np"] }).ok,
      true,
    );
    assert.equal(
      guardVerb({ verb: "rm", production: false, yes: false, codes: ["h7k2np"] }).ok,
      true,
    );
  });

  it("wants exactly one code for reset and rm", () => {
    assert.equal(guardVerb({ verb: "reset", production: false, yes: false, codes: [] }).ok, false);
    assert.equal(
      guardVerb({ verb: "rm", production: false, yes: false, codes: ["a", "b"] }).ok,
      false,
    );
    assert.equal(guardVerb({ verb: "seed", production: false, yes: false, codes: [] }).ok, true);
    assert.equal(guardVerb({ verb: "ls", production: false, yes: false, codes: [] }).ok, true);
  });
});

describe("guardCodeWrite()", () => {
  it("never writes a code into a tracked file", () => {
    const guard = guardCodeWrite("boards.example.json", { tracked: true, ignored: false });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("tracked by git"));
  });

  it("writes into an untracked, gitignored one", () => {
    const guard = guardCodeWrite("boards.throwaway.json", { tracked: false, ignored: true });
    assert.equal(guard.ok, true);
  });

  it("refuses an untracked file git is not ignoring, since git add -A would commit it", () => {
    const guard = guardCodeWrite("boards.json", { tracked: false, ignored: false });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("not gitignored"));
  });
});

describe("isTracked() and isIgnored()", () => {
  it("knows what git tracks", () => {
    assert.equal(isTracked("package.json"), true);
    assert.equal(isTracked("boards.throwaway.json"), false);
    assert.equal(isTracked(DEFAULT_FILE), false);
  });

  it("knows what git ignores, and counts a path outside the worktree as safe", () => {
    assert.equal(isIgnored("boards.throwaway.json"), true);
    assert.equal(isIgnored(DEFAULT_FILE), true);
    assert.equal(isIgnored("boards.json"), false);
    assert.equal(isIgnored("package.json"), false);
    // `git check-ignore` exits 128 on this one. Nothing committed from this
    // repo can carry a file that is not in it.
    assert.equal(isIgnored("/tmp/toronto-parking-outside.json"), true);
  });

  it("refuses to write a code back into the committed example", () => {
    const guard = guardCodeWrite("boards.example.json", {
      tracked: isTracked("boards.example.json"),
      ignored: isIgnored("boards.example.json"),
    });
    assert.equal(guard.ok, false);
  });

  it("refuses the untracked, un-ignored file the pair is there to catch", () => {
    const guard = guardCodeWrite("boards.json", {
      tracked: isTracked("boards.json"),
      ignored: isIgnored("boards.json"),
    });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("not gitignored"));
  });

  it("lets the default seed file through", () => {
    const guard = guardCodeWrite(DEFAULT_FILE, {
      tracked: isTracked(DEFAULT_FILE),
      ignored: isIgnored(DEFAULT_FILE),
    });
    assert.equal(guard.ok, true);
  });
  it("refuses when git could not answer at all, rather than blaming the file", () => {
    const guard = guardCodeWrite("boards.throwaway.json", { tracked: false, ignored: null });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("could not say"));
    assert.ok(!guard.ok && !guard.reason.includes("not gitignored"));
  });
});

describe("guardKnownCodes()", () => {
  const known = new Set(["h7k2np"]);

  it("passes a code the store already has", () => {
    assert.equal(guardKnownCodes([entry({ code: "h7k2np" })], known, false).ok, true);
  });

  it("passes an entry with no code yet", () => {
    assert.equal(guardKnownCodes([entry({ code: "" })], known, false).ok, true);
  });

  it("refuses a code the store has never seen, since a typo mints a fifth board", () => {
    const guard = guardKnownCodes([entry({ code: "zzzzzz" })], known, false);
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("fifth board"));
  });

  it("yields to an explicit --yes", () => {
    assert.equal(guardKnownCodes([entry({ code: "zzzzzz" })], known, true).ok, true);
  });
});

describe("guardNewBoards()", () => {
  // Placeholders, the shape of a store row and nothing more.
  const board = (n: number, code: string): ExistingBoard => ({ n, code, name: `Recipient ${n}` });
  const dev = { file: "boards.throwaway.json", production: false, yes: false };
  const prod = { file: "boards.throwaway.json", production: true, yes: false };

  it("mints a board on a number the store has not got", () => {
    assert.equal(guardNewBoards([entry({ n: 2, code: "" })], [board(1, "h7k2np")], dev).ok, true);
  });

  it("mints nothing when the file carries codes, whatever the store holds", () => {
    const guard = guardNewBoards([entry({ n: 1, code: "h7k2np" })], [board(1, "h7k2np")], prod);
    assert.equal(guard.ok, true);
  });

  it("refuses an empty code on a number the store already holds", () => {
    const guard = guardNewBoards([entry({ n: 1, code: "" })], [board(1, "h7k2np")], dev);
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("Board 1 is already in the boards set"));
  });

  it("prints the row so the code can go back into the file", () => {
    const guard = guardNewBoards([entry({ n: 1, code: "" })], [board(1, "h7k2np")], dev);
    assert.ok(!guard.ok && guard.reason.includes("1 · h7k2np · Recipient 1"));
    assert.ok(!guard.ok && guard.reason.includes("boards.throwaway.json"));
  });

  it("catches the whole lost seed file, not just the fifth board", () => {
    const existing = [1, 2, 3, 4].map((n) => board(n, `h7k2n${n}`));
    const rebuilt = [1, 2, 3, 4].map((n) => entry({ n, code: "" }));
    const guard = guardNewBoards(rebuilt, existing, prod);
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("Boards 1, 2, 3, 4 are already in the boards set"));
    for (const n of [1, 2, 3, 4]) {
      assert.ok(!guard.ok && guard.reason.includes(`${n} · h7k2n${n} · Recipient ${n}`));
    }
  });

  it("yields to --yes in dev, where --rm can clean up", () => {
    const guard = guardNewBoards([entry({ n: 1, code: "" })], [board(1, "h7k2np")], {
      ...dev,
      yes: true,
    });
    assert.equal(guard.ok, true);
  });

  it("never yields to --yes in production, where --rm is refused", () => {
    const guard = guardNewBoards([entry({ n: 1, code: "" })], [board(1, "h7k2np")], {
      ...prod,
      yes: true,
    });
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("--rm never runs against production"));
    assert.ok(!guard.ok && !guard.reason.includes("--yes"));
  });
});

describe("the store is never imported at module scope", () => {
  it("keeps seed-boards free of static src/ imports, so --production decides the prefix", () => {
    const source = readFileSync(join(process.cwd(), "scripts/seed-boards.ts"), "utf8");
    const staticImports = source.match(/^import .*$/gm) ?? [];
    for (const line of staticImports) {
      assert.ok(
        !line.includes("../src/"),
        `${line} runs before VERCEL_ENV is set from the flag`,
      );
    }
    assert.ok(source.includes('await import("../src/lib/store")'));
    assert.ok(source.includes('await import("../src/lib/boards")'));
    assert.ok(
      source.indexOf("process.env.VERCEL_ENV =") < source.indexOf('await import("../src/lib/store")'),
      "the assignment must come first",
    );
  });
});
