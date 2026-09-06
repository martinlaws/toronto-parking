"use client";

import { getBoard, isSolved } from "@/lib/local";

import { useMirror } from "./useMirror";

/** The filled chip in the card header. Nothing until the card is solved. */
export default function SolvedChip({ card }: { card: number }) {
  const version = useMirror();
  if (version === 0) return null;

  const code = getBoard()?.code ?? null;
  if (!isSolved(code, card)) return null;

  return (
    <span data-solved="true" data-chip="solved">
      Solved
    </span>
  );
}
