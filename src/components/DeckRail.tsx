import { CARDS_PER_TIER, DECK_SIZE, TIERS, tierLabel } from "@/lib/tiers";

/**
 * The progress rail: sixty ticks in five groups of twelve, over the two figures
 * that say where you are. How far you got, how you did against par, and — in
 * the keys under the groups — where you stalled.
 *
 * A Server Component, prerendered with zeros and nothing lit, so the HTML is
 * already true before any JavaScript runs and a reader with none sees an empty
 * scorecard rather than a broken one. `DeckScore` fills it in afterwards from
 * the deck's own markup; nothing here reads a store or the mirror.
 *
 * The ticks carry the card number rather than a position, so the painter can
 * light one from a solved card without knowing how the deck is grouped. Tier
 * order is card order, which is what makes a gap in the middle of a group mean
 * the card you skipped and not an off-by-one.
 */

/** The tier as a rank, the way `CardHeader`'s pips put it. Five tiers, five
 *  numerals; a sixth tier would want a sixth here and the deck is closed. */
const RANKS = ["I", "II", "III", "IV", "V"];

export default function DeckRail() {
  return (
    <section data-deck-rail="" aria-label="Your progress" className="tp-railblock">
      {/* The label row is a header for two columns of figures, and read out
          loud in document order it would arrive two lines before the numbers
          it names. The figures carry their own words instead. */}
      <p className="tp-rail-labels" aria-hidden="true">
        <span>Solved</span>
        <span>Against par</span>
      </p>

      <p className="tp-rail-figures">
        {/* The joining word is drawn once and read once. Its padding is what
            separates the two figures on the page, and padding is not a space:
            without a real one in the text the line is read as "0of60". */}
        <span className="tp-rail-solved">
          <span className="sr-only">Solved </span>
          <b data-rail-solved="">0</b>
          <i aria-hidden="true">of</i>
          <span className="sr-only"> of </span>
          {DECK_SIZE}
        </span>
        <i className="tp-leader" aria-hidden="true" />
        {/* Two carriers, one state. The figure is `+46` or `E`; the word beside
            it is "46 over par" or "level with par", because a lone `E` is a
            convention a reader has to have been taught. `data-empty` ships set,
            since nothing counted is where every board starts. */}
        <span className="tp-rail-diff" data-rail-diff="" data-empty="">
          <span className="sr-only">, against par: </span>
          <i className="tp-rail-void" aria-hidden="true" />
          <span data-rail-diff-figure="" aria-hidden="true" />
          <span className="sr-only" data-rail-diff-word="">
            nothing counted yet
          </span>
        </span>
      </p>

      <div className="tp-rail" aria-hidden="true">
        {TIERS.map((tier, group) => (
          <span key={tier} className="tp-rail-group">
            {Array.from({ length: CARDS_PER_TIER }, (_, i) => group * CARDS_PER_TIER + i + 1).map(
              (n) => (
                <i key={n} className="tp-rail-tick" data-rail-tick={n} />
              ),
            )}
          </span>
        ))}
      </div>

      {/* The numeral is the rank the rail is grouped by and the name is what a
          reader without the rail in front of them needs, so the key reads
          "Beginner 10" aloud and stays four characters wide on the page. */}
      <ul className="tp-rail-keys">
        {TIERS.map((tier, group) => (
          <li key={tier}>
            <em aria-hidden="true">{RANKS[group]}</em>
            <span className="sr-only">{tierLabel(tier)} </span>
            <b data-rail-key={tier} data-zero="">
              0
            </b>
          </li>
        ))}
      </ul>
    </section>
  );
}
