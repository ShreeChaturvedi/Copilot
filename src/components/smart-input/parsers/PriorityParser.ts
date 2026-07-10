/**
 * Priority parser for detecting task priority levels
 * Handles patterns like p1, p2, p3, high, low, urgent, critical, etc.
 */

import { Parser, ParsedTag } from '@shared/types';

export class PriorityParser implements Parser {
  readonly id = 'priority-parser';
  readonly name = 'Priority Parser';
  readonly priority = 8; // High priority, but lower than dates

  // Priority patterns and their mappings
  private readonly priorityPatterns = [
    // Explicit p1, p2, p3 patterns (Todoist style)
    { pattern: /\bp1\b/gi, level: 'high', confidence: 0.95 },
    { pattern: /\bp2\b/gi, level: 'medium', confidence: 0.95 },
    { pattern: /\bp3\b/gi, level: 'low', confidence: 0.95 },

    // High priority keywords
    {
      pattern: /\b(urgent|critical|asap|emergency|high priority|important)\b/gi,
      level: 'high',
      confidence: 0.85,
    },

    // Medium priority keywords. Bare single-word "high/medium/low" removed:
    // they matched everyday English ("high chair", "medium roast", "low
    // battery") and, above the 0.6 fade threshold, silently set task priority.
    {
      pattern: /\b(medium priority|normal priority|moderate)\b/gi,
      level: 'medium',
      confidence: 0.8,
    },

    // Low priority keywords. "maybe"/"optional" dropped -- too common in normal
    // task text to read as a deliberate priority signal.
    {
      pattern: /\b(low priority|when possible|someday)\b/gi,
      level: 'low',
      confidence: 0.8,
    },

    // Alternative priority expressions
    {
      pattern: /\b(top priority|highest priority|must do)\b/gi,
      level: 'high',
      confidence: 0.9,
    },
    {
      pattern: /\b(least priority|lowest priority|nice to have)\b/gi,
      level: 'low',
      confidence: 0.85,
    },

    // Urgency indicators
    {
      pattern: /\b(due soon|overdue|time sensitive)\b/gi,
      level: 'high',
      confidence: 0.8,
    },
    {
      // "later"/"eventually" removed -- they fire on ordinary phrasing ("call
      // mom later") and mis-tag the task as low priority.
      pattern: /\b(no rush|no hurry)\b/gi,
      level: 'low',
      confidence: 0.75,
    },
  ];

  /**
   * Test if the text contains priority indicators
   */
  test(text: string): boolean {
    return this.priorityPatterns.some(({ pattern }) => {
      // These are long-lived /gi RegExps; reset lastIndex before testing so a
      // stale index from a previous match can't make test() miss a real one.
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
  }

  /**
   * Parse the text and extract priority information
   */
  parse(text: string): ParsedTag[] {
    const tags: ParsedTag[] = [];
    const processedRanges: Array<{ start: number; end: number }> = [];

    for (const { pattern, level, confidence } of this.priorityPatterns) {
      // Reset regex lastIndex to ensure clean matching
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;

        // Check if this range overlaps with already processed ranges
        const overlaps = processedRanges.some(
          (range) =>
            (startIndex >= range.start && startIndex < range.end) ||
            (endIndex > range.start && endIndex <= range.end) ||
            (startIndex <= range.start && endIndex >= range.end)
        );

        if (!overlaps) {
          // Deterministic id (parser + span): stable across debounced
          // re-parses of unchanged text so tag identity survives keystrokes
          // that don't touch this span (unblocks tag-settle motion, §2.6).
          const priorityTag: ParsedTag = {
            id: `${this.id}:${startIndex}:${endIndex}`,
            type: 'priority',
            value: level,
            displayText: this.formatDisplayText(level, match[0]),
            iconName: this.getIconForPriority(level),
            startIndex,
            endIndex,
            originalText: match[0],
            confidence: this.adjustConfidence(
              confidence,
              match[0],
              text,
              startIndex,
              endIndex
            ),
            source: this.id,
            color: this.getColorForPriority(level as 'high' | 'medium' | 'low'),
          };

          tags.push(priorityTag);
          processedRanges.push({ start: startIndex, end: endIndex });
        }

        // Prevent infinite loop for global regex
        if (pattern.global && pattern.lastIndex === match.index) {
          break;
        }
      }
    }

    // Sort by confidence descending, then by position
    return tags.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.startIndex - b.startIndex;
    });
  }

  /**
   * Adjust confidence based on context
   */
  private adjustConfidence(
    baseConfidence: number,
    matchText: string,
    fullText: string,
    startIndex: number,
    endIndex: number
  ): number {
    let confidence = baseConfidence;

    // Reduce confidence for very short matches in long text
    if (matchText.length <= 2 && fullText.length > 50) {
      confidence *= 0.8;
    }

    // Increase confidence for explicit p1/p2/p3 patterns
    if (/^p[123]$/i.test(matchText.trim())) {
      confidence = Math.min(0.98, confidence + 0.1);
    }

    // Reduce confidence if the match is part of a larger word. Use the real
    // match position, not indexOf(matchText) (which returns the first textual
    // occurrence and mis-locates repeated words).
    const beforeChar = fullText[startIndex - 1];
    const afterChar = fullText[endIndex];

    if (beforeChar && /[a-zA-Z0-9]/.test(beforeChar)) {
      confidence *= 0.7;
    }
    if (afterChar && /[a-zA-Z0-9]/.test(afterChar)) {
      confidence *= 0.7;
    }

    // Increase confidence for phrases vs single words
    if (matchText.includes(' ')) {
      confidence = Math.min(0.95, confidence + 0.05);
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Format display text for priority tag
   */
  private formatDisplayText(level: string, originalText: string): string {
    // Use original text for p1/p2/p3 patterns
    if (/^p[123]$/i.test(originalText.trim())) {
      return originalText.trim().toUpperCase();
    }

    // Use level-based display text
    switch (level) {
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Medium Priority';
      case 'low':
        return 'Low Priority';
      default:
        return `${level.charAt(0).toUpperCase() + level.slice(1)} Priority`;
    }
  }

  /**
   * Get Lucide icon for priority level
   */
  private getIconForPriority(level: string): string {
    switch (level) {
      case 'high':
        return 'AlertCircle';
      case 'medium':
        return 'Flag';
      case 'low':
        return 'Minus';
      default:
        return 'Flag';
    }
  }

  /**
   * Get color for priority level
   */
  private getColorForPriority(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high':
        return '#ef4444'; // Red
      case 'medium':
        return '#f59e0b'; // Amber
      case 'low':
        return '#6b7280'; // Gray
      default:
        return '#6b7280';
    }
  }
}
