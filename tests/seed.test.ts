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
  guardVerb,
  isTracked,
  NAME_MAX,
  parseArgs,
  validateSeedFile,
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
    const guard = guardCodeWrite("boards.example.json", true);
    assert.equal(guard.ok, false);
    assert.ok(!guard.ok && guard.reason.includes("tracked by git"));
  });

  it("writes into an untracked one", () => {
    assert.equal(guardCodeWrite("boards.throwaway.json", false).ok, true);
  });
});

describe("isTracked()", () => {
  it("knows what git knows", () => {
    assert.equal(isTracked("package.json"), true);
    assert.equal(isTracked("boards.throwaway.json"), false);
    assert.equal(isTracked("boards.local.json"), false);
  });

  it("refuses to write a code back into the committed example", () => {
    const guard = guardCodeWrite("boards.example.json", isTracked("boards.example.json"));
    assert.equal(guard.ok, false);
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
