/**
 * Priority parser for detecting task priority levels
 * Handles patterns like p1, p2, p3, high, low, urgent, critical, etc.
 */

import { Parser, ParsedTag } from "@shared/types";
import { v4 as uuidv4 } from 'uuid';

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
    { pattern: /\b(urgent|critical|asap|emergency|high priority|important)\b/gi, level: 'high', confidence: 0.85 },
    { pattern: /\bhigh\b/gi, level: 'high', confidence: 0.75 },
    
    // Medium priority keywords
    { pattern: /\b(medium priority|normal priority|moderate)\b/gi, level: 'medium', confidence: 0.80 },
    { pattern: /\bmedium\b/gi, level: 'medium', confidence: 0.70 },
    
    // Low priority keywords
    { pattern: /\b(low priority|when possible|someday|maybe|optional)\b/gi, level: 'low', confidence: 0.80 },
    { pattern: /\blow\b/gi, level: 'low', confidence: 0.65 },
    
    // Alternative priority expressions
    { pattern: /\b(top priority|highest priority|must do)\b/gi, level: 'high', confidence: 0.90 },
    { pattern: /\b(least priority|lowest priority|nice to have)\b/gi, level: 'low', confidence: 0.85 },
    
    // Urgency indicators
    { pattern: /\b(due soon|overdue|time sensitive)\b/gi, level: 'high', confidence: 0.80 },
    { pattern: /\b(no rush|no hurry|later|eventually)\b/gi, level: 'low', confidence: 0.75 },
  ];

  /**
   * Test if the text contains priority indicators
   */
  test(text: string): boolean {
    return this.priorityPatterns.some(({ pattern }) => pattern.test(text));
  }

  /**
   * Parse the text and extract priority information
   * Consolidates multiple matches into a single normalized priority tag
   */
  parse(text: string): ParsedTag[] {
    // Track the strongest match only
    const severityRank: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 2, high: 3 };

    let chosen: {
      level: 'low' | 'medium' | 'high';
      confidence: number;
      startIndex: number;
      endIndex: number;
      originalText: string;
    } | null = null;

    for (const { pattern, level, confidence } of this.priorityPatterns) {
      // Reset regex lastIndex to ensure clean matching
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;
        const adjustedConfidence = this.adjustConfidence(confidence, match[0], text);

        if (!chosen) {
          chosen = { level: level as 'low' | 'medium' | 'high', confidence: adjustedConfidence, startIndex, endIndex, originalText: match[0] };
        } else {
          // Prefer higher severity; if equal severity, prefer higher confidence; if equal, prefer earliest occurrence
          const currentRank = severityRank[chosen.level];
          const newRank = severityRank[level as 'low' | 'medium' | 'high'];
          if (
            newRank > currentRank ||
            (newRank === currentRank && adjustedConfidence > chosen.confidence) ||
            (newRank === currentRank && adjustedConfidence === chosen.confidence && startIndex < chosen.startIndex)
          ) {
            chosen = { level: level as 'low' | 'medium' | 'high', confidence: adjustedConfidence, startIndex, endIndex, originalText: match[0] };
          }
        }

        // Prevent infinite loop for global regex
        if (pattern.global && pattern.lastIndex === match.index) {
          break;
        }
      }
    }

    if (!chosen) return [];

    const priorityTag: ParsedTag = {
      id: uuidv4(),
      type: 'priority',
      value: chosen.level,
      displayText: this.formatDisplayText(chosen.level, chosen.originalText),
      iconName: this.getIconForPriority(chosen.level),
      startIndex: chosen.startIndex,
      endIndex: chosen.endIndex,
      originalText: chosen.originalText,
      confidence: chosen.confidence,
      source: this.id,
      color: this.getColorForPriority(chosen.level),
    };

    return [priorityTag];
  }

  /**
   * Adjust confidence based on context
   */
  private adjustConfidence(baseConfidence: number, matchText: string, fullText: string): number {
    let confidence = baseConfidence;

    // Reduce confidence for very short matches in long text
    if (matchText.length <= 2 && fullText.length > 50) {
      confidence *= 0.8;
    }

    // Increase confidence for explicit p1/p2/p3 patterns
    if (/^p[123]$/i.test(matchText.trim())) {
      confidence = Math.min(0.98, confidence + 0.1);
    }

    // Reduce confidence if the match is part of a larger word
    const beforeIndex = Math.max(0, fullText.indexOf(matchText));
    const afterIndex = beforeIndex + matchText.length;
    const beforeChar = beforeIndex > 0 ? fullText[beforeIndex - 1] : undefined;
    const afterChar = afterIndex < fullText.length ? fullText[afterIndex] : undefined;
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
   * Format display text for priority tag (standardized)
   */
  private formatDisplayText(level: string, _originalText: string): string {
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