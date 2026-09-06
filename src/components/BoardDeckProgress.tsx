"use client";

import { useParams } from "next/navigation";

import BoardProgress from "./BoardProgress";

/**
 * `BoardProgress` for `/b/[code]`, taking the code from the URL rather than
 * from `tp.board`. Two reasons: the page must never await `params` itself, or
 * the static shell stops surviving the absent `generateStaticParams`; and a
 * phone that already remembers a different board should still see this board's
 * progress on this board's page.
 */
export default function BoardDeckProgress() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : undefined;
  return <BoardProgress code={code} />;
}
