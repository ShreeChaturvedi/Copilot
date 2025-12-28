import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, generateId, truncateMiddle } from '../index';

describe('shared utils', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('formats dates as ISO strings', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(formatDate(date)).toBe('2024-01-01T00:00:00.000Z');
  });

  it('generates IDs from random data and current time', () => {
    vi.useFakeTimers();
    const fixed = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(fixed);

    const randomValue = 0.12345;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(randomValue);

    const id = generateId();
    const expected =
      randomValue.toString(36).substring(2) + fixed.getTime().toString(36);

    expect(id).toBe(expected);
    expect(randomSpy).toHaveBeenCalledOnce();
  });

  it('truncates long strings in the middle', () => {
    expect(truncateMiddle('abcdefghij', 7, { preserveExtension: false })).toBe(
      'ab...ij'
    );
  });

  it('preserves file extensions when truncating', () => {
    expect(truncateMiddle('report-final.pdf', 12)).toBe('rep...al.pdf');
  });

  it('falls back to extension-only when the budget is too small', () => {
    expect(truncateMiddle('verylongname.ext', 6)).toBe('...ext');
  });
});
