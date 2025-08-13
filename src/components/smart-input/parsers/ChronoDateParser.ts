/**
 * Date and time parser using Chrono.js for natural language processing
 */

import * as chrono from 'chrono-node';
import { Parser, ParsedTag } from "@shared/types";
import { v4 as uuidv4 } from 'uuid';

interface ChronoParseComponent {
  isCertain(component: string): boolean;
  date(): Date;
}

interface ChronoParseResult {
  start: ChronoParseComponent;
  end?: ChronoParseComponent;
  text: string;
  index: number;
}

export class ChronoDateParser implements Parser {
  readonly id = 'chrono-date-parser';
  readonly name = 'Date/Time Parser';
  readonly priority = 10; // Highest priority for date parsing

  /**
   * Test if the text contains potential date/time expressions
   */
  test(text: string): boolean {
    const results = chrono.parse(text, new Date(), { forwardDate: true });
    if (results.length > 0) return true;
    // Also test custom ordinal weekday-of-month patterns
    return this.findOrdinalDowMatches(text).length > 0;
  }

  /**
   * Parse the text and extract date/time information
   */
  parse(text: string): ParsedTag[] {
    const tags: ParsedTag[] = [];
    const results = chrono.parse(text, new Date(), { forwardDate: true });

    for (const result of results) {
      const startDate = result.start.date();
      const endDate = result.end?.date();

      // Determine if this is a date-only or date+time expression
      const hasTime =
        result.start.isCertain('hour') || result.start.isCertain('minute');
      const isDateRange = !!result.end;

      // Create date tag
      if (startDate) {
        const dateTag: ParsedTag = {
          id: uuidv4(),
          type: hasTime ? 'time' : 'date',
          value: startDate,
          displayText: this.formatDisplayText(startDate, hasTime),
          iconName: hasTime ? 'Clock' : 'Calendar',
          startIndex: result.index,
          endIndex: result.index + result.text.length,
          originalText: result.text,
          confidence: this.calculateConfidence(result),
          source: this.id,
          color: '#3b82f6', // Blue color for dates
        };

        tags.push(dateTag);

        // If it's a date range, create a separate end date tag
        if (
          isDateRange &&
          endDate &&
          endDate.getTime() !== startDate.getTime()
        ) {
          const endTag: ParsedTag = {
            id: uuidv4(),
            type: hasTime ? 'time' : 'date',
            value: endDate,
            displayText: `Until ${this.formatDisplayText(endDate, hasTime)}`,
            iconName: hasTime ? 'Clock' : 'Calendar',
            startIndex: result.index,
            endIndex: result.index + result.text.length,
            originalText: result.text,
            confidence: this.calculateConfidence(result),
            source: this.id,
            color: '#3b82f6',
          };

          tags.push(endTag);
        }
      }
    }

    // Add custom ordinal weekday-of-month parsing if not already covered by chrono
    const existingRanges = tags.map(t => ({ start: t.startIndex, end: t.endIndex }));
    const overlaps = (s: number, e: number) => existingRanges.some(r => s < r.end && e > r.start);
    const customMatches = this.findOrdinalDowMatches(text);
    for (const m of customMatches) {
      if (!overlaps(m.index, m.index + m.text.length)) {
        const dateOnly = m.date;
        tags.push({
          id: uuidv4(),
          type: 'date',
          value: dateOnly,
          displayText: this.formatDisplayText(dateOnly, false),
          iconName: 'Calendar',
          startIndex: m.index,
          endIndex: m.index + m.text.length,
          originalText: m.text,
          confidence: 0.85,
          source: this.id,
          color: '#3b82f6',
        });
        existingRanges.push({ start: m.index, end: m.index + m.text.length });
      }
    }

    return tags;
  }

  /**
   * Calculate confidence score based on Chrono parsing result
   */
  private calculateConfidence(result: ChronoParseResult): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if more components are certain
    const certainComponents = ['year', 'month', 'day', 'hour', 'minute'].filter(
      (component) => result.start.isCertain(component)
    );

    confidence += certainComponents.length * 0.05;

    // Increase confidence for explicit dates
    if (
      result.start.isCertain('year') &&
      result.start.isCertain('month') &&
      result.start.isCertain('day')
    ) {
      confidence += 0.1;
    }

    // Increase confidence for time components
    if (result.start.isCertain('hour')) {
      confidence += 0.05;
    }

    // Decrease confidence for very ambiguous expressions
    if (result.text.length < 3) {
      confidence -= 0.2;
    }

    // Slightly decrease confidence for past dates (they might be less relevant)
    const startDate = result.start.date();
    if (startDate && this.isInPast(startDate)) {
      confidence -= 0.05;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Format display text for the tag
   */
  private formatDisplayText(date: Date, hasTime: boolean): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    // Check for relative dates
    if (dateOnly.getTime() === today.getTime()) {
      return hasTime ? `Today at ${this.formatTime(date)}` : 'Today';
    }

    if (dateOnly.getTime() === tomorrow.getTime()) {
      return hasTime ? `Tomorrow at ${this.formatTime(date)}` : 'Tomorrow';
    }

    // Check if it's this week
    const daysDiff = Math.floor(
      (dateOnly.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysDiff >= 0 && daysDiff <= 7) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return hasTime ? `${dayName} at ${this.formatTime(date)}` : dayName;
    }

    // Format as date
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });

    return hasTime ? `${dateStr} at ${this.formatTime(date)}` : dateStr;
  }

  /**
   * Format time portion of a date
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Check if a date is in the past (for confidence adjustment)
   */
  private isInPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Find ordinal weekday-of-month expressions and compute dates
   */
  private findOrdinalDowMatches(text: string): Array<{ text: string; index: number; date: Date }> {
    const ordinals: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
    };
    const weekdays: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };

    const results: Array<{ text: string; index: number; date: Date }> = [];
    const now = new Date();
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth();

    const pattern = /\b(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:of|in)\s+(next month|this month|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const [full, ord, dowStr, monthSpec] = match;
      const index = match.index;
      const dow = weekdays[dowStr.toLowerCase()];
      const isLast = ord.toLowerCase() === 'last';
      let year = baseYear;
      let month: number;
      const ms = monthSpec.toLowerCase();
      if (ms === 'this month') {
        month = baseMonth;
      } else if (ms === 'next month') {
        if (baseMonth === 11) {
          month = 0;
          year = baseYear + 1;
        } else {
          month = baseMonth + 1;
        }
      } else {
        month = months[ms];
        // If month already passed this year, consider next year for forward-looking parsing
        if (month < baseMonth) {
          year = baseYear + 1;
        }
      }

      const date = isLast
        ? this.getLastWeekdayOfMonth(year, month, dow)
        : this.getNthWeekdayOfMonth(year, month, dow, ordinals[ord.toLowerCase()]);

      if (date) {
        results.push({ text: full, index, date });
      }
    }

    return results;
  }

  private getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = firstOfMonth.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    const result = new Date(year, month, day);
    // If overflowed into next month, clamp to last occurrence
    if (result.getMonth() !== month) {
      return this.getLastWeekdayOfMonth(year, month, weekday);
    }
    return result;
  }

  private getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
    const lastDay = new Date(year, month + 1, 0); // last day of month
    const lastWeekday = lastDay.getDay();
    const offset = (lastWeekday - weekday + 7) % 7;
    return new Date(year, month, lastDay.getDate() - offset);
  }
}
