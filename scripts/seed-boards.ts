import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * The one script behind `boards:seed`, `:ls`, `:reset` and `:rm`.
 *
 * Nothing here imports the store at module scope. The prefix is decided from
 * `--production` alone and written to `process.env.VERCEL_ENV` before the first
 * dynamic `import()`, so neither `.env.local` nor an exported shell variable can
 * point a dev run at the production keys.
 *
 * The pure halves below — the argument parser, the seed-file validator and the
 * three refusals — are exported so the tests can cover them with no store.
 */

export const DEFAULT_FILE = "boards.local.json";

export const NAME_MAX = 40;
export const DEDICATION_MAX = 280;
export const BOARD_COUNT = 4;

export type Verb = "seed" | "ls" | "reset" | "rm";

export type Args = {
  verb: Verb;
  production: boolean;
  yes: boolean;
  file: string;
  codes: string[];
};

export type SeedEntry = { n: number; code: string; name: string; dedication: string };

// ── Arguments ───────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    verb: "seed",
    production: false,
    yes: false,
    file: DEFAULT_FILE,
    codes: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--ls") args.verb = "ls";
    else if (token === "--reset") args.verb = "reset";
    else if (token === "--rm") args.verb = "rm";
    else if (token === "--production") args.production = true;
    else if (token === "--yes") args.yes = true;
    else if (token === "--file") args.file = argv[++i] ?? DEFAULT_FILE;
    else if (token.startsWith("--file=")) args.file = token.slice("--file=".length);
    else if (token.startsWith("--")) throw new Error(`Unknown flag ${token}`);
    else args.codes.push(token);
  }

  return args;
}

// ── The seed file ───────────────────────────────────────────────────────────

export type SeedFileResult =
  | { ok: true; entries: SeedEntry[] }
  | { ok: false; problems: string[] };

/**
 * `isCode` is injected so this stays free of every store import; the script
 * passes the real validator and the tests exercise the shape rules alone.
 */
