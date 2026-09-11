"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { parseMoves } from "@/lib/code";
import {
  entryMoves,
  getBoard,
  getSolved,
  isSolved,
  recordMoves,
  toggleSolve,
} from "@/lib/local";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * True when the note under the toggle applies: a solve this phone is holding
 * with no board to carry it to. Exported because the mirror tests can drive it
 * against a fake `localStorage`, which the component itself has no renderer for.
 */
export function savedOnThisPhone(card: number): boolean {
  return getBoard() === null && isSolved(null, card);
}

/**
 * The meta block's key label, and the one class string that leaves this file.
 * `CardHeader` sets `Tier` and `Par` in it and `CardResult` below sets `Yours`;
 * the three are one column of keys down the side of the opener, and a column
 * whose third key is a point off the other two stops reading as a column.
 */
export const META_KEY =
  "shrink-0 font-mono text-[9.5px] leading-none tracking-[0.18em] text-muted uppercase";

/**
 * How a result reads against par, written down once.
 *
 * `E` for even is the scorecard's own word and wants no gloss; over par is the
 * signed difference. Under par is drawn with a real minus rather than a hyphen,
 * and it is drawn at all: par is the solver's shortest line, so in practice
 * nobody is under it — but a formatter that renders a negative as a bare figure
 * the one time the deck is wrong is worse than the branch that prevents it.
 * There is no word here for beating par on purpose; the site does not otherwise
 * talk in golf.
 */
function againstPar(moves: number, par: number): string {
  const difference = moves - par;
  if (difference === 0) return "E";
  return difference > 0 ? `+${difference}` : `−${-difference}`;
}

/**
 * The ruled blank, the same mark an unplayed entry carries on the deck: a form
 * waiting to be filled in, rather than a figure that failed to arrive. It
 * stands in a box the height of a figure so a cell is the same height whether
 * or not it holds one, and the rule sits where the figure's baseline would.
 */
function Blank() {
  return (
    <span className="flex h-[34px] items-end">
      <i className="mb-2 block h-[1.5px] w-[26px] rounded-[1px] bg-blank" />
    </span>
  );
}

/**
 * The third row of the opener's meta block: what this card actually took you.
 *
 * It is here rather than in `CardHeader` because it is mirror state, and here
 * rather than in a file of its own because it and the score cells below render
 * the same two numbers through `againstPar`. Two copies of that rule in two
 * files is how an `E` and a `+3` drift apart.
 *
 * Nothing renders until the card has both a tick and a count. A `Yours` row
 * standing empty under `Par 25` would be a result.
 */
export function CardResult({ card, par }: { card: number; par: number }) {
  const version = useMirror();
  if (version === 0) return null;

  const code = getBoard()?.code ?? null;
  const moves = entryMoves(getSolved(code)[String(card)]);
  if (moves === null) return null;

  return (
    <div className="mt-1.5 flex items-baseline gap-[7px] border-t border-t-rule pt-1.5 [--tp-leader-drop:4px]">
      <span className={META_KEY}>Yours</span>
      <i className="tp-leader" aria-hidden="true" />
      <span className="text-[17px] leading-none font-bold tracking-[-0.015em] text-accent tabular-nums lining-nums">
        {moves}
      </span>
      <span className="font-mono text-[11px] leading-none text-muted tabular-nums">
        {againstPar(moves, par)}
      </span>
    </div>
  );
}

/**
 * One cell of the score row. The head comes in whole because the middle cell's
 * is a real `<label>` for the field under it and the other two are not.
 *
 * The value goes in at its own height rather than in a box of a fixed one. The
 * field is taller than a figure by its own underline and the space over it, and
 * a cell that centres its own stack shares that difference between the label
 * and the figure instead of dropping all of it on one side.
 */
