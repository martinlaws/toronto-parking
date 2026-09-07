"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeCode } from "@/lib/code";
import { getBoard } from "@/lib/local";
import { CONTROL, FIELD } from "@/lib/ui";

import { useMirror } from "./useMirror";

/**
 * The root's code field, or the remembered board as a chip. The root never
 * redirects: a household member who wants the anonymous deck can still have it.
 * A code that is not one of the four is answered on the board page, so there is
 * one notice in one place rather than two that can drift apart.
 */
export default function RootBoardBar() {
  const version = useMirror();
  const router = useRouter();
  const [typed, setTyped] = useState("");

  const board = version === 0 ? null : getBoard();

  // `CONTROL` rather than a bare link: the spec calls this a chip and a thumb
  // has to hit it, so it takes the 44 px floor and the focus ring every other
  // control here carries. The `<p>` stays: `inline-flex` already keeps the chip
  // from stretching across it.
  if (board) {
    return (
      <p data-board-bar="remembered">
        <Link href={`/b/${board.code}`} className={CONTROL}>
          Continue on {board.name}&apos;s board →
        </Link>
      </p>
    );
  }

  return (
    <form
      data-board-bar="empty"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const code = normalizeCode(typed);
        if (code === "") return;
        router.push(`/b/${code}`);
      }}
    >
      <label htmlFor="board-code">Have a board? Enter the code from the card in the box.</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="board-code"
          name="code"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={12}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="submit" className={`${CONTROL} shrink-0`}>
          Open
        </button>
      </div>
    </form>
  );
}
