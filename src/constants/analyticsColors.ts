/**
 * Shared task-analytics chart palette — the single source of truth for
 * "what color is a done / in-progress / not-started (etc.) task."
 *
 * Previously two hand-maintained copies existed: one in
 * `tasks/TaskAnalyticsSummary.tsx` (hand-derived hex pairs behind a
 * `resolvedTheme` subscription) and one in `dialogs/TaskAnalyticsDialog.tsx`
 * (a `var(--…)` map). The `var(--…)` approach is correct and proven: CSS custom
 * properties DO resolve inside Recharts SVG `fill`/`stroke` props, so both
 * themes stay in sync automatically with zero JS branching. This constant
 * hoists that map so consumers import one palette instead of re-deriving it.
 *
 * Note: the `#…` fallbacks inside `var(--token, #…)` exist only for the rare
 * case the custom property is unavailable; the tokens themselves already flip
 * per theme in `src/index.css`.
 */

/** The three core status colors every analytics surface shares. */
export const ANALYTICS_STATUS_COLORS = {
  done: 'var(--aqua, #1a7c70)', // success / completed
  inProgress: 'var(--warning, #d6a62e)', // in-progress amber
  notStarted: 'var(--faint, #94a1a3)', // not-started, muted
} as const;

/**
 * Full analytics palette: the three status colors plus the two extra keys the
 * dialog uses for its time-series charts.
 */
export const ANALYTICS_COLORS = {
  ...ANALYTICS_STATUS_COLORS,
  created: '#0d97d5', // curated blue (= DEFAULT_PRESET_COLOR), a fixed palette hue
  overdue: 'var(--destructive, #d8625c)', // overdue / urgent, red only
} as const;

export type AnalyticsColorKey = keyof typeof ANALYTICS_COLORS;
