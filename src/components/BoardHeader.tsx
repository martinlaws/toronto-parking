import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { isValidCode, normalizeCode, readBoard } from "@/lib/boards";
import { PRINTED } from "@/lib/site";

import BoardClaim from "./BoardClaim";

/**
 * The leaf: warm paper laid on the cool page, and the only surface on the site
 * that is not the page ground.
 *
 * Its colours are literals rather than tokens, and that is the decision rather
 * than an oversight. A laid stripe at 1.4% ink, the two ends of a paper
 * gradient, the edge along the bottom and the shadow under it are properties
 * of this one object; a token would say they were shared, and the first thing
 * anyone does with a shared warm grey is set type on a ground nobody checked
 * it against. The two literals that do carry type were checked: #42463C is
 * 8.7:1 on the paper, and #726A59 clears 4.5:1 at both ends of the gradient.
 *
 * `-mx-4 sm:-mx-6` with the gutters put straight back: the slot this renders
 * into carries the page's gutters, so the skeleton and the unknown-code notice
 * line up with everything else, and the leaf is the one thing in that slot
 * that runs to the edge of the column.
 */
const LEAF =
  "relative -mx-4 border-b border-b-[#e2dcd0] px-4 pt-[76px] pb-[62px] shadow-[0_10px_22px_rgba(74,63,42,0.10),0_1px_0_#e0d9cb] [background:repeating-linear-gradient(92deg,rgba(19,23,20,0.014)_0_1px,transparent_1px_4px),linear-gradient(#f7f3eb,#f1ede3)] sm:-mx-6 sm:px-6";

/**
 * The line the leaf is built around, and the only place on the site the serif
 * is given a display size. One class string across both branches, because a
 * name and a bare board number are the same line saying different words.
 *
 * The size is clamped rather than stepped at a breakpoint. A seeded name can
 * run to 40 characters, and what a fixed 56px produces there is not a line
 * that wraps but a line that wraps four times; `clamp` ties it to the column
 * instead, so the same string sets at 42px on a 320px phone and at 56px
 * wherever the column has the room. `leading-[1.02]` is what leaves a second
 * line somewhere to sit when one is needed.
 */
const DISPLAY =
  "font-serif text-[clamp(2.25rem,13vw,3.5rem)] leading-[1.02] tracking-[-0.012em] text-ink italic [font-variation-settings:'opsz'_60]";

const KICKER = "font-mono text-[9.5px] leading-none tracking-[0.26em] text-[#726a59] uppercase";

const DEDICATION =
  "mt-6 max-w-[14.5em] font-serif text-[19.5px] leading-[1.5] tracking-[-0.005em] text-[#42463c] text-pretty [font-variation-settings:'opsz'_18]";

/** Two short lines rather than a long one and an orphan: the imprint is a
 *  colophon, and a colophon sets as a block. */
const IMPRINT =
  "mt-4 max-w-[24em] font-mono text-[9.5px] leading-[1.9] tracking-[0.15em] text-balance text-[#726a59] uppercase";

const SIGNATURE =
  "mt-[13px] font-serif text-[22px] leading-none text-accent italic [font-variation-settings:'opsz'_22]";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The edition mark, drawn the way a numbered print carries one: the number
 * written into the foot margin inside two passes of a circle that do not quite
 * meet. A badge would have said the same thing in the language of software.
 *
 * Hidden from the accessibility tree, because the imprint two lines above it
 * already says which of the four this is, and a hand-drawn `02` read out after
 * it is that fact again with none of what makes it worth drawing.
 */
function Ring({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute right-3 bottom-[46px] flex h-[74px] w-[90px] rotate-[-6deg] items-center justify-center"
    >
      <svg viewBox="0 0 92 74" className="absolute inset-0 h-full w-full">
        <path
          d="M40 6 C64 4.4 87 13 88.6 30.6 C90.2 49.5 68 68.4 43 69.4 C19.5 70.3 3.4 55.6 2.6 38 C1.8 20.8 17.5 8.4 41.5 6.2 C57 4.8 70 8 78 13.5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-accent"
        />
        <path
          d="M52 10.4 C72.5 12.6 84.4 22.8 83.2 37.6 C81.8 54 63.5 65.6 42.5 64.4 C23 63.3 9.2 51 10 35.6 C10.7 22 25 11.6 46 10.2"
          fill="none"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.5"
          className="stroke-accent"
        />
      </svg>
      <em className="relative rotate-[-3deg] text-[23px] tracking-[-0.01em] text-accent not-italic tabular-nums lining-nums [font-variation-settings:'wdth'_100,'wght'_650]">
        {pad(n)}
      </em>
    </span>
  );
}

/**
 * Everything the two branches share, in the order a print states it: the
 * edition, the line the copy is addressed with, a short rule, the imprint, the
 * signature. `children` is the only part that differs, which is why the rule
 * and everything under it are here rather than written out twice.
 */
function Leaf({ n, imprint, children }: { n: number; imprint: string; children: ReactNode }) {
  return (
    <div className={LEAF}>
      <Ring n={n} />
      <p className={KICKER}>An edition of four</p>
      {children}
      <div className="mt-[44px] h-[3px] w-10 bg-accent" aria-hidden="true" />
      <p className={IMPRINT}>{imprint}</p>
      <p className={SIGNATURE}>&mdash;&nbsp;Martin</p>
    </div>
  );
}

/**
 * Awaits `params` inside its own `<Suspense>` so the page's static shell never
 * depends on the code. Canonicalises first: a code typed with an `O` or an `l`
 * lands here and is sent on to the one URL the QR prints.
 *
 * An unknown code gets a 200 and a notice, exactly as a mistyped one does, so
 * nothing on this page tells a probe whether a code is live.
 *
 * `BoardClaim` is a sibling of the leaf rather than a child of it. It asks
 * which board this phone belongs to, which is not something the paper says,
 * and it would otherwise land under the hand-drawn number in the foot margin,
 * which is the one part of the leaf a block of text cannot have.
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
    // The lede treatment, because on this page that is what it is: a reader
    // who mistyped a code has landed on a page whose only content is this
    // sentence, and it should read as the page rather than as an error in one.
    return (
      <p data-board="unknown" className="tp-lede pt-10">
        That isn&apos;t one of the four. Check the code on the card in the box and try again.
      </p>
    );
  }

  // A board with no dedication is the maker's own copy. It gets no greeting;
  // the number it is addressed by is the number it was printed as, so the
  // imprint drops the half the display line has already said.
  if (board.dedication === "") {
    return (
      <header data-board={board.code}>
        <Leaf n={board.n} imprint={`Printed in Toronto, ${PRINTED}.`}>
          <h1 className={DISPLAY}>Board {board.n} of 4.</h1>
        </Leaf>
        <BoardClaim code={board.code} n={board.n} name={board.name} />
      </header>
    );
  }

  return (
    <header data-board={board.code}>
      {/* The dedication line is this page's title, so it carries the level.
          Nothing new reaches history or a preview card: the page is `noindex`
          with an absolute `<title>` of the site name, and the name was already
          in-page text. All that changes is that it is now the size of the
          thing it is, on a page someone reads once, standing over an open
          box. */}
      <Leaf n={board.n} imprint={`Board ${board.n} of 4. Printed in Toronto, ${PRINTED}.`}>
        <h1 className={DISPLAY}>For {board.name}.</h1>
        <p className={DEDICATION}>{board.dedication}</p>
      </Leaf>
      <BoardClaim code={board.code} n={board.n} name={board.name} />
    </header>
  );
}
