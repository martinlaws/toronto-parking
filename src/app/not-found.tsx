import Link from "next/link";

/**
 * Catches both `notFound()` from a card that is not one of the sixty and any
 * URL the app does not route.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col justify-center px-4 py-20 sm:px-6">
      <p className="font-display text-6xl font-extrabold tracking-tight">Nothing here</p>
      <p className="mt-4 text-lg text-ink/70">
        There is no card at that number. The deck runs from 1 to 60.
      </p>
      <p className="mt-8">
        <Link href="/" className="underline underline-offset-4">
          Back to the deck
        </Link>
      </p>
    </main>
  );
}
