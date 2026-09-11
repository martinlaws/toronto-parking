import { COLOUR_ORDER, type PieceColour } from "@/lib/board";
import type { Card, Counts } from "@/lib/types";

/**
 * What comes out of the box and what stays in it, as a bill rather than a
 * sentence.
 *
 * The counts are precomputed in `data/deck.json`, so the page still does no
 * arithmetic; what changed is that a reader standing over an open box is
 * counting pieces, and a list with the count in a column is countable where a
 * run of prose separated by dots is not. The chip in front of each row is the
 * piece itself at its own proportion — 15px for a car, 26px for a truck, 8px
 * square for a pylon — because the thing being picked up is a shape and a
 * colour before it is a word.
 */

/**
 * Trucks spell out yellow first, matching the two-yellow bias of the physical
 * box. The order belongs to `board.ts` — `TRUCK_CAP` is written in it and
 * `checklistParts` walks it — and is spelled again here because that module
 * does not export it. These rows and that sentence name the same pieces in the
 * same order, so if one of the two ever moves, move the other.
 */
const TRUCK_ORDER: readonly PieceColour[] = ["yellow", "blue", "green"];

/**
 * Class names and not colour values, for the reason `DeckGrid` gives at more
 * length: Tailwind emits a theme colour's custom property only where it can see
 * the token in use, so a `var(--color-car-blue)` handed in through `style`
 * compiles to a variable nobody wrote and a chip nobody can see.
 */
const CHIP_FILL: Record<PieceColour, string> = {
  blue: "bg-car-blue",
  yellow: "bg-car-yellow",
  green: "bg-car-green",
};

type Shape = "car" | "truck" | "pylon";

const CHIP_SHAPE: Record<Shape, string> = {
  car: "h-[9px] w-[15px] rounded-[2.5px]",
  truck: "h-[9px] w-[26px] rounded-[2.5px]",
  pylon: "size-2 rounded-[1.5px]",
};

type Row = {
  key: string;
  label: string;
  count: number;
  shape: Shape;
  fill: string;
  /** Pylons carry the footnote marker: they are the one piece that never moves. */
  note?: true;
};

function vehicle(colour: PieceColour, kind: "car" | "truck", count: number): Row {
  const name = colour[0].toUpperCase() + colour.slice(1);
  return {
    key: `${kind}-${colour}`,
    label: `${name} ${kind}${count === 1 ? "" : "s"}`,
    count,
    shape: kind,
    fill: CHIP_FILL[colour],
  };
}

/** Cars, trucks, pylons, hero last — the order the card page reads them in, and
 *  the order `checklistParts` spells them in. Zero counts are left out. */
function rowsOf(counts: Counts, withHero: boolean): Row[] {
  const rows: Row[] = [];
  for (const colour of COLOUR_ORDER) {
    if (counts.car[colour]) rows.push(vehicle(colour, "car", counts.car[colour]));
  }
  for (const colour of TRUCK_ORDER) {
    if (counts.truck[colour]) rows.push(vehicle(colour, "truck", counts.truck[colour]));
  }
  if (counts.pylon) {
    rows.push({
      key: "pylon",
      label: counts.pylon === 1 ? "Pylon" : "Pylons",
      count: counts.pylon,
      shape: "pylon",
      fill: CHIP_FILL.yellow,
      note: true,
    });
  }
  // The hero is excluded from `Counts` because there is always exactly one, and
  // it belongs on what you need and never on what stays behind.
  if (withHero) {
    rows.push({ key: "hero", label: "The red car", count: 1, shape: "car", fill: "bg-hero" });
  }
  return rows;
}

/**
 * One bill. `small` is the quieter half: the same rows a step down in size and
 * in grey, so the two lists read as a foreground and a background rather than
 * as two instructions.
 *
 * The chips sit in a 26px well so a 15px car and a 26px truck start at the same
 * left edge, and the dot leader carries the eye from a name to its count. Both
 * the well and the leader are hidden from the accessibility tree: the row reads
 * "Blue cars 3" without them.
 */
function Bill({ rows, small }: { rows: Row[]; small?: boolean }) {
  return (
    <ul className={small ? "mt-1" : "mt-1.5"}>
      {rows.map((row) => (
        <li
          key={row.key}
          className={`flex items-center [--tp-leader-drop:calc(50%-3px)] ${small ? "h-[27px]" : "h-8"}`}
        >
          <span className="mr-2.5 flex w-[26px] shrink-0 items-center" aria-hidden="true">
            <i
              className={`${CHIP_SHAPE[row.shape]} ${row.fill} shadow-[0_0_0_0.5px_rgb(19_23_20_/_0.18)]`}
            />
          </span>
          <span
            className={
              small
                ? "text-[13.5px] leading-none tracking-[-0.004em] text-muted"
                : "text-[14.5px] leading-none tracking-[-0.004em] text-ink-edge"
            }
          >
            {row.label}
            {row.note ? (
              <sup className="pl-px align-[0.4em] text-[9px]" aria-hidden="true">
                *
              </sup>
            ) : null}
          </span>
          <i className="tp-leader" aria-hidden="true" />
          <span
            className={
              small
                ? "w-[1.6ch] text-right text-[13px] leading-none font-[550] text-muted tabular-nums lining-nums"
                : "w-[1.6ch] text-right text-[15px] leading-none font-[650] text-ink tabular-nums lining-nums"
            }
          >
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Checklist({ card }: { card: Card }) {
  const needs = rowsOf(card.needs, true);
  const stays = rowsOf(card.staysInBox, false);

  return (
    <>
      <Bill rows={needs} />

      <p className="mt-[18px] font-mono text-[9.5px] leading-none tracking-[0.2em] text-muted uppercase">
        Stays in the box
      </p>
      {stays.length ? (
        <Bill rows={stays} small />
      ) : (
        <p className="mt-1 text-[13.5px] leading-none text-muted">Nothing.</p>
      )}

      {/* A real footnote, because the sentence is about one row and not about
          the list: the two pylons are the only pieces that are set down and
          left alone, and saying so under everything read as a rule for all of
          it. The marker is decoration — the note follows the list closely
          enough to be read in place. */}
      <div className="mt-3.5">
        <div className="h-px w-16 bg-rule-strong" />
        <p className="mt-2 font-serif text-[13px] text-muted [font-variation-settings:'opsz'_13]">
          <sup className="pr-1 align-[0.35em] text-[9px]" aria-hidden="true">
            *
          </sup>
          Pylons don&apos;t move.
        </p>
      </div>
    </>
  );
}
