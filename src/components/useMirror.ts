"use client";

import { useEffect, useState } from "react";

import { MIRROR_EVENT } from "@/lib/local";

/**
 * A version counter that starts at 0 and steps once after hydration, then again
 * on every mirror change. Components render their server-safe shape at 0, so
 * nothing that depends on `localStorage` reaches the first paint and there is
 * no hydration mismatch to patch up.
 */
export function useMirror(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((current) => current + 1);
    bump();
    window.addEventListener(MIRROR_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(MIRROR_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  return version;
}
