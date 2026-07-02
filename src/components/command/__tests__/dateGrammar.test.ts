import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseDateGrammar, formatPlaceDate } from '../dateGrammar';

describe('parseDateGrammar (Cmd+K date grammar, brief §4.6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday, July 1, 2026, 12:00 local
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves "tomorrow 9am" with a time', () => {
    const offer = parseDateGrammar('Email vendor tomorrow 9am');
    expect(offer).not.toBeNull();
    expect(offer!.title).toBe('Email vendor');
    expect(offer!.hasTime).toBe(true);
    expect(offer!.when.getFullYear()).toBe(2026);
    expect(offer!.when.getMonth()).toBe(6);
    expect(offer!.when.getDate()).toBe(2);
    expect(offer!.when.getHours()).toBe(9);
    expect(offer!.display).toBe('Thu, Jul 2, 9:00 AM');
  });

  it('resolves a weekday without a time as date-only at midnight', () => {
    const offer = parseDateGrammar('Pay rent friday');
    expect(offer).not.toBeNull();
    expect(offer!.title).toBe('Pay rent');
    expect(offer!.hasTime).toBe(false);
    expect(offer!.when.getDate()).toBe(3); // Fri, Jul 3
    expect(offer!.when.getHours()).toBe(0);
    expect(offer!.display).toBe('Fri, Jul 3');
  });

  it('strips trailing connector words from the title', () => {
    const offer = parseDateGrammar('Ship design review on friday 4pm');
    expect(offer!.title).toBe('Ship design review');
    expect(offer!.display).toBe('Fri, Jul 3, 4:00 PM');
  });

  it('includes the year when the date resolves outside this year', () => {
    const offer = parseDateGrammar('Renew passport jan 5');
    expect(offer).not.toBeNull();
    expect(offer!.when.getFullYear()).toBe(2027); // forwardDate
    expect(offer!.display).toBe('Tue, Jan 5, 2027');
  });

  it('returns null when the query has no date', () => {
    expect(parseDateGrammar('open settings')).toBeNull();
  });

  it('returns null when the query is only a date (no title to place)', () => {
    expect(parseDateGrammar('tomorrow 9am')).toBeNull();
  });

  it('returns null for short or empty queries', () => {
    expect(parseDateGrammar('')).toBeNull();
    expect(parseDateGrammar('at')).toBeNull();
  });
});

describe('formatPlaceDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats date-only and dated-time forms', () => {
    expect(formatPlaceDate(new Date(2026, 6, 3), false)).toBe('Fri, Jul 3');
    expect(formatPlaceDate(new Date(2026, 6, 3, 14, 30), true)).toBe(
      'Fri, Jul 3, 2:30 PM'
    );
  });
});
