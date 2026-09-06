"use client";

import { useParams } from "next/navigation";

import { normalizeCode } from "@/lib/code";

import BoardProgress from "./BoardProgress";

/**
 * `BoardProgress` for `/b/[code]`, taking the code from the URL rather than
 * from `tp.board`. Two reasons: the page must never await `params` itself, or
 * the static shell stops surviving the absent `generateStaticParams`; and a
 * phone that already remembers a different board should still see this board's
 * progress on this board's page.
 *
 * Normalised first, because a code typed with an `O` or an `l` is a supported
 * URL and the redirect to the canonical one takes a moment. Until it lands,
 * the raw segment would mirror the board under a second key nothing reads, and
 * a board with thirty solves would paint as empty.
 */
export default function BoardDeckProgress() {
  const params = useParams<{ code: string }>();
  const raw = typeof params?.code === "string" ? params.code : undefined;
  const code = raw ? normalizeCode(raw) : undefined;
  return <BoardProgress code={code} />;
}
