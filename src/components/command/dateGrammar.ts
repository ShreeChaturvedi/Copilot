/**
 * Date grammar for the Cmd+K palette (design-brief §4.6).
 *
 * Reuses the app's real parser (ChronoDateParser, the same engine behind the
 * smart input) — never a duplicate date implementation. Typing
 * "Email vendor tomorrow 9am" resolves to a Place offer that creates a real
 * task with that due date.
 */
import { ChronoDateParser } from '@/components/smart-input/parsers/ChronoDateParser';

export interface PlaceOffer {
  /** Task title with the date expression removed */
  title: string;
  /** Resolved due date */
  when: Date;
  /** Whether the expression carried a clock time */
  hasTime: boolean;
  /** Human form, e.g. "Wed, Jul 2, 9:00 AM" */
  display: string;
}

const parser = new ChronoDateParser();

/** Trailing connector words left behind when the date span is removed */
const TRAILING_CONNECTORS = /\s+(on|at|by|for|due|until)$/i;

export function formatPlaceDate(when: Date, hasTime: boolean): string {
  const now = new Date();
  const datePart = when.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: when.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  if (!hasTime) return datePart;
  const timePart = when.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

/**
 * Parse a palette query for a date expression. Returns a Place offer when the
 * query contains both a resolvable date and a nonempty task title, else null.
 */
export function parseDateGrammar(query: string): PlaceOffer | null {
  const text = query.trim();
  if (text.length < 3) return null;

  let tags;
  try {
    tags = parser.parse(text);
  } catch {
    return null;
  }

  // First start tag wins (end-of-range tags carry an "Until ..." display)
  const tag = tags.find(
    (t) =>
      (t.type === 'date' || t.type === 'time') &&
      t.value instanceof Date &&
      !t.displayText.startsWith('Until')
  );
  if (!tag) return null;

  const title = (text.slice(0, tag.startIndex) + ' ' + text.slice(tag.endIndex))
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(TRAILING_CONNECTORS, '');
  if (!title) return null;

  const hasTime = tag.type === 'time';
  const when = tag.value as Date;

  return { title, when, hasTime, display: formatPlaceDate(when, hasTime) };
}
