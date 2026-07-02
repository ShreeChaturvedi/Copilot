/**
 * L1 characterization tests for src/utils/dateGrouping.ts (previously untested).
 *
 * getDayKey / isItemOverdue / filterUpcomingItems all read `new Date()`, so "now"
 * is pinned with fake timers to Wed 2026-01-14 12:00 local (America/New_York).
 */
process.env.TZ = 'America/New_York';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDayKey,
  getDayKeyOrder,
  getTimeString,
  isItemOverdue,
  filterUpcomingItems,
  groupItemsByDate,
} from '../dateGrouping';

const WED = new Date(2026, 0, 14, 12, 0, 0);

describe('dateGrouping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WED);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getDayKey', () => {
    it.each<[string, Date | null, string]>([
      ['null date', null, 'No Due Date'],
      ['a past day', new Date(2026, 0, 10), 'Overdue'],
      ['today', new Date(2026, 0, 14, 15, 0), 'Today'],
      ['tomorrow', new Date(2026, 0, 15, 9, 0), 'Tomorrow'],
      ['later this week', new Date(2026, 0, 16, 9, 0), 'Friday'],
      ['sunday (this week, Monday-start)', new Date(2026, 0, 18, 9, 0), 'Sunday'],
      ['beyond this week', new Date(2026, 1, 20, 9, 0), 'Feb 20'],
    ])('%s -> %s', (_label, date, expected) => {
      expect(getDayKey(date)).toBe(expected);
    });

    it('classifies earlier-today (before now) as Today, not Overdue', () => {
      // 09:00 today is before "now" (12:00) but isToday wins over the past-check.
      expect(getDayKey(new Date(2026, 0, 14, 9, 0))).toBe('Today');
    });
  });

  describe('getDayKeyOrder', () => {
    it('orders known buckets, then date strings, with No Due Date last', () => {
      expect(getDayKeyOrder(['Jan 15', 'No Due Date', 'Today', 'Overdue', 'Friday', 'Tomorrow'])).toEqual([
        'Overdue',
        'Today',
        'Tomorrow',
        'Friday',
        'Jan 15',
        'No Due Date',
      ]);
    });

    it('sorts multiple unknown date strings alphabetically among themselves', () => {
      const ordered = getDayKeyOrder(['Mar 2', 'Feb 20', 'Today']);
      expect(ordered[0]).toBe('Today');
      expect(ordered.slice(1)).toEqual(['Feb 20', 'Mar 2']);
    });
  });

  describe('getTimeString', () => {
    it('formats a time, honors allDay, and returns "" for null', () => {
      expect(getTimeString(new Date(2026, 0, 14, 15, 30))).toBe('3:30 PM');
      expect(getTimeString(new Date(2026, 0, 14, 15, 30), true)).toBe('All day');
      expect(getTimeString(null)).toBe('');
    });
  });

  describe('isItemOverdue', () => {
    it('is true only for dates strictly before the start of today', () => {
      expect(isItemOverdue(new Date(2026, 0, 10))).toBe(true);
      expect(isItemOverdue(new Date(2026, 0, 20))).toBe(false);
      expect(isItemOverdue(new Date(2026, 0, 14, 0, 0))).toBe(false); // start of today, not overdue
      expect(isItemOverdue(null)).toBe(false);
    });
  });

  describe('filterUpcomingItems', () => {
    interface Item {
      d: Date | null;
    }
    const items: Item[] = [
      { d: new Date(2026, 0, 10) }, // past -> dropped
      { d: new Date(2026, 0, 20) }, // future -> kept
      { d: null }, // no date -> kept
      { d: new Date(2026, 0, 14, 15, 0) }, // today -> kept
    ];

    it('drops past-dated items, keeps today/future and no-date items, sorted by date', () => {
      const result = filterUpcomingItems(items, (i) => i.d);
      expect(result.map((i) => (i.d ? i.d.getDate() : 'none'))).toEqual([14, 20, 'none']);
    });

    it('honors maxItems', () => {
      const result = filterUpcomingItems(items, (i) => i.d, 1);
      expect(result).toHaveLength(1);
      expect(result[0].d?.getDate()).toBe(14);
    });
  });

  describe('groupItemsByDate', () => {
    it('buckets items under their day keys', () => {
      const items = [
        { id: 'a', d: new Date(2026, 0, 14, 9, 0) }, // Today
        { id: 'b', d: new Date(2026, 0, 15, 9, 0) }, // Tomorrow
        { id: 'c', d: null }, // No Due Date
        { id: 'd', d: new Date(2026, 0, 14, 18, 0) }, // Today
      ];
      const grouped = groupItemsByDate(items, (i) => i.d);
      expect(Object.keys(grouped).sort()).toEqual(['No Due Date', 'Today', 'Tomorrow']);
      expect(grouped['Today'].map((i) => i.id)).toEqual(['a', 'd']);
      expect(grouped['No Due Date'].map((i) => i.id)).toEqual(['c']);
    });
  });
});
