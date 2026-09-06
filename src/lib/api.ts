import type { NextRequest } from "next/server";

import { clientIp, getRatelimit, retryAfterSeconds } from "./boards";

/**
 * The three shapes every board route answers with, and the rate-limit gate.
 * Every response carries `Cache-Control: no-store`: the client is a sync engine
 * reading status codes, and a cached 404 would strand a board.
 */

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

/** Unknown and mistyped codes share this body, so nothing tells a probe which. */
export const notFound = () => json({ error: "not_found" }, 404);

export const badCard = () => json({ error: "bad_card" }, 400);

export const badAt = () => json({ error: "bad_at" }, 400);

/**
 * 60 requests a minute by client IP. Returns the 429 when the window is spent
 * and null otherwise. Reading the request headers is also what tells Cache
 * Components this handler runs at request time.
 */
export async function rateLimited(request: NextRequest): Promise<Response | null> {
  const ip = clientIp(request.headers);
  const { success, reset } = await getRatelimit().limit(ip);
  if (success) return null;
  return json({ error: "rate_limited" }, 429, {
    "Retry-After": String(retryAfterSeconds(reset)),
  });
}

/** `{at}` off a request body that may be absent, empty or not JSON at all. */
export async function readAt(request: NextRequest): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "at" in body) {
      return (body as { at: unknown }).at;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
