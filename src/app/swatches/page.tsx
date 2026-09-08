"use client";

import { useState } from "react";

import { CONTROL } from "@/lib/ui";

/**
 * Throwaway. Issue 1: the seven print-derived tokens are picked by holding a
 * printed piece against the phone, in daylight and again under a lamp.
 *
 * Candidate 1 in every row is what `main` ships as of 2026-09-08. Asphalt,
 * frame, glow, blue and hero are decided; yellow and green are provisional
 * and the only rows still to check.
 *
 * This branch exists only to put candidate hexes in front of a real screen; it
 * is never merged. Once the values land in `globals.css` on `main`, delete the
 * branch and this page with it.
 *
 * Ground and ink are not here: they are page colours, chosen against paper
 * rather than against plastic.
 */
type Swatch = { token: string; note: string; body: string[]; edge: string[] };

const SWATCHES: Swatch[] = [
  {
    token: "--color-asphalt",
    note: "The board. The only dark object on the page.",
    body: ["#1e1c1a", "#121212", "#0d0d0d", "#181818"],
    edge: ["#3a3734", "#2a2a2a", "#232323", "#333331"],
  },
  {
    token: "--color-frame",
    note: "The white frame around the asphalt.",
    body: ["#f4f1ec", "#faf8f4", "#eee9e1", "#e6e0d6"],
    edge: ["#d9d3c9", "#e4ded4", "#cfc7ba", "#c4bbac"],
  },
  {
    token: "--color-glow",
    note: "Glow-green markings. Fails contrast as text on white, so it is only ever a fill behind dark text.",
    body: ["#84eaac", "#4fd07f", "#6fe39b", "#5ddb8c"],
    edge: ["#bdf7d5", "#7ee5a8", "#a8f2c6", "#93edb8"],
  },
  {
    token: "--color-car-blue",
    note: "Sky blue. Translucent navy goes black on black, so this stays light.",
    body: ["#63b6f0", "#2f8fd4", "#4fa8e8", "#3f9ade"],
    edge: ["#a9dbf9", "#6bb8ec", "#93cef5", "#7fc3f0"],
  },
  {
    token: "--color-car-yellow",
    note: "Warm saffron. The pylons use this too, so it has to read as a cone at 56px.",
    body: ["#f6c04a", "#dd9e12", "#f0b429", "#e8a91c"],
    edge: ["#fbe19a", "#f2c552", "#f8d77a", "#f5cd63"],
  },
  {
    token: "--color-car-green",
    note: "Fresh lime. Must stay apart from blue with colour removed.",
    body: ["#8fd960", "#66bf33", "#7fd14a", "#72c93c"],
    edge: ["#c3ef9f", "#96da69", "#b4e88b", "#a5e178"],
  },
  {
    token: "--color-hero",
    note: "Coral-leaning red. The cabriolet.",
    body: ["#f76a55", "#dc4029", "#f2543d", "#e84a33"],
    edge: ["#ffb0a0", "#f7796a", "#ff9c88", "#fb8a74"],
  },
];

export default function SwatchesPage() {
  const [picked, setPicked] = useState<number[]>(() => SWATCHES.map(() => 0));

  function cycle(row: number) {
    setPicked((prev) =>
      prev.map((i, r) => (r === row ? (i + 1) % SWATCHES[row].body.length : i)),
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Swatches</h1>
      <p className="mt-3 text-ink/70">
        Hold a printed piece against each block, in daylight and again under a lamp. Tap a block to
        cycle its candidates. Translucent prints read one to two steps paler than a screen swatch,
        so trust the plastic. When a row is right, copy its two hexes into the token block in
        globals.css on main.
      </p>

      <div className="mt-8 space-y-6">
        {SWATCHES.map((s, row) => {
          const body = s.body[picked[row]];
          const edge = s.edge[picked[row]];
          return (
            <section key={s.token} aria-labelledby={`t-${row}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`t-${row}`} className="font-mono text-sm font-medium">
                  {s.token}
                </h2>
                <span className="text-xs text-ink/60">
                  {picked[row] + 1} of {s.body.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/65">{s.note}</p>
              <button
                type="button"
                onClick={() => cycle(row)}
                className="mt-2 flex w-full overflow-hidden rounded-xl border border-ink/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                aria-label={`Cycle ${s.token}, showing body ${body} and edge ${edge}`}
              >
                <span
                  className="flex min-h-24 flex-1 items-end p-3 font-mono text-xs"
                  style={{ background: body, color: "#121212" }}
                >
                  {body}
                </span>
                <span
                  className="flex min-h-24 flex-1 items-end p-3 font-mono text-xs"
                  style={{ background: edge, color: "#121212" }}
                >
                  {edge} edge
                </span>
              </button>
              <div
                className="mt-2 flex items-center gap-3 rounded-xl p-3"
                style={{ background: "#121212" }}
              >
                <span className="text-xs text-white/60">on asphalt</span>
                <span
                  className="h-8 w-20 rounded-lg"
                  style={{ background: body, opacity: 0.86, border: `3px solid ${edge}` }}
                />
              </div>
            </section>
          );
        })}
      </div>

      <button type="button" className={`${CONTROL} mt-10`} onClick={() => setPicked(SWATCHES.map(() => 0))}>
        Back to the committed values
      </button>
    </main>
  );
}
