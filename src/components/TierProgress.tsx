"use client";

import { useEffect } from "react";

/**
 * Fills the per-tier `7 of 12` counter and its bar on a prerendered `DeckGrid`.
 *
 * The grid is a Server Component and the solved overlay only writes
 * `data-solved` onto the tiles, so the counts are read back off the tiles
 * rather than out of a store: nothing here needs to know where solved state
 * comes from, and the deck page never re-renders to show it. A `MutationObserver`
 * on the same attribute keeps the counters in step with a tap, whichever order
 * the two components happen to mount in. With nothing solved, or with no
 * overlay on the page at all, every counter keeps the zero the HTML ships.
 */
export default function TierProgress() {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-deck-grid] [data-tier]"),
    );
    if (sections.length === 0) return;

    const paint = () => {
      for (const section of sections) {
        const total = section.querySelectorAll("[data-card]").length;
        const solved = section.querySelectorAll('[data-card][data-solved="true"]').length;
        const count = section.querySelector<HTMLElement>("[data-tier-solved]");
        if (count) count.textContent = String(solved);
        const bar = section.querySelector<HTMLElement>("[data-tier-bar]");
        if (bar) bar.style.width = total > 0 ? `${(solved / total) * 100}%` : "0%";
      }
    };

    paint();
    const observer = new MutationObserver(paint);
    for (const section of sections) {
      observer.observe(section, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-solved"],
      });
    }
    return () => observer.disconnect();
  }, []);

  return null;
}
