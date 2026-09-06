import { ImageResponse } from "next/og";

import { renderBoard } from "@/lib/board-svg";
import { cards } from "@/lib/deck";
import { DECK_SIZE, tierLabel } from "@/lib/tiers";
import { COLOURS } from "@/lib/theme";

/**
 * One poster per card, because "I'm stuck on #31" is the message that gets
 * sent and the renderer already exists.
 *
 * The board arrives as a base64 `data:image/svg+xml` `<img>` with explicit
 * dimensions: `renderBoard` returns a string precisely so this route, which
 * compiles in the `rsc` layer where `react-dom/server` throws, can use it.
 * No font is fetched here; the default face is the point.
 */
export const alt = "A parking puzzle setup";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** All sixty build once, alongside the pages. */
export function generateStaticParams() {
  return cards.map((card) => ({ n: String(card.n) }));
}

const BOARD_PX = 560;

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const index = Number(n) - 1;
  const card =
    /^[1-9][0-9]?$/.test(n) && index >= 0 && index < DECK_SIZE ? cards[index] : cards[0];

  const svg = renderBoard(card.pieces, "og", card.board);
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
          padding: "35px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={BOARD_PX} height={BOARD_PX} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 64,
            flexGrow: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 180, fontWeight: 800, lineHeight: 1 }}>
            #{card.n}
          </div>
          <div style={{ display: "flex", fontSize: 40, marginTop: 20, opacity: 0.7 }}>
            {tierLabel(card.tier)}
          </div>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 6 }}>
            Par {card.moves}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 60,
            bottom: 40,
            display: "flex",
            fontSize: 28,
            letterSpacing: 1,
            opacity: 0.55,
          }}
        >
          Toronto Parking
        </div>
      </div>
    ),
    size,
  );
}
