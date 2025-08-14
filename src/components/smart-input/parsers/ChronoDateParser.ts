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
    return results.length > 0;
  }

  /**
   * Parse the text and extract date/time information
   */
  parse(text: string): ParsedTag[] {
    const tags: ParsedTag[] = [];
    const results = chrono.parse(text, new Date(), { forwardDate: true });

    for (const result of results) {
      const rawStart = result.start.date();
      const rawEnd = result.end?.date();

      // Determine if this is a date-only or date+time expression
      const hasTime =
        result.start.isCertain('hour') || result.start.isCertain('minute');
      const isDateRange = !!result.end;

      // Create date tag
      if (rawStart) {
        // Normalize date-only results to midnight so we don't accidentally include current time
        const normalizedStart = new Date(rawStart);
        const normalizedEnd = rawEnd ? new Date(rawEnd) : undefined;
        if (!hasTime) {
          normalizedStart.setHours(0, 0, 0, 0);
          if (normalizedEnd) {
            normalizedEnd.setHours(0, 0, 0, 0);
          }
        }
        const dateTag: ParsedTag = {
          id: uuidv4(),
          type: hasTime ? 'time' : 'date',
          value: normalizedStart,
          displayText: this.formatDisplayText(normalizedStart, hasTime),
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
          normalizedEnd &&
          normalizedEnd.getTime() !== normalizedStart.getTime()
        ) {
          const endTag: ParsedTag = {
            id: uuidv4(),
            type: hasTime ? 'time' : 'date',
            value: normalizedEnd,
            displayText: `Until ${this.formatDisplayText(normalizedEnd, hasTime)}`,
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
}
