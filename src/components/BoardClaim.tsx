"use client";

import Link from "next/link";
import { useEffect } from "react";

import { getBoard, setBoard } from "@/lib/local";

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

  return (
    <p data-board-claim="">
      This is {name}&apos;s board. Yours is{" "}
      <Link href={`/b/${mine.code}`}>{mine.name}&apos;s →</Link>{" "}
      <button type="button" onClick={() => setBoard({ code, n, name })}>
        Make this my board
      </button>
    </p>
  );
}
