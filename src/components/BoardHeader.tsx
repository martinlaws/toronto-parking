import { redirect } from "next/navigation";

import { isValidCode, normalizeCode, readBoard } from "@/lib/boards";
import { PRINTED } from "@/lib/site";

import BoardClaim from "./BoardClaim";

/**
 * Awaits `params` inside its own `<Suspense>` so the page's static shell never
 * depends on the code. Canonicalises first: a code typed with an `O` or an `l`
 * lands here and is sent on to the one URL the QR prints.
 *
 * An unknown code gets a 200 and a notice, exactly as a mistyped one does, so
 * nothing on this page tells a probe whether a code is live.
 */
export default async function BoardHeader({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const canonical = normalizeCode(code);
  if (canonical !== code) redirect(`/b/${canonical}`);

  const board = isValidCode(canonical) ? await readBoard(canonical) : null;

  if (!board) {
    return (
      <p data-board="unknown">
        That isn&apos;t one of the four. Check the code on the card in the box and try again.
      </p>
    );
  }

  return (
    <header data-board={board.code}>
      {/* The dedication line is this page's title, so it carries the level.
          Nothing new reaches history or a preview card: the page is `noindex`
          with an absolute `<title>` of the site name, and the name was already
          in-page text. */}
      <h1>For {board.name}.</h1>
      {board.dedication ? <p>{board.dedication}</p> : null}
      <p>
        Board {board.n} of 4. Printed in Toronto, {PRINTED}. — Martin
      </p>
      <BoardClaim code={board.code} n={board.n} name={board.name} />
    </header>
  );
}
