/**
 * The two control shapes every interactive surface shares. Both clear the
 * spec's 44 px touch-target floor through `min-h-11` (Tailwind's 2.75rem), and
 * both carry a visible focus ring, since the diagram controls, the code field
 * and the solve toggle are the whole of the site's interaction.
 *
 * Class strings rather than components: the controls differ in element, state
 * and aria, and only the look is shared.
 */
export const CONTROL =
  "tp-fade inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The pressed state of a toggle: the filled glow-green chip. */
export const CONTROL_ON =
  "tp-fade inline-flex min-h-11 items-center gap-2 rounded-full border border-glow bg-glow px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * A status chip: the same glow fill as a pressed toggle, without a control's
 * 44 px floor or focus ring. Nothing here is tappable or focusable, so
 * inheriting `CONTROL_ON` would size a label like a button and promise a focus
 * state that never arrives.
 */
export const CHIP =
  "tp-fade inline-flex items-center rounded-full bg-glow px-3 py-1 text-sm font-semibold text-ink";

/** A single-line text field, sized to match CONTROL. `text-base` keeps iOS from
 *  zooming the page when the code field takes focus. */
export const FIELD =
  "min-h-11 w-full rounded-xl border border-ink/15 bg-ground px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
