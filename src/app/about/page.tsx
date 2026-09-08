import type { Metadata } from "next";
import Link from "next/link";

import { DECK_SIZE } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "About",
  description: "Where this puzzle came from, what is in the box, and who to credit.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl grow px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">About</h1>

      <div className="mt-10 space-y-10 text-lg leading-relaxed">
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
            <a className="underline underline-offset-4" href="https://makerworld.com/en/models/78940-rush-hour-logical-game-with-cars" rel="noreferrer">
              Martin Kozak&apos;s model on MakerWorld
            </a>
            , shared under{" "}
            <a className="underline underline-offset-4" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noreferrer">
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
            The 60 layouts are drawn from Michael Fogleman&apos;s 2018 database of every interesting 6x6 position with up to two walls, each solved to a proven minimum. His write-up is at{" "}
            <a className="underline underline-offset-4" href="https://www.michaelfogleman.com/rush/" rel="noreferrer">
              michaelfogleman.com/rush
            </a>
            .
          </p>
          <p>
            No official edition has fixed obstacles. The two pylons are this set&apos;s own addition; Fogleman&apos;s database calls them walls.
          </p>
          <p className="text-base text-ink/70">
            RUSH HOUR is a registered trademark of Ravensburger North America, Inc. This site is not affiliated with or endorsed by Ravensburger or ThinkFun.
          </p>
        </Section>
      </div>

      <footer className="mt-14 border-t border-ink/10 pt-6 text-sm text-ink/60">
        <Link href="/" className="underline underline-offset-4">
          Back to the deck
        </Link>
      </footer>
    </main>
  );
}
