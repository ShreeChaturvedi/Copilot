/**
 * L1 characterization tests for ChronoDateParser (src/components/smart-input/parsers/ChronoDateParser.ts).
 *
 * These pin "now" with fake timers so relative dates are deterministic, and assert the
 * CURRENT behavior of the chrono-node-backed parser (not what it "should" ideally do).
 * TZ is pinned to America/New_York (matches the dev machine and the existing date.test.ts mock)
 * so ISO/offset-sensitive expectations are reproducible.
 */
process.env.TZ = 'America/New_York';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChronoDateParser } from '../ChronoDateParser';

// Wed Jan 14 2026, 12:00 local (mid-week reference)
const WED = new Date(2026, 0, 14, 12, 0, 0);
// Thu Dec 31 2026, 12:00 local (year-boundary reference)
const YEAR_END = new Date(2026, 11, 31, 12, 0, 0);

const parser = new ChronoDateParser();

interface Local {
  y: number;
  mo: number; // 1-based
  d: number;
  h?: number;
  min?: number;
}

function localOf(date: Date): Local {
  return {
    y: date.getFullYear(),
    mo: date.getMonth() + 1,
    d: date.getDate(),
    h: date.getHours(),
    min: date.getMinutes(),
  };
}

describe('ChronoDateParser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WED);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('test()', () => {
    it.each([
      ['tomorrow', true],
      ['next friday at 2pm', true],
      ['Dec 25', true],
      ['16:00', true],
      ['just a plain title', false],
      ['end of month', false], // chrono does not resolve this phrase
      ['', false],
    ])('test(%j) === %s', (input, expected) => {
      expect(parser.test(input)).toBe(expected);
    });
  });

  describe('relative dates at mid-week reference (Wed 2026-01-14)', () => {
    // [input, type, expected local, displayText, span, originalText, confidence]
    const cases: Array<[string, 'date' | 'time', Local, string, [number, number], string, number]> = [
      ['tomorrow', 'date', { y: 2026, mo: 1, d: 15, h: 0, min: 0 }, 'Tomorrow', [0, 8], 'tomorrow', 0.95],
      ['today', 'date', { y: 2026, mo: 1, d: 14, h: 0, min: 0 }, 'Today', [0, 5], 'today', 0.95],
      // NOTE: "yesterday" resolves to the correct date (Jan 13) but the display falls through
      // to an absolute label because formatDisplayText only special-cases today/tomorrow/forward-week.
      ['yesterday', 'date', { y: 2026, mo: 1, d: 13, h: 0, min: 0 }, 'Jan 13', [0, 9], 'yesterday', 0.9],
      // chrono's "next friday" means the Friday of NEXT week (Jan 23), not the coming Friday (Jan 16).
      ['next friday', 'date', { y: 2026, mo: 1, d: 23, h: 0, min: 0 }, 'Jan 23', [0, 11], 'next friday', 0.7],
      ['friday', 'date', { y: 2026, mo: 1, d: 16, h: 0, min: 0 }, 'Friday', [0, 6], 'friday', 0.7],
      ['monday', 'date', { y: 2026, mo: 1, d: 19, h: 0, min: 0 }, 'Monday', [0, 6], 'monday', 0.7],
      ['next week', 'date', { y: 2026, mo: 1, d: 21, h: 0, min: 0 }, 'Wednesday', [0, 9], 'next week', 0.95],
      ['in 3 days', 'date', { y: 2026, mo: 1, d: 17, h: 0, min: 0 }, 'Saturday', [0, 9], 'in 3 days', 0.95],
      ['in 2 weeks', 'date', { y: 2026, mo: 1, d: 28, h: 0, min: 0 }, 'Jan 28', [0, 10], 'in 2 weeks', 0.95],
      ['this weekend', 'date', { y: 2026, mo: 1, d: 17, h: 0, min: 0 }, 'Saturday', [0, 12], 'this weekend', 0.7],
    ];

    it.each(cases)('%j', (input, type, expected, display, span, orig, conf) => {
      const tags = parser.parse(input);
      expect(tags).toHaveLength(1);
      const [tag] = tags;
      expect(tag.type).toBe(type);
      expect(tag.value).toBeInstanceOf(Date);
      expect(localOf(tag.value as Date)).toMatchObject(expected);
      expect(tag.displayText).toBe(display);
      expect([tag.startIndex, tag.endIndex]).toEqual(span);
      expect(tag.originalText).toBe(orig);
      expect(tag.confidence).toBeCloseTo(conf, 5);
      expect(tag.source).toBe('chrono-date-parser');
      expect(tag.iconName).toBe('Calendar');
    });
  });

  describe('times and date+time combos (Wed 2026-01-14)', () => {
    const cases: Array<[string, Local, string, [number, number], string, number]> = [
      ['tomorrow 2pm', { y: 2026, mo: 1, d: 15, h: 14, min: 0 }, 'Tomorrow at 2:00 PM', [0, 12], 'tomorrow 2pm', 1.0],
      ['at 4pm', { y: 2026, mo: 1, d: 14, h: 16, min: 0 }, 'Today at 4:00 PM', [0, 6], 'at 4pm', 0.85],
      ['16:00', { y: 2026, mo: 1, d: 14, h: 16, min: 0 }, 'Today at 4:00 PM', [0, 5], '16:00', 0.85],
      ['noon', { y: 2026, mo: 1, d: 14, h: 12, min: 0 }, 'Today at 12:00 PM', [0, 4], 'noon', 0.8],
      ['midnight', { y: 2026, mo: 1, d: 15, h: 0, min: 0 }, 'Tomorrow at 12:00 AM', [0, 8], 'midnight', 0.8],
      ['next monday at 9am', { y: 2026, mo: 1, d: 19, h: 9, min: 0 }, 'Monday at 9:00 AM', [0, 18], 'next monday at 9am', 0.85],
    ];

    it.each(cases)('%j -> time tag', (input, expected, display, span, orig, conf) => {
      const tags = parser.parse(input);
      expect(tags).toHaveLength(1);
      const [tag] = tags;
      expect(tag.type).toBe('time');
      expect(tag.iconName).toBe('Clock');
      expect(localOf(tag.value as Date)).toMatchObject(expected);
      expect(tag.displayText).toBe(display);
      expect([tag.startIndex, tag.endIndex]).toEqual(span);
      expect(tag.originalText).toBe(orig);
      expect(tag.confidence).toBeCloseTo(conf, 5);
    });

    it('embeds the time span within a multi-token title (offset preserved)', () => {
      const tags = parser.parse('meeting at 3:30pm');
      expect(tags).toHaveLength(1);
      const [tag] = tags;
      expect(tag.type).toBe('time');
      expect(localOf(tag.value as Date)).toMatchObject({ h: 15, min: 30 });
      // span points at "at 3:30pm", not the leading word "meeting"
      expect([tag.startIndex, tag.endIndex]).toEqual([8, 17]);
      expect(tag.originalText).toBe('at 3:30pm');
    });
  });

  describe('absolute dates', () => {
    it('Dec 25 resolves within the current year, date-only', () => {
      const [tag] = parser.parse('Dec 25');
      expect(tag.type).toBe('date');
      expect(localOf(tag.value as Date)).toMatchObject({ y: 2026, mo: 12, d: 25, h: 0, min: 0 });
      expect(tag.displayText).toBe('Dec 25');
      expect(tag.confidence).toBeCloseTo(0.8, 5);
    });

    it('explicit "January 1 2027" is a fully-certain date (high confidence)', () => {
      const [tag] = parser.parse('January 1 2027');
      expect(localOf(tag.value as Date)).toMatchObject({ y: 2027, mo: 1, d: 1 });
      expect(tag.displayText).toBe('Jan 1, 2027'); // includes year because != current year
      expect(tag.confidence).toBeCloseTo(0.95, 5);
    });

    it('ISO date 2026-03-15 is normalized to local midnight (crosses into EDT)', () => {
      const [tag] = parser.parse('2026-03-15');
      expect(tag.type).toBe('date');
      expect(localOf(tag.value as Date)).toMatchObject({ y: 2026, mo: 3, d: 15, h: 0, min: 0 });
      // March 15 is inside US EDT, so local midnight is 04:00Z
      expect((tag.value as Date).toISOString()).toBe('2026-03-15T04:00:00.000Z');
    });
  });

  describe('date ranges', () => {
    it('"from monday to friday" yields a start tag and an "Until" end tag sharing the same span', () => {
      const tags = parser.parse('from monday to friday');
      expect(tags).toHaveLength(2);
      const [start, end] = tags;
      expect(localOf(start.value as Date)).toMatchObject({ y: 2026, mo: 1, d: 19 }); // Monday Jan 19
      expect(start.displayText).toBe('Monday');
      expect(localOf(end.value as Date)).toMatchObject({ y: 2026, mo: 1, d: 23 }); // Friday Jan 23
      expect(end.displayText).toBe('Until Jan 23');
      // Both tags share the matched span [5,21] ("monday to friday") and original text.
      expect([start.startIndex, start.endIndex]).toEqual([5, 21]);
      expect([end.startIndex, end.endIndex]).toEqual([5, 21]);
      expect(start.originalText).toBe('monday to friday');
      expect(end.originalText).toBe('monday to friday');
    });
  });

  describe('durations are NOT extracted as durations (chrono reads them as relative times)', () => {
    // Documents a known limitation: there is no duration parser, so "90min"/"1.5h"
    // are interpreted by chrono as "now + 90 minutes" / "now + 1.5 hours".
    it('"90min" -> now + 90 minutes (13:30 today)', () => {
      const [tag] = parser.parse('90min');
      expect(tag.type).toBe('time');
      expect(localOf(tag.value as Date)).toMatchObject({ y: 2026, mo: 1, d: 14, h: 13, min: 30 });
    });
    it('"1.5h" -> now + 1.5 hours (13:30 today)', () => {
      const [tag] = parser.parse('1.5h');
      expect(tag.type).toBe('time');
      expect(localOf(tag.value as Date)).toMatchObject({ h: 13, min: 30 });
    });
  });

  describe('ambiguous / garbage input', () => {
    it.each([
      'end of month',
      'asdf qwer zxcv',
      'buy the milk',
      '',
      '   ',
    ])('parse(%j) yields no tags', (input) => {
      expect(parser.parse(input)).toEqual([]);
    });
  });

  describe('year-boundary reference (Thu 2026-12-31)', () => {
    beforeEach(() => {
      vi.setSystemTime(YEAR_END);
    });

    it.each<[string, Local, string]>([
      ['tomorrow', { y: 2027, mo: 1, d: 1 }, 'Tomorrow'],
      ['today', { y: 2026, mo: 12, d: 31 }, 'Today'],
      ['friday', { y: 2027, mo: 1, d: 1 }, 'Tomorrow'], // the coming Friday is Jan 1 2027
      ['next friday', { y: 2027, mo: 1, d: 8 }, 'Jan 8, 2027'],
      ['next week', { y: 2027, mo: 1, d: 7 }, 'Thursday'],
      ['in 3 days', { y: 2027, mo: 1, d: 3 }, 'Sunday'],
    ])('%j crosses the year boundary correctly', (input, expected, display) => {
      const tags = parser.parse(input);
      expect(tags).toHaveLength(1);
      expect(localOf(tags[0].value as Date)).toMatchObject(expected);
      expect(tags[0].displayText).toBe(display);
    });

    it('"Jan 1" with forwardDate resolves to next year (2027-01-01)', () => {
      const [tag] = parser.parse('Jan 1');
      expect(localOf(tag.value as Date)).toMatchObject({ y: 2027, mo: 1, d: 1 });
    });
  });
});
