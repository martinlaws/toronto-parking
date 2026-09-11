import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME } from "@/lib/site";
import { DECK_SIZE } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "About",
  description: "Where this puzzle came from, what is in the box, and who to credit.",
};

/**
 * The only long-form reading on the site, and so the only page set in the
 * serif throughout. Everywhere else Newsreader carries one sentence at a time
 * — a lede, a caption, a legend — with the sans carrying the structure around
 * it. Here the structure is four headings and everything between them is
 * prose, which is the job that face was given.
 */
const PROSE =
  "font-serif text-[16.5px] leading-[1.55] text-pretty text-ink-edge [font-variation-settings:'opsz'_17]";

/**
 * A link inside running text, as against the label-on-a-rule a control is. It
 * keeps the underline a reader expects in a paragraph and spends the accent on
 * it, which is the other half of the design's rule about links: 2px of green
 * under a thing you can follow.
 */
const INLINE_LINK =
  "underline decoration-accent underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The card page's section head at the same volume: 2px of ink under an
 *  uppercase label, which is the design's major boundary wherever it appears. */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-9">
      <div className="border-b-2 border-b-ink pb-[7px]">
        <h2
          id={id}
          className="tp-label text-[12.5px] font-bold tracking-[0.17em] text-ink uppercase"
        >
          {title}
        </h2>
      </div>
      <div className={`mt-3.5 space-y-3.5 ${PROSE}`}>{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl grow px-4 pt-5 pb-8 sm:px-6">
      {/* The deck's masthead shape, so arriving here from the foot of the
          listing reads as another page of the same object rather than as a
          document about it. */}
      <header>
        <p className="tp-kicker">{SITE_NAME}</p>
        <h1 className="tp-masthead mt-2.5">About</h1>
        <p className="tp-lede mt-3.5">
          Where this puzzle came from, what is in the box, and who to credit.
        </p>
      </header>

      <Section id="origin" title="Origin">
        <p>Nob Yoshigahara called it Tokyo Parking. This one&apos;s been relocated.</p>
        <p>
          Nob Yoshigahara (1936&ndash;2004) brought his wooden Tokyo Parking puzzle to Binary Arts in 1995, and they licensed it from him. He hand-built the first 160 challenges himself.
        </p>
      </Section>

      <Section id="print" title="The print">
        <p>
          Four copies, printed in Toronto, one each. A 6x6 peg-and-channel board with a white frame, black asphalt, glow-green markings and translucent pieces. Each box holds four blue cars and a blue truck, four yellow cars and two yellow trucks, four green cars and a green truck, two yellow pylons, and the red car.
        </p>
        <p>
          The board and the pieces are printed from{" "}
          <a className={INLINE_LINK} href="https://makerworld.com/en/models/78940-rush-hour-logical-game-with-cars" rel="noreferrer">
            Martin Kozak&apos;s model on MakerWorld
          </a>
          , shared under{" "}
          <a className={INLINE_LINK} href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noreferrer">
            CC BY-NC-SA 4.0
          </a>
          . The small edits and the colours are this set&apos;s own.
        </p>
      </Section>

      <Section id="rules" title="The rules">
        <p>
          Every piece slides along its own lane and never turns. Get the red car out through the gap in the wall. Pylons don&apos;t move.
        </p>
        <p>
          Par is the fewest moves the position allows, so a card solved in par cannot be solved in fewer. There are {DECK_SIZE} cards, ordered easiest to hardest.
        </p>
      </Section>

      <Section id="credits" title="Credits">
        <p>
          You may know it as Rush Hour, the version Binary Arts published in 1996 and ThinkFun sold for decades.
        </p>
        <p>
          The {DECK_SIZE} layouts are drawn from Michael Fogleman&apos;s 2018 database of every interesting 6x6 position with up to two walls, each solved to a proven minimum. His write-up is at{" "}
          <a className={INLINE_LINK} href="https://www.michaelfogleman.com/rush/" rel="noreferrer">
            michaelfogleman.com/rush
          </a>
          .
        </p>
        <p>
          No official edition has fixed obstacles. The two pylons are this set&apos;s own addition; Fogleman&apos;s database calls them walls.
        </p>
        {/* Set at the volume an attribution is read at rather than the volume
            of the page it sits on. It is a notice the mark's owner is owed,
            not a paragraph of the essay. */}
        <p className="tp-note">
          RUSH HOUR is a registered trademark of Ravensburger North America, Inc. This site is not affiliated with or endorsed by Ravensburger or ThinkFun.
        </p>
      </Section>

      {/* The deck's own foot, which is where this page is reached from. */}
      <footer className="tp-deck-foot mt-9">
        <p>{DECK_SIZE} cards, ordered easiest to hardest.</p>
        <Link
          href="/"
          className="tp-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span>Back to the deck</span>
        </Link>
      </footer>
    </main>
  );
}
