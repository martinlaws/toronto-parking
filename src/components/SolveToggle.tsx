"use client";

import { getBoard, isSolved, toggleSolve } from "@/lib/local";
import { CONTROL, CONTROL_ON } from "@/lib/ui";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * The one toggle: `Mark solved` → `Solved`. The mirror is painted before the
 * network is asked, so the label flips on the tap and not on the round trip.
 *
 * Nothing here guards re-entry. A tap that lands while the previous write is
 * still open is a tap the reader meant: it repaints at once, and `sendPending`
 * serialises the two writes for the card so the store keeps the later one.
 * Disabling the button would be the wrong answer anyway, because disabling a
 * focused control blurs focus to `<body>` and nothing is waiting on the round
 * trip for a disabled state to say.
 */
export default function SolveToggle({ card, par }: { card: number; par?: number }) {
  const version = useMirror();

  const code = version === 0 ? null : (getBoard()?.code ?? null);
  const solved = version === 0 ? false : isSolved(code, card);
  const claimed = version === 0 ? true : getBoard() !== null;

  // The toggle is the one control on the card page, so the replay runs here too.
  useSync(code);

  async function onToggle() {
    await toggleSolve(code, card, !solved);
  }

  return (
    <div data-solve-toggle="" className="space-y-3">
      <button
        type="button"
        aria-pressed={solved}
        onClick={onToggle}
        className={solved ? CONTROL_ON : CONTROL}
      >
        {solved ? "Solved" : "Mark solved"}
      </button>
      {solved && par !== undefined ? <p>Solved. Par was {par}.</p> : null}
      {!claimed ? <p>Saved on this phone. Enter your board&apos;s code and it comes with you.</p> : null}
    </div>
  );
}
