import type { NextRequest } from "next/server";

import { clientIp, getRatelimit, retryAfterSeconds } from "./boards";

/**
 * The shapes every board route answers with, and the rate-limit gate.
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

export const badMoves = () => json({ error: "bad_moves" }, 400);

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

/** The fields the route can act on, or the body that could not be read at all. */
export type SolveFields = { ok: true; at: unknown; moves: unknown } | { ok: false };

/**
 * `{at, moves}` off a request body that may be absent, empty or not JSON at all.
 * The three cases are kept apart: no body means the server times the solve and
 * records no count, a body that will not parse is a `bad_at` rather than a
 * silent server timestamp, and a parsed body missing either field is the absent
 * case for that field alone.
 *
 * Both fields come back from the one call because a request body can only be
 * read once. A second reader beside this one would find the stream consumed and
 * answer as though the field had never been sent.
 */
export async function readSolve(request: NextRequest): Promise<SolveFields> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false };
  }
  if (raw.trim() === "") return { ok: true, at: undefined, moves: undefined };

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (body && typeof body === "object") {
    const fields = body as { at?: unknown; moves?: unknown };
    return { ok: true, at: fields.at, moves: fields.moves };
  }
  return { ok: true, at: undefined, moves: undefined };
}
