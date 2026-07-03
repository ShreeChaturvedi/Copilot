/**
 * Motion constants — the JS mirror of the SETTLE motion tokens in
 * `src/index.css`. Use these anywhere motion is driven from JavaScript
 * (framer-motion transitions, setTimeout-orchestrated sequences) so the
 * timing/curves stay in lockstep with the CSS token contract instead of being
 * re-derived per component.
 *
 * Foundation-spec §3: `--ease-settle` is THE brand entrance/settle curve;
 * `--ease-out` is the exit/collapse/fast-interaction curve. No third bezier.
 */

/**
 * Cubic-bezier control points as framer-motion-compatible tuples.
 * framer-motion accepts `ease: [x1, y1, x2, y2]` for a custom cubic-bezier,
 * matching CSS `cubic-bezier(x1, y1, x2, y2)` exactly.
 */
export const EASE_SETTLE = [0.16, 1, 0.3, 1] as const; // --ease-settle (brand entrance/settle)
export const EASE_OUT = [0.25, 1, 0.5, 1] as const; // --ease-out (exit/collapse/fast)

/** Duration bands in milliseconds — mirror of --dur-1..5. */
export const DUR_1 = 100; // press/active states
export const DUR_2 = 150; // hover/focus swaps, tooltip open
export const DUR_3 = 240; // dialog/sheet settle-in, popover open, hover lift
export const DUR_4 = 320; // pane/page transitions, card travel + drop-settle
export const DUR_5 = 480; // signature moments only

/** Same bands in seconds — framer-motion's `transition.duration` is in seconds. */
export const DUR_1_S = DUR_1 / 1000;
export const DUR_2_S = DUR_2 / 1000;
export const DUR_3_S = DUR_3 / 1000;
export const DUR_4_S = DUR_4 / 1000;
export const DUR_5_S = DUR_5 / 1000;

/** Convenience maps for indexed access. */
export const EASE = {
  settle: EASE_SETTLE,
  out: EASE_OUT,
} as const;

export const DUR_MS = {
  1: DUR_1,
  2: DUR_2,
  3: DUR_3,
  4: DUR_4,
  5: DUR_5,
} as const;

export const DUR_S = {
  1: DUR_1_S,
  2: DUR_2_S,
  3: DUR_3_S,
  4: DUR_4_S,
  5: DUR_5_S,
} as const;
