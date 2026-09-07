import { boardAriaLabel } from "@/lib/board";
import { renderBoard, type BoardMode } from "@/lib/board-svg";
import type { Card } from "@/lib/types";

type Props = {
  card: Pick<Card, "n" | "pieces" | "board">;
  mode?: BoardMode;
  className?: string;
};

/**
 * The diagram. `renderBoard` returns a string rather than React because the
 * Open Graph route needs the same renderer and cannot use `react-dom/server`;
 * the markup is built from `data/deck.json` at build time and never from user
 * input, which is what makes `dangerouslySetInnerHTML` safe here.
 *
 * The wrapper is a fixed square so the SVG can turn inside it without anything
 * re-laying out. The turn is a CSS transform driven by `--tp-turn` on `<html>`,
 * a cumulative angle `RotateControl` writes after hydration so every tap moves
 * a quarter turn forward; `data-orientation` rides alongside it and still
 * drives the EXIT lip and the piece letters.
 */
export default function Board({ card, mode = "card", className }: Props) {
  const svg = renderBoard(
    card.pieces,
    mode,
    card.board,
    mode === "thumb" ? undefined : boardAriaLabel(card),
  );
  const base = mode === "thumb" ? "tp-thumb" : "tp-board";
  return (
    <div
      className={className ? `${base} ${className}` : base}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
