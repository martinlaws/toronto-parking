"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * A client wrapper because `beforeSend` is a function and `layout.tsx` is a
 * Server Component, so the prop cannot cross the boundary from there.
 *
 * The rewrite matters: a board code is a capability URL, the only credential
 * the four boards have. Redacting it here keeps it out of the analytics
 * pipeline while `/b/[code]` still shows up as one route.
 */
export default function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = event.url.replace(/\/b\/[^/?#]+/, "/b/[code]");
        return url === event.url ? event : { ...event, url };
      }}
    />
  );
}
