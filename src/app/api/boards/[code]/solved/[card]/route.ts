import type { NextRequest } from "next/server";

import { badAt, badCard, json, notFound, rateLimited, readAt } from "@/lib/api";
import {
  boardExists,
  isValidCode,
  markSolved,
  normalizeCode,
  parseCard,
  resolveAt,
  unmarkSolved,
} from "@/lib/boards";

/**
 * The card and the timestamp are checked before the code, so every 400 this
 * route can return is the same whether or not the board exists. Checking the
 * code first would let a probe read a `bad_card` as "that board is real".
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

  const field = await readAt(request);
  if (!field.ok) return badAt();
  const at = resolveAt(field.at);
  if (!at.ok) return badAt();

  const canonical = normalizeCode(code);
  if (!isValidCode(canonical) || !(await boardExists(canonical))) return notFound();

  return json({ solved: await markSolved(canonical, n, at.at) });
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
