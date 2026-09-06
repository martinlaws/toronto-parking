import { NextResponse, type NextRequest } from "next/server";

import { DECK_SIZE } from "@/lib/tiers";

/**
 * Turns a card number that is not one of the sixty into a real 404.
 *
 * The spec asks for `dynamicParams = false`, and the card page calls
 * `notFound()` as well, but neither can set the status code under Cache
 * Components: the bundled 16.3.4 docs reject the `dynamicParams` export
 * outright, and every dynamic route streams a shell before the page runs, so
 * `notFound()` can only produce a `200` carrying `noindex` and the not-found
 * UI. The docs' own remedy is to make the check here, before the response
 * starts (`file-conventions/loading.md`, "Status Codes"; `notFound`, "Calling
 * notFound() after streaming has started").
 *
 * The check is a regex on the pathname and nothing else: no store, no deck,
 * no data. `tiers.ts` never imports `deck.json`, so nothing heavy comes with
 * `DECK_SIZE`.
 */
const CARD_PATH = /^\/cards\/([^/]+)(?:\/opengraph-image)?\/?$/;

export function proxy(request: NextRequest) {
  const match = CARD_PATH.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();

  const raw = match[1];
  const known = /^[1-9][0-9]?$/.test(raw) && Number(raw) <= DECK_SIZE;
  if (known) return NextResponse.next();

  return NextResponse.rewrite(new URL("/_not-found", request.nextUrl));
}

export const config = {
  matcher: "/cards/:path*",
};
