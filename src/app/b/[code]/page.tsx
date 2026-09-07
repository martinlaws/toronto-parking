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
    /* The root page's container, not `/about`'s narrower one: `DeckGrid` goes
       6-up at `md`, and squeezing the tier rows into `max-w-2xl` would leave
       this page reading differently from the deck it shares. The rhythm sits on
       wrappers here rather than on `<main>`, so the pick-up bar can be its own
       component's outermost element and still have `<main>` as the block it
       sticks inside. */
    <main className="mx-auto w-full max-w-5xl grow px-4 py-10 sm:px-6 sm:py-14">
      {/* One header slot, whatever resolves into it: the notice and the
          skeleton take the same margin as the dedication, so the deck below
          does not jump when the store answers. */}
      <div className="mb-10">
        <StoreDown>
          <Suspense
            fallback={
              <p data-skeleton="board-header" className="text-lg text-ink/70">
                Finding this board
              </p>
            }
          >
            <BoardHeader params={params} />
          </Suspense>
        </StoreDown>
      </div>

      {/* The code comes from the URL inside this boundary, so the deck grid and
          the rest of the shell still prerender without the page awaiting params. */}
      <Suspense fallback={null}>
        <BoardDeckProgress />
      </Suspense>

      <DeckGrid />

      <div className="mt-16">
        <StoreDown>
          <Suspense
            fallback={
              <p data-skeleton="four-boards" className="text-lg text-ink/70">
                Reading the other boards
              </p>
            }
          >
            <FourBoards params={params} />
          </Suspense>
        </StoreDown>
      </div>
    </main>
  );
}
