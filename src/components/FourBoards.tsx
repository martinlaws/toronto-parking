import { isValidCode, normalizeCode, panelRowText, readPanel } from "@/lib/boards";

/**
 * Who is furthest along, enumerated from the `boards` set rather than `KEYS`.
 * Dynamic and uncached on purpose: the people reading this panel are the people
 * writing it, and even a minute of cache would show someone their own solve
 * missing.
 *
 * The panel renders only for a code that is one of the four. The code is the
 * credential, so a stranger who guesses a URL reads no names.
 */
export default async function FourBoards({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const canonical = normalizeCode(code);
  if (!isValidCode(canonical)) return null;

  const rows = await readPanel(canonical);
  if (!rows.some((row) => row.code === canonical)) return null;

  const now = new Date();

  return (
    <section data-panel="four-boards" aria-labelledby="furthest-along">
      <h2 id="furthest-along">Furthest along</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.code} data-you={row.you ? "true" : undefined}>
            {panelRowText(row, now)}
            {row.you ? " · you" : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
