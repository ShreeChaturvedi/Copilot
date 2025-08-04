/**
 * Shared color constants used across the application
 */

export const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
] as const;

export type ColorPreset = typeof COLOR_PRESETS[number];