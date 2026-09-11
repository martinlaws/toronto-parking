import Link from "next/link";

import { SITE_NAME } from "@/lib/site";
import { DECK_SIZE } from "@/lib/tiers";

/**
 * Catches both `notFound()` from a card that is not one of the sixty and any
 * URL the app does not route.
 *
 * It takes the deck's masthead rather than a look of its own, because the two
 * ways to arrive are a mistyped card number and a stale link, and in both cases
 * what a reader needs is to recognise where they are and to be told the range
 * they overshot. The bound is `DECK_SIZE` rather than a literal: a deck that
 * grew and a 404 still saying sixty would send someone back off the end again.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl grow flex-col justify-center px-4 py-20 sm:px-6">
      <p className="tp-kicker">{SITE_NAME}</p>
      <h1 className="tp-masthead mt-2.5">
        Nothing
        <br />
        here
      </h1>
      <p className="tp-lede mt-3.5">
        That address doesn&apos;t match anything here. The deck runs from #1 to #{DECK_SIZE}.
      </p>
      <p className="mt-4">
        <Link
          href="/"
          className="tp-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span>Back to the deck</span>
        </Link>
      </p>
    </main>
  );
}
