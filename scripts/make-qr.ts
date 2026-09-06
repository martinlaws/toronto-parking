import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { toBuffer, toString } from "qrcode";

import { isValidCode } from "../src/lib/code";
import { SITE_URL } from "../src/lib/site";
import { DEFAULT_FILE, validateSeedFile } from "./seed-boards";

/**
 * Four QR codes, generated here rather than by a hosted service, so no third
 * party ever sees the URLs. `H` error correction and a 4-module quiet zone put
 * the 30-byte payload at version 4: 33 modules, 41 with the zone, about 49 mm
 * at 1.2 mm per module.
 *
 * `out/` is gitignored and meant to be deleted once the cards are printed.
 */

const OUT_DIR = "out/qr";
const PNG_WIDTH = 1024;

type Options = { file: string; out: string };

export function parseQrArgs(argv: string[]): Options {
  const options: Options = { file: DEFAULT_FILE, out: OUT_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--file") options.file = argv[++i] ?? DEFAULT_FILE;
    else if (token.startsWith("--file=")) options.file = token.slice("--file=".length);
    else if (token === "--out") options.out = argv[++i] ?? OUT_DIR;
    else if (token.startsWith("--out=")) options.out = token.slice("--out=".length);
    else throw new Error(`Unknown argument ${token}`);
  }
  return options;
}

export function boardUrl(code: string): string {
  return `${SITE_URL}/b/${code}`;
}

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

async function main(argv: string[]): Promise<void> {
  let options: Options;
  try {
    options = parseQrArgs(argv);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(options.file, "utf8"));
  } catch (error) {
    fail(
      `Could not read ${options.file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = validateSeedFile(raw, { isCode: isValidCode });
  if (!parsed.ok) fail(`${options.file} is not a seed file:\n  ${parsed.problems.join("\n  ")}`);

  const ready = parsed.entries.filter((entry) => entry.code !== "");
  if (ready.length === 0) fail(`No codes in ${options.file}. Run pnpm boards:seed first.`);

  mkdirSync(options.out, { recursive: true });

  for (const entry of ready) {
    const url = boardUrl(entry.code);
    const svg = await toString(url, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
    });
    const png = await toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: PNG_WIDTH,
    });

    const svgPath = join(options.out, `${entry.code}.svg`);
    const pngPath = join(options.out, `${entry.code}.png`);
    writeFileSync(svgPath, svg, "utf8");
    writeFileSync(pngPath, png);
    process.stdout.write(`✓ ${svgPath} · ${pngPath}\n`);
  }

  process.stdout.write(
    `${ready.length} codes written. Delete ${options.out} once the cards are printed.\n`,
  );
}

if (/make-qr\.(ts|mts|js|mjs)$/.test(process.argv[1] ?? "")) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
