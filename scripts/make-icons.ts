/**
 * Every icon the site ships, rasterised from `assets/icon.svg` with sharp.
 *
 * `pnpm icons:build`. The outputs are committed: they change only when the
 * cabriolet does, and a build should never depend on a rasteriser running.
 *
 * The maskable 512 is the source scaled to 80% on a full-bleed ground, so a
 * launcher can crop it to a circle, a squircle or a rounded square and still
 * show the whole car.
 */
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { GROUND } from "../src/lib/theme";

const root = process.cwd();
const source = path.join(root, "assets", "icon.svg");

type Target = { out: string; size: number; maskable?: boolean };

const TARGETS: Target[] = [
  { out: "public/icons/icon-192.png", size: 192 },
  { out: "public/icons/icon-512.png", size: 512 },
  { out: "public/icons/icon-512-maskable.png", size: 512, maskable: true },
  { out: "src/app/apple-icon.png", size: 180 },
];

function background() {
  const hex = GROUND.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    alpha: 1,
  };
}

async function main() {
  for (const target of TARGETS) {
    const file = path.join(root, target.out);
    await mkdir(path.dirname(file), { recursive: true });
    const inner = target.maskable ? Math.round(target.size * 0.8) : target.size;
    const art = await sharp(source, { density: 512 })
      .resize(inner, inner, { fit: "contain", background: background() })
      .png()
      .toBuffer();
    const png = target.maskable
      ? await sharp({
          create: {
            width: target.size,
            height: target.size,
            channels: 4,
            background: background(),
          },
        })
          .composite([{ input: art, top: (target.size - inner) / 2, left: (target.size - inner) / 2 }])
          .png()
          .toBuffer()
      : art;
    await writeFile(file, png);
    console.log(`${target.out}  ${target.size}px${target.maskable ? " maskable" : ""}`);
  }

  // The SVG favicon is the source itself, so the two can never drift.
  await copyFile(source, path.join(root, "src", "app", "icon.svg"));
  console.log("src/app/icon.svg  copied from assets/icon.svg");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
