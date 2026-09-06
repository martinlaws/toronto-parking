import type { Metadata } from "next";
import { Suspense } from "react";

import BoardHeader from "@/components/BoardHeader";
import FourBoards from "@/components/FourBoards";
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
  title: SITE_NAME,
  robots: { index: false, follow: false },
};

export default function BoardPage({ params }: PageProps<"/b/[code]">) {
  return (
    <main>
      <Suspense fallback={<p data-skeleton="board-header">Finding this board</p>}>
        <BoardHeader params={params} />
      </Suspense>

      {/* INTEGRATION: lane B's <DeckGrid /> and this lane's <BoardProgress /> go here. */}

      <Suspense fallback={<p data-skeleton="four-boards">Reading the other boards</p>}>
        <FourBoards params={params} />
      </Suspense>
    </main>
  );
}
