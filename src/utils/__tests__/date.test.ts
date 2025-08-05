/**
 * Unit tests for date utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  toUTC,
  formatForDisplay,
  formatRelative,
  parseToUTC,
  parseISOToDate,
  isSameDay,
  getDuration,
  createDateRange,
  nowUTC,
  todayUTC,
  formatForInput,
  formatTimeForInput,
  isValidDateString,
  getUserTimezone,
  DATE_FORMATS,
} from '../date';

// Mock timezone for consistent testing
const mockTimezone = 'America/New_York';

beforeEach(() => {
  // Mock Intl.DateTimeFormat to return consistent timezone
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
    resolvedOptions: () => ({ timeZone: mockTimezone }),
  } as Intl.DateTimeFormat));
});

describe('Date Utilities', () => {
  describe('getUserTimezone', () => {
    it('should return the mocked timezone', () => {
      expect(getUserTimezone()).toBe(mockTimezone);
    });
  });

  describe('toUTC', () => {
    it('should convert a date to UTC', () => {
      const localDate = new Date('2024-01-15T10:30:00');
      const utcDate = toUTC(localDate);
      
      expect(utcDate).toBeInstanceOf(Date);
      expect(utcDate.toISOString()).toBe(localDate.toISOString());
    });

    it('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => toUTC(invalidDate)).toThrow('Invalid date provided to toUTC');
    });
  });

  describe('parseISOToDate', () => {
    it('should parse valid ISO string', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const date = parseISOToDate(isoString);
      
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(isoString);
    });

    it('should throw error for invalid ISO string', () => {
      expect(() => parseISOToDate('invalid-date')).toThrow('Invalid ISO date string');
    });
  });

  describe('formatForDisplay', () => {
    it('should format valid date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatForDisplay(date);
      
      expect(typeof formatted).toBe('string');
      expect(formatted).not.toBe('Invalid Date');
    });

    it('should return "Invalid Date" for invalid date', () => {
      const invalidDate = new Date('invalid');
      const formatted = formatForDisplay(invalidDate);
      
      expect(formatted).toBe('Invalid Date');
    });

    it('should use custom format string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatForDisplay(date, 'yyyy-MM-dd');
      
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('formatRelative', () => {
    beforeEach(() => {
      // Mock current date for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('should return "Invalid Date" for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatRelative(invalidDate)).toBe('Invalid Date');
    });

    it('should format today correctly', () => {
      const today = new Date('2024-01-15T10:30:00Z');
      const formatted = formatRelative(today);
      
      expect(formatted).toContain('Today at');
    });
  });

  describe('parseToUTC', () => {
    it('should parse date and time strings to UTC', () => {
      const dateString = '2024-01-15';
      const timeString = '10:30';
      
      const utcDate = parseToUTC(dateString, timeString);
      
      expect(utcDate).toBeInstanceOf(Date);
    });

    it('should use default time when not provided', () => {
      const dateString = '2024-01-15';
      
      const utcDate = parseToUTC(dateString);
      
      expect(utcDate).toBeInstanceOf(Date);
    });

    it('should throw error for invalid date format', () => {
      expect(() => parseToUTC('invalid-date')).toThrow('Failed to parse date');
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day dates', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T20:00:00Z');
      
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different day dates', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-16T10:00:00Z');
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for invalid dates', () => {
      const validDate = new Date('2024-01-15T10:00:00Z');
      const invalidDate = new Date('invalid');
      
      expect(isSameDay(validDate, invalidDate)).toBe(false);
      expect(isSameDay(invalidDate, validDate)).toBe(false);
    });
  });

  describe('getDuration', () => {
    it('should return duration in hours and minutes', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T12:30:00Z');
      
      const duration = getDuration(start, end);
      
      expect(duration).toBe('2h 30m');
    });

    it('should return duration in minutes only', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T10:30:00Z');
      
      const duration = getDuration(start, end);
      
      expect(duration).toBe('30 minutes');
    });

    it('should return duration in hours only', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T12:00:00Z');
      
      const duration = getDuration(start, end);
      
      expect(duration).toBe('2 hours');
    });

    it('should handle singular forms', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T11:01:00Z');
      
      const duration = getDuration(start, end);
      
      expect(duration).toBe('1h 1m');
    });

    it('should return "Invalid duration" for invalid dates', () => {
      const validDate = new Date('2024-01-15T10:00:00Z');
      const invalidDate = new Date('invalid');
      
      expect(getDuration(validDate, invalidDate)).toBe('Invalid duration');
      expect(getDuration(invalidDate, validDate)).toBe('Invalid duration');
    });
  });

  describe('createDateRange', () => {
    it('should create array of consecutive dates', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const range = createDateRange(start, 3);
      
      expect(range).toHaveLength(3);
      expect(range[0]).toEqual(start);
      expect(range[1]).toEqual(new Date('2024-01-16T00:00:00Z'));
      expect(range[2]).toEqual(new Date('2024-01-17T00:00:00Z'));
    });

    it('should return empty array for invalid input', () => {
      const invalidDate = new Date('invalid');
      
      expect(createDateRange(invalidDate, 3)).toEqual([]);
      expect(createDateRange(new Date(), 0)).toEqual([]);
      expect(createDateRange(new Date(), -1)).toEqual([]);
    });
  });

  describe('formatForInput', () => {
    it('should format date for HTML input', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatForInput(date);
      
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should return empty string for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatForInput(invalidDate)).toBe('');
    });
  });

  describe('formatTimeForInput', () => {
    it('should format time for HTML input', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatTimeForInput(date);
      
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('should return empty string for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatTimeForInput(invalidDate)).toBe('');
    });
  });

  describe('isValidDateString', () => {
    it('should return true for valid ISO date string', () => {
      expect(isValidDateString('2024-01-15T10:30:00Z')).toBe(true);
      expect(isValidDateString('2024-01-15')).toBe(true);
    });

    it('should return false for invalid date string', () => {
      expect(isValidDateString('invalid-date')).toBe(false);
      expect(isValidDateString('')).toBe(false);
    });
  });

  describe('nowUTC', () => {
    it('should return current date', () => {
      const now = nowUTC();
      const currentTime = new Date();
      
      expect(now).toBeInstanceOf(Date);
      // Allow for small time difference in test execution
      expect(Math.abs(now.getTime() - currentTime.getTime())).toBeLessThan(1000);
    });
  });

  describe('todayUTC', () => {
    it('should return start of today in UTC', () => {
      const today = todayUTC();
      
      expect(today).toBeInstanceOf(Date);
    });
  });

  describe('DATE_FORMATS', () => {
    it('should have all expected format constants', () => {
      expect(DATE_FORMATS.DISPLAY).toBe('PPP');
      expect(DATE_FORMATS.DISPLAY_WITH_TIME).toBe('PPP p');
      expect(DATE_FORMATS.TIME_ONLY).toBe('p');
      expect(DATE_FORMATS.INPUT_DATE).toBe('yyyy-MM-dd');
      expect(DATE_FORMATS.INPUT_TIME).toBe('HH:mm');
      expect(DATE_FORMATS.SHORT).toBe('MMM d');
      expect(DATE_FORMATS.SHORT_WITH_YEAR).toBe('MMM d, yyyy');
    });
  });
});