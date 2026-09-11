"use client";

import Link from "next/link";
import { useEffect } from "react";

import { getBoard, setBoard } from "@/lib/local";
import { CONTROL } from "@/lib/ui";

import { useMirror } from "./useMirror";

/**
 * First visit to a board writes `tp.board`. A later visit to a different board
 * offers the swap rather than taking it: the phone in your hand may be someone
 * else's, and overwriting would move their progress with it.
 */
export default function BoardClaim({
  code,
  n,
  name,
}: {
  code: string;
  n: number;
  name: string;
}) {
  const version = useMirror();

  useEffect(() => {
    if (version === 0) return;
    if (getBoard() === null) setBoard({ code, n, name });
  }, [version, code, n, name]);

  const mine = version === 0 ? null : getBoard();
  if (!mine || mine.code === code) return null;

  // Two controls sharing a line with running text: the link takes `CONTROL` as
  // the button already had, so both clear the 44 px floor, and the paragraph
  // becomes a wrapping flex row so a pair of 44 px targets cannot sit on top of
  // the sentence they belong to.
  //
  // It renders on the page ground under the leaf rather than on the paper. The
  // question is about the phone rather than about the board, and the foot of
  // the leaf is where the hand-drawn number lives, which is the one part of it
  // a block of text cannot have.
  return (
    <p
      data-board-claim=""
      className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tracking-[-0.002em] text-muted"
    >
      This is {name}&apos;s board. Yours is{" "}
      <Link href={`/b/${mine.code}`} className={CONTROL}>
        {mine.name}&apos;s →
      </Link>{" "}
      <button type="button" className={CONTROL} onClick={() => setBoard({ code, n, name })}>
        Make this my board
      </button>
    </p>
  );
}
