"use client";

import { catchError, type ErrorInfo } from "next/error";

import { CONTROL } from "@/lib/ui";

/**
 * A component-level error boundary, so a store outage costs the one block that
 * needed the store rather than the whole page: the deck is prerendered and
 * still readable while Upstash is away.
 *
 * `catchError` lets `redirect()` through, which matters here because
 * `<BoardHeader>` canonicalises the code by throwing one.
 *
 * The notice says what happened and the button says what to do; a sentence
 * ending "Try again in a moment" next to a button reading "Try again" was the
 * same instruction twice. `/b/[code]` has two of these boundaries and an outage
 * trips both, which is right: each owns its own `retry()`, so folding them into
 * one notice would leave the other block with no way back.
 *
 * It carries no padding of its own. The two slots that use it have their own
 * gutters, and a notice that inset itself would sit a step in from the block it
 * has replaced on one of them.
 */
function StoreDownFallback(_props: Record<string, unknown>, { retry }: ErrorInfo) {
  return (
    <p
      data-store="down"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tracking-[-0.002em] text-muted"
    >
      The store didn&apos;t answer.{" "}
      <button type="button" onClick={() => retry()} className={CONTROL}>
        Try again
      </button>
    </p>
  );
}

export default catchError(StoreDownFallback);
