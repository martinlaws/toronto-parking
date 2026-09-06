"use client";

import { useEffect, useState } from "react";

import { flush, resync } from "@/lib/local";

/**
 * Replay the outbox, then pull and adopt: on mount and on `online`.
 *
 * It is a hook rather than an effect inside `BoardProgress` because the page
 * where solves are actually tapped is the card page, which carries the toggle
 * and not the progress overlay. A tap made in a tunnel has to be able to reach
 * the store from there, without waiting for a walk back to the deck.
 *
 * Returns false while the store is unreachable. Two components on one page
 * share a single replay: `flush()` coalesces per code. The reconnect uses
 * `resync()` instead, which chains: the replay it would otherwise join is the
 * one still hanging on the connection that has only just come back.
 */
export function useSync(code: string | null): boolean {
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    if (!code) return;
    let live = true;
    const settle = (ok: boolean) => {
      if (live) setReachable(ok);
    };
    void flush(code).then(settle);
    const back = () => {
      void resync(code).then(settle);
    };
    window.addEventListener("online", back);
    return () => {
      live = false;
      window.removeEventListener("online", back);
    };
  }, [code]);

  return reachable;
}
