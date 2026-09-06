import { ImageResponse } from "next/og";

import { renderBoard } from "@/lib/board-svg";
import { cards } from "@/lib/deck";
import { SITE_NAME } from "@/lib/site";
import { COLOURS } from "@/lib/theme";
import { DECK_SIZE } from "@/lib/tiers";

/**
 * The generic site poster. `/b/<code>` deliberately gets no image of its own,
 * so this is what a shared board link shows: a board and a name, no dedication
 * and no code.
 */
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const svg = renderBoard(cards[0].pieces, "og", cards[0].board);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: COLOURS.ground,
          color: COLOURS.ink,
          padding: "35px 70px",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={520} height={520} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 64,
            flexGrow: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 86, fontWeight: 800, lineHeight: 1.05 }}>
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 36, marginTop: 24, opacity: 0.7 }}>
            {DECK_SIZE} numbered layouts for a printed sliding-car puzzle
          </div>
        </div>
      </div>
    ),
    size,
  );
}
