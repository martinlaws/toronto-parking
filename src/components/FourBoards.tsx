import { isValidCode, normalizeCode, readPanel } from "@/lib/boards";
import { DECK_SIZE } from "@/lib/tiers";

/**
 * The ledger: one line per board, enumerated from the `boards` set rather than
 * `KEYS`. Dynamic and uncached on purpose — the people reading this panel are
 * the people writing it, and even a minute of cache would show someone their
 * own solve missing.
 *
 * It renders only for a code that is one of the four. The code is the
 * credential, so a stranger who guesses a URL reads no names.
 *
 * Ordered by board number, which is a change of what the panel is for. It used
 * to be a leaderboard, sorted furthest-first, and a leaderboard reshuffles
 * under you: the row you had learned to find at the top moves the week someone
 * else has a good run. Four fixed lines in print order do the thing the page
 * actually wants, which is to say that the other three exist and are playing.
 * The furthest card and the relative time go with the sort; `readPanel` still
 * computes both, and `panelRowText` in `src/lib/boards.ts` is now unused by any
 * page. Retiring it belongs in a commit that owns that file.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** The deck's `10 of 12` tally, one column over: the count is the message, the
 *  total is context, and the joining word is the quietest thing on the line.
 *  A zero takes the readable grey rather than the blank grey the ruled marks
 *  use, for the reason the tier tallies give — at 1.7:1 a number that means
 *  something cannot be read. */
function Tally({ solved }: { solved: number }) {
  return (
    <span className="shrink-0 text-[12.5px] leading-none font-[550] tracking-[0.01em] whitespace-nowrap text-muted tabular-nums lining-nums">
      <b className={solved === 0 ? "text-[14.5px] font-[720] text-muted" : "text-[14.5px] font-[720] text-accent"}>
        {solved}
      </b>
      {/* Padding on the page and a real space in the text, or the line is read
          out as "20of60". */}
      <i className="px-1 font-mono text-[9px] not-italic tracking-[0.09em] uppercase" aria-hidden="true">
        of
      </i>
      <span className="sr-only"> of </span>
      {DECK_SIZE}
    </span>
  );
}

export default async function FourBoards({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const canonical = normalizeCode(code);
  // A URL that is about to be redirected reads nothing: `<BoardHeader>` sends
  // the reader on to the canonical code, and the panel renders there instead.
  if (canonical !== code || !isValidCode(canonical)) return null;

  const rows = await readPanel(canonical);
  if (!rows.some((row) => row.code === canonical)) return null;

  const ledger = [...rows].sort((a, b) => a.n - b.n);
  // Over the boards that exist rather than a literal four, so a ledger read
  // before the last board is seeded says what it can count instead of claiming
  // a denominator it has not seen.
  const together = ledger.reduce((sum, row) => sum + row.solved, 0);

  return (
    <section data-panel="four-boards" aria-labelledby="four-boards">
      {/* The card page's section head, the same 2px ink rule at the same
          volume, so a block here and a block there open alike. */}
      <div className="flex items-baseline gap-3 border-b-2 border-b-ink pb-[7px]">
        <h2
          id="four-boards"
          className="tp-label text-[12.5px] font-bold tracking-[0.17em] text-ink uppercase"
        >
          The four boards
        </h2>
        <span className="ml-auto font-mono text-[10px] leading-none tracking-[0.05em] text-muted tabular-nums">
          {together} of {ledger.length * DECK_SIZE}
        </span>
      </div>

      <ol className="mt-1">
        {/* Keyed by board number, never by code. React writes a key verbatim
            into the flight payload Next inlines in this page's HTML, so a code
            here would hand every recipient the other three boards' credentials
            in view-source. `n` is a unique 1..4 the seed enforces. */}
        {ledger.map((row) => (
          <li
            key={row.n}
            data-you={row.you ? "true" : undefined}
            className="flex h-[38px] items-center [--tp-leader-drop:calc(50%-3px)]"
          >
            {/* The print number, and the second carrier of "this one is
                yours": it goes accent on your own row, and the word beside
                the name says the same thing for anyone who cannot see that. */}
            <span
              aria-hidden="true"
              className={`w-6 shrink-0 font-mono text-[10px] leading-none tabular-nums ${row.you ? "text-accent" : "text-muted"}`}
            >
              {pad(row.n)}
            </span>
            <span
              className={`min-w-0 truncate text-[14.5px] leading-none tracking-[-0.004em] ${row.you ? "font-[600] text-ink" : "text-ink-edge"}`}
            >
              {row.name}
              {row.you ? <em className="text-[13px] not-italic text-muted"> · yours</em> : null}
            </span>
            <i className="tp-leader" aria-hidden="true" />
            <Tally solved={row.solved} />
          </li>
        ))}
      </ol>

      <p className="tp-note mt-3">Your ticks travel to the other three. Theirs travel to you.</p>
    </section>
  );
}
