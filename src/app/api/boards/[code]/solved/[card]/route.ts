import type { NextRequest } from "next/server";

import { badAt, badCard, badMoves, json, notFound, rateLimited, readSolve } from "@/lib/api";
import {
  boardExists,
  isValidCode,
  markSolved,
  normalizeCode,
  parseCard,
  resolveAt,
  resolveMoves,
  unmarkSolved,
} from "@/lib/boards";

/**
 * The card, the timestamp and the move count are all checked before the code, so
 * every 400 this route can return is the same whether or not the board exists.
 * Checking the code first would let a probe read a `bad_card` as "that board is
 * real", and a new field is a new way to make that mistake: `bad_moves` belongs
 * beside `bad_at`, above `normalizeCode`, and nowhere below it.
 */

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/boards/[code]/solved/[card]">,
) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const { code, card } = await ctx.params;
  const n = parseCard(card);
  if (n === null) return badCard();

  const fields = await readSolve(request);
  if (!fields.ok) return badAt();
  const at = resolveAt(fields.at);
  if (!at.ok) return badAt();
  const moves = resolveMoves(fields.moves);
  if (!moves.ok) return badMoves();

  const canonical = normalizeCode(code);
  if (!isValidCode(canonical) || !(await boardExists(canonical))) return notFound();

  return json({ solved: await markSolved(canonical, n, at.at, moves.moves) });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/boards/[code]/solved/[card]">,
) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const { code, card } = await ctx.params;
  const n = parseCard(card);
  if (n === null) return badCard();

  const canonical = normalizeCode(code);
  if (!isValidCode(canonical) || !(await boardExists(canonical))) return notFound();

  return json({ solved: await unmarkSolved(canonical, n) });
}
