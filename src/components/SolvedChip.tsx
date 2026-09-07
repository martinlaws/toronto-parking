"use client";

import { getBoard, isSolved } from "@/lib/local";
import { CHIP } from "@/lib/ui";

import { useMirror } from "./useMirror";

/**
 * The chip itself, with no mirror behind it. Split out because the wrapper
 * renders nothing until an effect has run, so a test without a DOM would only
 * ever see the null.
 */
export function Chip() {
  return (
    <span data-solved="true" data-chip="solved" className={CHIP}>
      Solved
    </span>
  );
}

/** The filled chip in the card header. Nothing until the card is solved. */
export default function SolvedChip({ card }: { card: number }) {
  const version = useMirror();
  if (version === 0) return null;

  const code = getBoard()?.code ?? null;
  if (!isSolved(code, card)) return null;

  return <Chip />;
}
