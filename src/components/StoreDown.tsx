"use client";

import { catchError, type ErrorInfo } from "next/error";

/**
 * A component-level error boundary, so a store outage costs the one block that
 * needed the store rather than the whole page: the deck is prerendered and
 * still readable while Upstash is away.
 *
 * `catchError` lets `redirect()` through, which matters here because
 * `<BoardHeader>` canonicalises the code by throwing one.
 */
function StoreDownFallback(_props: Record<string, unknown>, { retry }: ErrorInfo) {
  return (
    <p data-store="down">
      The store didn&apos;t answer. Try again in a moment.{" "}
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </p>
  );
}

export default catchError(StoreDownFallback);