function Cell({
  head,
  className,
  children,
}: {
  head: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "flex min-h-[92px] flex-1 flex-col items-center justify-center gap-[9px] px-1 pt-4 pb-[17px] text-center";
  return (
    <div className={className ? `${base} ${className}` : base}>
      {head}
      {children}
    </div>
  );
}

const SCORE_KEY = "font-mono text-[9.5px] leading-none tracking-[0.17em] uppercase";
const FIGURE = "text-[34px] leading-none font-bold tracking-[-0.025em] tabular-nums lining-nums";

/**
 * The tick, and under it the scorecard: par, the number it took you, and the
 * difference between them.
 *
 * The row is on the page whether or not the card is solved. Revealing it on the
 * tap would move everything below it at the moment of the tap, and the blanks
 * are an honest empty state rather than a gap — a rule under `Your moves` says
 * a number belongs here as plainly as the same rule says it on the deck.
 *
 * Nothing here guards re-entry. A tap that lands while the previous write is
 * still open is a tap the reader meant: it repaints at once, and `sendPending`
 * serialises the two writes for the card so the store keeps the later one.
 * Disabling the control would be the wrong answer anyway, because disabling a
 * focused control blurs focus to `<body>` and nothing is waiting on the round
 * trip for a disabled state to say.
 */
export default function SolveToggle({ card, par }: { card: number; par: number }) {
  const version = useMirror();

  const code = version === 0 ? null : (getBoard()?.code ?? null);
  const solved = version === 0 ? false : isSolved(code, card);
  const stored = version === 0 ? null : entryMoves(getSolved(code)[String(card)]);
  const note = version !== 0 && savedOnThisPhone(card);

  // Null means "show whatever the mirror holds". A keystroke is not a write: a
  // count typed one digit at a time would queue a network write per digit and
  // record a 2 on the way to 28, so the field keeps its own text and `commit`
  // is the only thing that records.
  const [draft, setDraft] = useState<string | null>(null);

  // The toggle is the one control on the card page, so the replay runs here too.
  useSync(code);

  async function onToggle() {
    setDraft(null);
    await toggleSolve(code, card, !solved);
  }

  async function commit() {
    if (draft === null) return;
    const moves = parseMoves(draft);
    setDraft(null);
    // An emptied or unreadable field records nothing and leaves the stored count
    // where it is. "Absent means leave alone" is what makes the write idempotent
    // and safe to replay, and taking a count away is a verb the store does not
    // have — a `0` standing in for one would rot.
    if (moves !== null && moves !== stored) await recordMoves(code, card, moves);
  }

  const field = `moves-${card}`;

  return (
    <div data-solve-toggle="">
      {/* A real checkbox, clipped rather than removed so it still takes focus
          and still answers the space bar, with its box drawn beside it: the
          stylesheet turns `appearance` off site-wide and the native tick goes
          with it. The mark is `currentColor` inside that box, so the single
          `peer-checked` hop that fills the box colours the tick too —
          `peer-checked` reaches siblings and never their children. */}
      <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-[14px]">
        <input type="checkbox" checked={solved} onChange={onToggle} className="peer sr-only" />
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-ink text-transparent peer-checked:border-accent peer-checked:bg-accent peer-checked:text-ground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        </span>
        <span className="text-[15px] tracking-[-0.004em] text-ink-edge">
          Card {card} is solved
        </span>
      </label>

      <p className="mt-[5px] max-w-[28em] font-serif text-[13.5px] leading-[1.5] text-pretty text-muted [font-variation-settings:'opsz'_13]">
        Ticking a card keeps your place. With a board code it travels to the other three.
      </p>

      {note ? (
        <p className="mt-2 max-w-[28em] font-serif text-[13.5px] leading-[1.5] text-pretty text-muted [font-variation-settings:'opsz'_13]">
          Saved on this phone. Enter your board&apos;s code and it comes with you.
        </p>
      ) : null}

      {/* The same ruled table as the controls under the board, and meant to
          rhyme with it: 1.5px of ink over the head, a hairline between the
          cells, the lighter rule closing the foot. */}
      <div className="mt-[18px] flex border-t-[1.5px] border-t-ink border-b border-b-rule-strong">
        <Cell head={<span className={`${SCORE_KEY} text-muted`}>Par</span>}>
          <span className={`${FIGURE} text-ink`}>{par}</span>
        </Cell>

        <Cell
          className={solved ? "border-l border-l-rule bg-accent-pale" : "border-l border-l-rule"}
          // A real `<label>` only while there is a field for it to point at.
          // Unsolved, the cell is a blank with a caption over it and a `for`
          // naming an element that is not on the page.
          head={
            solved ? (
              <label htmlFor={field} className={`${SCORE_KEY} text-accent`}>
                Your moves
              </label>
            ) : (
              <span className={`${SCORE_KEY} text-muted`}>Your moves</span>
            )
          }
        >
          {solved ? (
            <input
              id={field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft ?? (stored === null ? "" : String(stored))}
              // Three digits is `MAX_MOVES`, and holding the field to digits
              // leaves `parseMoves` only a zero or an empty box to reject.
              onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              // iOS zooms the whole page when a field under 16px takes focus,
              // which is why `FIELD` in `ui.ts` carries `text-base`. Here the
              // design's own figure is 34px and clears it several times over —
              // but the floor is the reason, so nothing shrinks this past 16px.
              className={`${FIGURE} w-20 border-b-[2.5px] border-b-accent pb-[9px] text-center text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
            />
          ) : (
            <Blank />
          )}
        </Cell>

        <Cell
          className="border-l border-l-rule"
          head={<span className={`${SCORE_KEY} text-muted`}>Against par</span>}
        >
          {solved && stored !== null ? (
            <span className={`${FIGURE} text-ink-edge`}>{againstPar(stored, par)}</span>
          ) : (
            <Blank />
          )}
        </Cell>
      </div>

      <p className="mt-2.5 max-w-[28em] font-serif text-[13.5px] leading-[1.5] text-pretty text-muted [font-variation-settings:'opsz'_13]">
        {solved ? (
          <>
            Type the number of moves it took. It shows{" "}
            <b className="font-sans text-[12px] font-bold text-ink">E</b> when you match par.
          </>
        ) : (
          "Mark it solved to record your moves."
        )}
      </p>
    </div>
  );
}
