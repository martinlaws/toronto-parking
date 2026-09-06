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
 * re-laying out. Orientation is a CSS transform driven by `data-orientation`
 * on `<html>`, which `RotateControl` writes after hydration.
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
