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
      <p data-board="unknown" className="max-w-xl text-lg text-ink/70">
        That isn&apos;t one of the four. Check the code on the card in the box and try again.
      </p>
    );
  }

  // A board with no dedication is the maker's own copy. It gets no greeting;
  // the register line carries the title instead, split so the display face
  // holds a short line and the sign-off stays body-sized.
  if (board.dedication === "") {
    return (
      <header data-board={board.code}>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Board {board.n} of 4.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink/70">
          Printed in Toronto, {PRINTED}. — Martin
        </p>
        <BoardClaim code={board.code} n={board.n} name={board.name} />
      </header>
    );
  }

  return (
    <header data-board={board.code}>
      {/* The dedication line is this page's title, so it carries the level.
          Nothing new reaches history or a preview card: the page is `noindex`
          with an absolute `<title>` of the site name, and the name was already
          in-page text.

          `text-4xl` before `sm:`, rather than the root page's fixed `text-5xl`:
          a seeded name runs to 40 characters, and at 360px the larger size
          wraps this line to three or four. */}
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        For {board.name}.
      </h1>
      <p className="mt-3 max-w-xl text-lg text-ink/70">{board.dedication}</p>
      <p className="mt-3 max-w-xl text-lg text-ink/70">
        Board {board.n} of 4. Printed in Toronto, {PRINTED}. — Martin
      </p>
      <BoardClaim code={board.code} n={board.n} name={board.name} />
    </header>
  );
}