export function validateSeedFile(
  value: unknown,
  opts: { isCode?: (code: string) => boolean } = {},
): SeedFileResult {
  const isCode = opts.isCode ?? (() => true);
  const problems: string[] = [];

  if (!Array.isArray(value)) return { ok: false, problems: ["The file must hold an array."] };
  if (value.length === 0) return { ok: false, problems: ["The file has no entries."] };
  if (value.length > BOARD_COUNT) problems.push(`There are only ${BOARD_COUNT} boards.`);

  const entries: SeedEntry[] = [];
  const seen = new Set<number>();

  value.forEach((raw, index) => {
    const where = `entry ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      problems.push(`${where} is not an object.`);
      return;
    }
    const item = raw as Record<string, unknown>;

    const n = item.n;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > BOARD_COUNT) {
      problems.push(`${where}: n must be an integer 1 to ${BOARD_COUNT}.`);
    } else if (seen.has(n)) {
      problems.push(`${where}: n ${n} is used twice.`);
    } else {
      seen.add(n);
    }

    const code = item.code;
    if (typeof code !== "string") problems.push(`${where}: code must be a string.`);
    else if (code !== "" && !isCode(code)) problems.push(`${where}: code is not a board code.`);

    const name = item.name;
    if (typeof name !== "string" || name.trim() === "") {
      problems.push(`${where}: name is required.`);
    } else if (name.length > NAME_MAX) {
      problems.push(`${where}: name is over ${NAME_MAX} characters.`);
    }

    const dedication = item.dedication;
    if (typeof dedication !== "string") {
      problems.push(`${where}: dedication must be a string.`);
    } else if (dedication.length > DEDICATION_MAX) {
      problems.push(`${where}: dedication is over ${DEDICATION_MAX} characters.`);
    }

    if (
      typeof n === "number" &&
      typeof code === "string" &&
      typeof name === "string" &&
      typeof dedication === "string"
    ) {
      entries.push({ n, code, name, dedication });
    }
  });

  return problems.length > 0 ? { ok: false, problems } : { ok: true, entries };
}

// ── Refusals ────────────────────────────────────────────────────────────────

export type Guard = { ok: true } | { ok: false; reason: string };

const OK: Guard = { ok: true };

/** `--rm` never touches production, and clearing a production board wants a `--yes`. */
export function guardVerb(args: Pick<Args, "verb" | "production" | "yes" | "codes">): Guard {
  if (args.verb === "rm" && args.production) {
    return {
      ok: false,
      reason: "--rm never runs against production. A printed code cannot be reissued.",
    };
  }
  if (args.verb === "reset" && args.production && !args.yes) {
    return { ok: false, reason: "Add --yes to clear a production board's solves." };
  }
  if ((args.verb === "reset" || args.verb === "rm") && args.codes.length !== 1) {
    return { ok: false, reason: `--${args.verb} takes exactly one code.` };
  }
  return OK;
}

/**
 * Names and codes never enter a file that git could commit, so a code is only
 * ever written to one git is ignoring. Untracked is not enough: a fresh
 * `boards.json` is untracked, un-ignored, and one `git add -A` from public.
 *
 * Both facts are passed in so the guard stays pure and the tests can cover it
 * without shelling out.
 */
export function guardCodeWrite(
  file: string,
  git: { tracked: boolean; ignored: boolean | null },
): Guard {
  if (git.tracked) {
    return {
      ok: false,
      reason: `${file} is tracked by git. Codes and names belong in ${DEFAULT_FILE}, which is not.`,
    };
  }
  if (git.ignored === null) {
    return {
      ok: false,
      reason: `git could not say whether ${file} is ignored, so no code was minted. Run this from a git checkout with git on PATH.`,
    };
  }
  if (!git.ignored) {
    return {
      ok: false,
      reason: `${file} is untracked but not gitignored, so one git add -A would commit the codes and the names. They belong in ${DEFAULT_FILE}.`,
    };
  }
  return OK;
}

/** A code in the file that the store has never heard of is a typo, not a board. */
export function guardKnownCodes(entries: SeedEntry[], known: Set<string>, yes: boolean): Guard {
  if (yes) return OK;
  const strays = entries.filter((entry) => entry.code !== "" && !known.has(entry.code));
  if (strays.length === 0) return OK;
  return {
    ok: false,
    reason: `${strays.map((entry) => entry.code).join(", ")} is not in the boards set. A typo here would mint a fifth board. Pass --yes if the code is right.`,
  };
}

/** What the store already holds, reduced to the three fields a refusal prints. */
export type ExistingBoard = { n: number; code: string; name: string };

/**
 * An empty code mints a board, so the number it claims has to be free in the
 * store. `validateSeedFile` only keeps `n` unique inside one file, so a lost
 * `boards.local.json` rebuilt from the example passes every other guard and
 * mints a second board on all four numbers, which the panel then renders twice.
 *
 * No separate count is needed: `n` is already 1 to `BOARD_COUNT`, so a fifth
 * board cannot appear without repeating a number the store holds.
 */
export function guardNewBoards(
  entries: SeedEntry[],
  existing: ExistingBoard[],
  opts: { file: string; production: boolean; yes: boolean },
): Guard {
  const byNumber = new Map<number, ExistingBoard[]>();
  for (const board of existing) {
    byNumber.set(board.n, [...(byNumber.get(board.n) ?? []), board]);
  }

  const clashes = entries.filter((entry) => entry.code === "" && byNumber.has(entry.n));
  if (clashes.length === 0) return OK;

  // A duplicate number cannot be taken back: `--rm` never runs against
  // production, so there a --yes is not offered at all.
  if (!opts.production && opts.yes) return OK;

  const numbers = [...new Set(clashes.map((entry) => entry.n))].sort((a, b) => a - b);
  const rows = numbers
    .flatMap((n) => byNumber.get(n) ?? [])
    .map((board) => `  ${board.n} · ${board.code} · ${board.name}`)
    .join("\n");
  const one = numbers.length === 1;
  const head = one
    ? `Board ${numbers[0]} is already in the boards set:`
    : `Boards ${numbers.join(", ")} are already in the boards set:`;
  const paste = one
    ? `Paste that code back into ${opts.file}`
    : `Paste those codes back into ${opts.file}`;
  const tail = opts.production
    ? `${paste}. An empty code mints a second board on the same number, and there is no way back: --rm never runs against production.`
    : `${paste}, or pass --yes to mint a second board on that number anyway.`;

  return { ok: false, reason: `${head}\n${rows}\n${tail}` };
}

export function isTracked(file: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * `git check-ignore` exits 0 for an ignored path and 1 for one git would happily
 * commit. Exit 128 is git declining the question, because the path is outside
 * this worktree or there is no worktree at all. A path that no commit from here
 * can carry is not the same as a path git is not ignoring, so that counts as
 * ignored. Anything else (no git on the box, a signal) leaves the answer
 * unknown, and an unknown answer refuses.
 */
/**
 * `true` ignored, `false` not ignored, `null` when git could not answer.
 *
 * Exit 128 is git refusing the question because the path is outside this
 * worktree, so this repository's index cannot stage it and minting there is
 * allowed. Anything else — no git on PATH, not a checkout, a broken repo — is
 * unknown rather than safe, and the caller refuses on it with its own message
 * rather than telling the operator their file is not gitignored.
 */
export function isIgnored(file: string): boolean | null {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", file], { stdio: "ignore" });
    return true;
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    if (status === 0 || status === 1) return status === 0;
    if (status === 128) return true;
    return null;
  }
}

// ── The run ─────────────────────────────────────────────────────────────────

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

async function main(argv: string[]): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const guard = guardVerb(args);
  if (!guard.ok) fail(guard.reason);

  // Decided by the flag alone, and set before anything reads it.
  process.env.VERCEL_ENV = args.production ? "production" : "development";

  const { getRedis, prefixFor } = await import("../src/lib/store");
  const boards = await import("../src/lib/boards");
  const prefix = prefixFor(process.env.VERCEL_ENV);

  if (args.verb === "ls") {
    const redis = getRedis();
    const codes = (await redis.smembers(boards.boardsKey())).map(String).sort();
    if (codes.length === 0) {
      process.stdout.write(`No boards in ${prefix}\n`);
      return;
    }
    const rows = await Promise.all(codes.map((code) => boards.readBoard(code)));
    for (const row of rows) {
      if (!row) continue;
      const { count, lastAt } = boards.summarise(row.solved);
      process.stdout.write(
        `${row.n} · ${row.code} · ${row.name} · ${count} solved · ${boards.relativeTime(lastAt)}\n`,
      );
    }
    return;
  }

  if (args.verb === "reset") {
    const redis = getRedis();
    const code = boards.normalizeCode(args.codes[0]);
    if (!boards.isValidCode(code)) fail(`${args.codes[0]} is not a board code.`);
    await redis.del(boards.solvedKey(code));
    process.stdout.write(`Cleared the solves on ${code} in ${prefix}\n`);
    return;
  }

  if (args.verb === "rm") {
    const redis = getRedis();
    const code = boards.normalizeCode(args.codes[0]);
    if (!boards.isValidCode(code)) fail(`${args.codes[0]} is not a board code.`);
    await redis
      .pipeline()
      .del(boards.boardKey(code))
      .del(boards.solvedKey(code))
      .srem(boards.boardsKey(), code)
      .exec();
    process.stdout.write(`Removed ${code} from ${prefix}\n`);
    return;
  }

  // seed
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(args.file, "utf8"));
  } catch (error) {
    fail(`Could not read ${args.file}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const parsed = validateSeedFile(raw, { isCode: boards.isValidCode });
  if (!parsed.ok) fail(`${args.file} is not a seed file:\n  ${parsed.problems.join("\n  ")}`);

  // A file git could commit can never take a code back, so that refusal comes
  // before the store is even opened.
  const mints = parsed.entries.some((entry) => entry.code === "");
  if (mints) {
    const writeGuard = guardCodeWrite(args.file, {
      tracked: isTracked(args.file),
      ignored: isIgnored(args.file),
    });
    if (!writeGuard.ok) fail(writeGuard.reason);
  }

  // The client is built only once the file is known good, so a missing seed
  // file reports itself rather than a missing environment variable.
  const redis = getRedis();
  const known = new Set((await redis.smembers(boards.boardsKey())).map(String));
  const knownGuard = guardKnownCodes(parsed.entries, known, args.yes);
  if (!knownGuard.ok) fail(knownGuard.reason);

  // Only when something would be minted, so an ordinary re-seed of four known
  // codes still costs one SMEMBERS and nothing more.
  if (mints) {
    const existing: ExistingBoard[] = [];
    for (const row of await Promise.all([...known].sort().map((code) => boards.readBoard(code)))) {
      if (row) existing.push({ n: row.n, code: row.code, name: row.name });
    }
    const newGuard = guardNewBoards(parsed.entries, existing, {
      file: args.file,
      production: args.production,
      yes: args.yes,
    });
    if (!newGuard.ok) fail(newGuard.reason);
  }

  const minted: SeedEntry[] = [];
  const taken = new Set(known);
  for (const entry of parsed.entries) {
    if (entry.code !== "") {
      taken.add(entry.code);
      continue;
    }
    let code = boards.generateCode();
    while (taken.has(code)) code = boards.generateCode();
    taken.add(code);
    entry.code = code;
    minted.push(entry);
  }

  if (minted.length > 0) {
    // The file is written before the store, so a code can never be live and unrecorded.
    writeFileSync(args.file, `${JSON.stringify(parsed.entries, null, 2)}\n`, "utf8");
  }

  const now = new Date().toISOString();
  const pipeline = redis.pipeline();
  for (const entry of parsed.entries) {
    pipeline.hset(boards.boardKey(entry.code), {
      n: String(entry.n),
      name: entry.name,
      dedication: entry.dedication,
    });
    pipeline.hsetnx(boards.boardKey(entry.code), "createdAt", now);
    pipeline.sadd(boards.boardsKey(), entry.code);
  }
  await pipeline.exec();

  for (const entry of parsed.entries) {
    process.stdout.write(
      `${entry.n} · ${entry.code}${minted.includes(entry) ? " · new" : ""}\n`,
    );
  }
  process.stdout.write(`Seeded ${parsed.entries.length} of ${BOARD_COUNT} into ${prefix}\n`);
}

/** Only when run as a script: importing this file for its helpers runs nothing. */
if (/seed-boards\.(ts|mts|js|mjs)$/.test(process.argv[1] ?? "")) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
