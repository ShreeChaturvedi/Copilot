/**
 * L1 characterization tests for the boundary / DST / week-start behavior of
 * src/utils/date.ts. Complements the existing date.test.ts (which covers the
 * happy-path formatting) by pinning the timezone-sensitive edges the audit calls out.
 *
 * TZ = America/New_York: has DST (spring-forward 2026-03-08, fall-back 2026-11-01),
 * which is exactly what makes these functions worth pinning.
 */
process.env.TZ = 'America/New_York';

import { describe, it, expect } from 'vitest';
import {
  getWeekStart,
  createDateRange,
  getStartOfDayUTC,
  getEndOfDayUTC,
  isSameDay,
  getDuration,
} from '../date';

describe('date.ts boundaries / DST / week-start', () => {
  describe('getWeekStart (Monday as start of week)', () => {
    it('maps a mid-week day back to the same-week Monday, preserving time-of-day', () => {
      const ws = getWeekStart(new Date(2026, 0, 14, 12, 0, 0)); // Wed Jan 14 2026 noon
      expect(ws.getFullYear()).toBe(2026);
      expect(ws.getMonth() + 1).toBe(1);
      expect(ws.getDate()).toBe(12); // Monday Jan 12
      expect(ws.getDay()).toBe(1); // Monday
      expect(ws.getHours()).toBe(12); // time-of-day preserved
    });

    it('treats Sunday as belonging to the PREVIOUS week (Sunday -> prior Monday)', () => {
      const ws = getWeekStart(new Date(2026, 0, 18, 9, 0, 0)); // Sun Jan 18 2026
      expect(ws.getDate()).toBe(12); // Monday Jan 12, not Jan 19
      expect(ws.getDay()).toBe(1);
    });

    it('is idempotent for a Monday input', () => {
      const monday = new Date(2026, 0, 12, 0, 0, 0);
      const ws = getWeekStart(monday);
      expect(ws.getDate()).toBe(12);
      expect(ws.getDay()).toBe(1);
    });

    it('throws on an invalid date', () => {
      expect(() => getWeekStart(new Date('nonsense'))).toThrow('Invalid date provided to getWeekStart');
    });
  });

  describe('createDateRange across DST transitions', () => {
    it('spring-forward (2026-03-08): keeps local noon, UTC offset shifts -5 -> -4', () => {
      const range = createDateRange(new Date(2026, 2, 7, 12, 0, 0), 3);
      expect(range.map((d) => d.toISOString())).toEqual([
        '2026-03-07T17:00:00.000Z', // EST (-5)
        '2026-03-08T16:00:00.000Z', // EDT (-4) after spring-forward
        '2026-03-09T16:00:00.000Z',
      ]);
      // wall-clock hour is stable at noon each day despite the offset change
      expect(range.every((d) => d.getHours() === 12)).toBe(true);
    });

    it('fall-back (2026-11-01): keeps local noon, UTC offset shifts -4 -> -5', () => {
      const range = createDateRange(new Date(2026, 9, 31, 12, 0, 0), 3);
      expect(range.map((d) => d.toISOString())).toEqual([
        '2026-10-31T16:00:00.000Z', // EDT (-4)
        '2026-11-01T17:00:00.000Z', // EST (-5) after fall-back
        '2026-11-02T17:00:00.000Z',
      ]);
      expect(range.every((d) => d.getHours() === 12)).toBe(true);
    });

    it('returns [] for non-positive day counts or invalid start', () => {
      expect(createDateRange(new Date(2026, 0, 1), 0)).toEqual([]);
      expect(createDateRange(new Date(2026, 0, 1), -3)).toEqual([]);
      expect(createDateRange(new Date('bad'), 5)).toEqual([]);
    });
  });

  describe('start/end of day boundaries', () => {
    it('getStartOfDayUTC returns local midnight', () => {
      const sod = getStartOfDayUTC(new Date(2026, 0, 14, 15, 30, 0));
      expect(sod.toISOString()).toBe('2026-01-14T05:00:00.000Z'); // Jan 14 00:00 EST
      expect(sod.getHours()).toBe(0);
    });

    it('getEndOfDayUTC returns local 23:59:59.999', () => {
      const eod = getEndOfDayUTC(new Date(2026, 0, 14, 15, 30, 0));
      expect(eod.toISOString()).toBe('2026-01-15T04:59:59.999Z'); // Jan 14 23:59:59.999 EST
      expect(eod.getHours()).toBe(23);
      expect(eod.getMilliseconds()).toBe(999);
    });
  });

  describe('isSameDay / getDuration edges', () => {
    it('two very different times on the same local day are same-day', () => {
      expect(isSameDay(new Date(2026, 0, 14, 1, 0), new Date(2026, 0, 14, 23, 0))).toBe(true);
    });
    it('returns false for invalid inputs rather than throwing', () => {
      expect(isSameDay(new Date('x'), new Date(2026, 0, 14))).toBe(false);
    });
    it('getDuration formats mixed hours+minutes and whole hours', () => {
      expect(getDuration(new Date(2026, 0, 14, 9, 0), new Date(2026, 0, 14, 10, 30))).toBe('1h 30m');
      expect(getDuration(new Date(2026, 0, 14, 9, 0), new Date(2026, 0, 14, 11, 0))).toBe('2 hours');
    });
    it('getDuration handles sub-hour durations', () => {
      expect(getDuration(new Date(2026, 0, 14, 9, 0), new Date(2026, 0, 14, 9, 1))).toBe('1 minute');
      expect(getDuration(new Date(2026, 0, 14, 9, 0), new Date(2026, 0, 14, 9, 45))).toBe('45 minutes');
    });
  });
});
