import Link from "next/link";

/**
 * Catches both `notFound()` from a card that is not one of the sixty and any
 * URL the app does not route.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col justify-center px-4 py-20 sm:px-6">
      <h1 className="font-display text-6xl font-extrabold tracking-tight">Nothing here</h1>
      <p className="mt-4 text-lg text-ink/70">
        That address doesn&apos;t match anything here. The deck runs from #1 to #60.
      </p>
      <p className="mt-8">
        <Link href="/" className="underline underline-offset-4">
          Back to the deck
        </Link>
      </p>
    </main>
  );
}
