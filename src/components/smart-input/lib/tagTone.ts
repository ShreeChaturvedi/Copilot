/**
 * Derives a fixed, tokenized display tone for a parsed tag from its
 * type/value — decoupled from `ParsedTag.color` (the parsers' own per-instance
 * hex, left untouched and still persisted with the task). This is what keeps
 * smart-input's tag highlighting inside foundation §1.6's accent-rationing
 * budget: five tones total, not one arbitrary hue per parser.
 */

import type { ParsedTag } from '@shared/types';

export type TagTone = 'aqua' | 'high' | 'medium' | 'low' | 'neutral';

export function tagTone(tag: Pick<ParsedTag, 'type' | 'value'>): TagTone {
  // date/time -> aqua: a parsed date resolves to a real due date, so the
  // input's live highlighting agrees with the aqua DueDateBadge it becomes.
  if (tag.type === 'date' || tag.type === 'time') return 'aqua';

  // priority -> three-tier severity on existing semantic tokens, not a new
  // hue: high maps to --destructive, medium to --warning, low stays neutral
  // (more legible than a fourth gray-as-hue).
  if (tag.type === 'priority') {
    const value = tag.value as 'high' | 'medium' | 'low';
    if (value === 'high') return 'high';
    if (value === 'medium') return 'medium';
    return 'low';
  }

  // person / location / label / project: no hue. Foundation §1.6 doesn't
  // sanction a fifth or sixth saturated color for non-priority, non-date
  // tags -- these differentiate by icon + label text instead.
  return 'neutral';
}
