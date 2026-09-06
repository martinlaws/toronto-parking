import type { Metadata } from "next";
import { Suspense } from "react";

import BoardDeckProgress from "@/components/BoardDeckProgress";
import BoardHeader from "@/components/BoardHeader";
import DeckGrid from "@/components/DeckGrid";
import FourBoards from "@/components/FourBoards";
import StoreDown from "@/components/StoreDown";
import { SITE_NAME } from "@/lib/site";

/**
 * The board's home. The page itself never awaits `params`, so the shell is
 * static and survives the deliberately missing `generateStaticParams`: the four
 * codes are printed, not published, and listing them at build time would put
 * them in the deployment.
 *
 * The title stays the site name and the page is `noindex`, so no recipient's
 * name reaches browser history, a preview card or a crawler.
 */
export const metadata: Metadata = {
  // Absolute, so the layout's `%s · Toronto Parking` template does not double it.
  title: { absolute: SITE_NAME },
  robots: { index: false, follow: false },
};

export default function BoardPage({ params }: PageProps<"/b/[code]">) {
  return (
    <main>
      <StoreDown>
        <Suspense fallback={<p data-skeleton="board-header">Finding this board</p>}>
          <BoardHeader params={params} />
        </Suspense>
      </StoreDown>

      {/* The code comes from the URL inside this boundary, so the deck grid and
          the rest of the shell still prerender without the page awaiting params. */}
      <Suspense fallback={null}>
        <BoardDeckProgress />
      </Suspense>

      <DeckGrid />

      <StoreDown>
        <Suspense fallback={<p data-skeleton="four-boards">Reading the other boards</p>}>
          <FourBoards params={params} />
        </Suspense>
      </StoreDown>
    </main>
  );
}
