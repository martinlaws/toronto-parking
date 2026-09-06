"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeCode } from "@/lib/code";
import { getBoard } from "@/lib/local";

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

  if (board) {
    return (
      <p data-board-bar="remembered">
        <Link href={`/b/${board.code}`}>Continue on {board.name}&apos;s board →</Link>
      </p>
    );
  }

  return (
    <form
      data-board-bar="empty"
      onSubmit={(event) => {
        event.preventDefault();
        const code = normalizeCode(typed);
        if (code === "") return;
        router.push(`/b/${code}`);
      }}
    >
      <label htmlFor="board-code">Have a board? Enter the code from the card in the box.</label>
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
      />
      <button type="submit">Open</button>
    </form>
  );
}
