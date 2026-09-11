/**
 * The four shapes every interactive surface shares. Class strings rather than
 * components: the controls differ in element, state and aria, and only the
 * look is shared.
 *
 * The design draws a control as a rule and a label, never as a box — uppercase
 * Archivo pulled narrow and tracked out, sitting on an accent underline. The
 * underline weight is vocabulary: 2px is a link, 2.5px is something you
 * operate, which is why everything here carries 2.5 and the passive `CHIP`
 * carries none.
 *
 * Three things survive the restyle untouched, because they are why this file
 * exists rather than matters of taste. Every control clears the spec's 44 px
 * touch-target floor through `min-h-11` (Tailwind's 2.75rem). Everything
 * focusable carries a visible focus ring, which matters more now than it did
 * under the old pill: an outline is the only thing that marks out a control
 * whose resting state is a label and a hairline. And the field stays at
 * `text-base`.
 */

/**
 * Bottom-aligned against its own rule, the way the code slip's Open is. Hover
 * moves the label down onto the rule's colour rather than filling anything,
 * since a fill is the one thing this shape is defined by not being.
 */
export const CONTROL =
  "tp-fade tp-label inline-flex min-h-11 items-end gap-2 border-b-[2.5px] border-accent px-2 pb-2.5 text-[10.5px] font-bold tracking-[0.17em] text-ink uppercase hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The pressed state of a toggle. Every box metric is `CONTROL`'s to the pixel,
 * so a toggle never resizes under the thumb mid-tap; what changes is the fill
 * going pale accent and the label joining its own rule, which is the treatment
 * the design gives a live value everywhere else. The colour is never the whole
 * message — the label's word changes with it, and `aria-pressed` says so
 * outright.
 */
export const CONTROL_ON =
  "tp-fade tp-label inline-flex min-h-11 items-end gap-2 border-b-[2.5px] border-accent bg-accent-pale px-2 pb-2.5 text-[10.5px] font-bold tracking-[0.17em] text-accent uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * A status stamp, and the one place the fixed palette carries type. Glow is
 * 1.4:1 on the page ground, so it can only ever be a fill — but ink on glow is
 * better than 11:1, which is what makes the filled pill legible where the
 * green on its own would not be. No 44 px floor and no focus ring: nothing
 * here is tappable, so borrowing `CONTROL_ON` would size a label like a button
 * and promise a focus state that never arrives.
 */
export const CHIP =
  "tp-fade tp-label inline-flex items-center rounded-full bg-glow px-3 py-1 text-[10.5px] font-bold tracking-[0.17em] text-ink uppercase";

/**
 * A single-line field: a baseline rule with the text standing on it, mono and
 * tracked out because what goes in is a code rather than a word. The rule is
 * ink and not accent — a field is something you fill in, and the accent is
 * reserved for the Open beside it, which is the thing you operate. `text-base`
 * rather than the design's 15px: iOS zooms the whole page when a field under
 * 16px takes focus, and a page that jumps is worse than a field a point large.
 */
export const FIELD =
  "min-h-11 w-full border-b-[1.5px] border-ink px-2 pb-2.5 font-mono text-base tracking-[0.34em] text-ink placeholder:text-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
