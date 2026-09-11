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
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const code = normalizeCode(typed);
        if (code === "") return;
        router.push(`/b/${code}`);
      }}
    >
      <label htmlFor="board-code" className="text-[13.5px]/[1.45] tracking-[-0.002em]">
        Have a board? Enter the code from the card in the box.
      </label>
      {/* `items-stretch`, so the field's rule and Open's rule land on the same
          line whichever of the two is taller. They are a pair: a baseline you
          fill in, and the thing you operate beside it. */}
      <div className="mt-1.5 flex items-stretch gap-3.5">
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
          // Six middots rather than a word: the placeholder is showing the
          // shape of what goes in, and any word there would be read as a value
          // already typed in a field whose own label is a sentence away.
          placeholder="······"
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="submit" className={`${CONTROL} shrink-0`}>
          Open
        </button>
      </div>
    </form>
  );
}
