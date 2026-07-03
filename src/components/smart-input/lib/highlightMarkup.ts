/**
 * Shared inline-highlight HTML builder for the two live mark-renderers
 * (HighlightedInputField, HighlightedTextareaField). Previously each field
 * carried its own near-identical copy of this logic, including a
 * `${tag.color}20`/`${tag.color}30` hex-alpha-suffix hack that only produced
 * valid CSS for 6-digit hex input and was theme-blind by construction (same
 * fixed percentage in light and dark). This version never touches
 * `tag.color` at all -- it emits a `data-tone` attribute that `smart-tags.css`
 * keys off of, so the fill is theme-adaptive for free.
 */

import type { ParsedTag } from '@shared/types';
import { tagTone } from './tagTone';

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function buildHighlightedHtml(
  value: string,
  tags: ParsedTag[],
  opts: { newlineToBr?: boolean } = {}
): string {
  if (!value || tags.length === 0) {
    const escaped = escapeHtml(value || '');
    return opts.newlineToBr ? escaped.replace(/\n/g, '<br>') : escaped;
  }

  const nl = (s: string) => (opts.newlineToBr ? s.replace(/\n/g, '<br>') : s);
  const sorted = [...tags].sort((a, b) => a.startIndex - b.startIndex);

  let html = '';
  let last = 0;

  for (const tag of sorted) {
    if (tag.startIndex > last) {
      html += nl(escapeHtml(value.substring(last, tag.startIndex)));
    }
    const text = value.substring(tag.startIndex, tag.endIndex);
    html += `<mark class="inline-highlight-span" data-tone="${tagTone(tag)}">${escapeHtml(text)}</mark>`;
    last = tag.endIndex;
  }

  if (last < value.length) {
    html += nl(escapeHtml(value.substring(last)));
  }

  return html;
}
