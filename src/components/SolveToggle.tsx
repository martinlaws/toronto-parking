"use client";

import { useState } from "react";

import { getBoard, isSolved, toggleSolve } from "@/lib/local";

import { useMirror } from "./useMirror";
import { useSync } from "./useSync";

/**
 * The one toggle: `Mark solved` → `Solved`. The mirror is painted before the
 * network is asked, so the label flips on the tap and not on the round trip.
 */
export default function SolveToggle({ card, par }: { card: number; par?: number }) {
  const version = useMirror();
  const [busy, setBusy] = useState(false);

  const code = version === 0 ? null : (getBoard()?.code ?? null);
  const solved = version === 0 ? false : isSolved(code, card);
  const claimed = version === 0 ? true : getBoard() !== null;

  // The toggle is the one control on the card page, so the replay runs here too.
  useSync(code);

  async function onToggle() {
    setBusy(true);
    try {
      await toggleSolve(code, card, !solved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-solve-toggle="">
      <button type="button" aria-pressed={solved} disabled={busy} onClick={onToggle}>
        {solved ? "Solved" : "Mark solved"}
      </button>
      {solved && par !== undefined ? <p>Solved. Par was {par}.</p> : null}
      {!claimed ? <p>Saved on this phone. Enter your board&apos;s code and it comes with you.</p> : null}
    </div>
  );
}
