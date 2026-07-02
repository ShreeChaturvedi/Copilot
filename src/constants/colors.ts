/**
 * Shared color constants used across the application.
 *
 * Curated picker palette from the redesign brief (§2.4): equal lightness,
 * with the 155-205 hue band excluded so no user color impersonates the
 * app's aqua accent. All ten verified against the chip alpha-film formula.
 */

export const COLOR_PRESETS = [
  '#d8625c', // red      oklch(0.64 0.15 25)
  '#cf6f19', // orange   oklch(0.64 0.15 55)
  '#c0a320', // yellow   oklch(0.72 0.14 95)
  '#629f39', // green    oklch(0.64 0.15 135)
  '#0d97d5', // blue     oklch(0.64 0.145 235)
  '#6875d8', // indigo   oklch(0.60 0.15 275)
  '#a272d4', // violet   oklch(0.64 0.15 305)
  '#c265b0', // magenta  oklch(0.64 0.15 335)
  '#936b4a', // brown    oklch(0.56 0.07 60)
  '#789296', // slate    oklch(0.64 0.03 210)
] as const;

export type ColorPreset = (typeof COLOR_PRESETS)[number];

/** Default swatch for new lists/calendars (blue, matching the old default). */
export const DEFAULT_PRESET_COLOR: ColorPreset = '#0d97d5';
