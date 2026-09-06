import type { NextRequest } from "next/server";

import { json, notFound, rateLimited } from "@/lib/api";
import { isValidCode, normalizeCode, readBoard } from "@/lib/boards";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/boards/[code]">) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const { code } = await ctx.params;
  const canonical = normalizeCode(code);
  if (!isValidCode(canonical)) return notFound();

  const board = await readBoard(canonical);
  if (!board) return notFound();

  return json({
    code: board.code,
    n: board.n,
    name: board.name,
    dedication: board.dedication,
    solved: board.solved,
  });
}
