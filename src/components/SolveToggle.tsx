"use client";

import { useRef } from "react";

import { getBoard, isSolved, toggleSolve } from "@/lib/local";
import { CONTROL, CONTROL_ON } from "@/lib/ui";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * The one toggle: `Mark solved` → `Solved`. The mirror is painted before the
 * network is asked, so the label flips on the tap and not on the round trip.
 *
 * Re-entry is guarded by a ref rather than by `disabled`: disabling a focused
 * button blurs focus to `<body>`, and the fetch behind the tap carries no
 * timeout, so a keyboard reader could be left there for as long as the request
 * hangs. Nothing is waiting on the round trip anyway — the label has already
 * flipped — so there is nothing for a disabled state to say.
 */
export default function SolveToggle({ card, par }: { card: number; par?: number }) {
  const version = useMirror();
  const busy = useRef(false);

  const code = version === 0 ? null : (getBoard()?.code ?? null);
  const solved = version === 0 ? false : isSolved(code, card);
  const claimed = version === 0 ? true : getBoard() !== null;

  // The toggle is the one control on the card page, so the replay runs here too.
  useSync(code);

  async function onToggle() {
    if (busy.current) return;
    busy.current = true;
    try {
      await toggleSolve(code, card, !solved);
    } finally {
      busy.current = false;
    }
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
