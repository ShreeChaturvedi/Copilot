/**
 * Multi-stage parsing pipeline with conflict resolution
 * Orchestrates all individual parsers and resolves overlapping detections
 */

import { Parser, ParseResult, ParsedTag, Conflict } from "@shared/types";
import { ChronoDateParser } from './ChronoDateParser';
import { PriorityParser } from './PriorityParser';
import { CompromiseNLPParser } from './CompromiseNLPParser';

export class SmartParser {
  private parsers: Parser[];

  constructor() {
    // Initialize parsers in priority order (highest priority first)
    this.parsers = [
      new ChronoDateParser(), // Priority 10: Dates/times
      new PriorityParser(), // Priority 8: Priorities
      new CompromiseNLPParser(), // Priority 6: NER and semantic analysis
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Parse text through all available parsers and resolve conflicts
   */
  async parse(text: string): Promise<ParseResult> {
    if (!text.trim()) {
      return {
        cleanText: text,
        tags: [],
        confidence: 1.0,
        conflicts: [],
      };
    }

    try {
      // Stage 1: Run all applicable parsers
      const allTags = await this.runParsers(text);

      // Stage 2: Detect conflicts
      const conflicts = this.detectConflicts(allTags);

      // Stage 3: Resolve conflicts
      const resolvedTags = this.resolveConflicts(allTags, conflicts);

      // Stage 4: Generate clean text
      const cleanText = this.generateCleanText(text, resolvedTags);

      // Stage 5: Calculate overall confidence
      const confidence = this.calculateOverallConfidence(resolvedTags);

      return {
        cleanText,
        tags: resolvedTags,
        confidence,
        conflicts,
      };
    } catch (error) {
      console.error('Smart parser error:', error);
      return {
        cleanText: text,
        tags: [],
        confidence: 0,
        conflicts: [],
      };
    }
  }

  /**
   * Run all applicable parsers on the text
   */
  private async runParsers(text: string): Promise<ParsedTag[]> {
    const allTags: ParsedTag[] = [];

    for (const parser of this.parsers) {
      try {
        if (parser.test(text)) {
          const tags = parser.parse(text);
          allTags.push(...tags);
        }
      } catch (error) {
        console.warn(`Parser ${parser.id} failed:`, error);
      }
    }

    return allTags;
  }

  /**
   * Detect conflicts between overlapping tags
   */
  private detectConflicts(tags: ParsedTag[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const tag1 = tags[i];
        const tag2 = tags[j];
        const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;

        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        if (this.tagsOverlap(tag1, tag2)) {
          // Find existing conflict or create new one
          let conflict = conflicts.find((c) =>
            this.rangesOverlap(
              { start: c.startIndex, end: c.endIndex },
              { start: tag1.startIndex, end: tag1.endIndex }
            )
          );

          if (!conflict) {
            conflict = {
              startIndex: Math.min(tag1.startIndex, tag2.startIndex),
              endIndex: Math.max(tag1.endIndex, tag2.endIndex),
              tags: [],
            };
            conflicts.push(conflict);
          }

          // Add tags to conflict if not already present
          if (!conflict.tags.some((t) => t.id === tag1.id)) {
            conflict.tags.push(tag1);
          }
          if (!conflict.tags.some((t) => t.id === tag2.id)) {
            conflict.tags.push(tag2);
          }

          // Update conflict bounds
          conflict.startIndex = Math.min(
            conflict.startIndex,
            tag1.startIndex,
            tag2.startIndex
          );
          conflict.endIndex = Math.max(
            conflict.endIndex,
            tag1.endIndex,
            tag2.endIndex
          );
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts by selecting the best tag for each conflict
   */
  private resolveConflicts(
    tags: ParsedTag[],
    conflicts: Conflict[]
  ): ParsedTag[] {
    const resolvedTags = [...tags];
    const tagsToRemove = new Set<string>();

    for (const conflict of conflicts) {
      // Sort conflicting tags by priority and confidence
      const sortedTags = conflict.tags.sort((a, b) => {
        const parserA = this.parsers.find((p) => p.id === a.source);
        const parserB = this.parsers.find((p) => p.id === b.source);
        const priorityA = parserA?.priority || 0;
        const priorityB = parserB?.priority || 0;

        // First by parser priority
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }

        // Then by confidence
        return b.confidence - a.confidence;
      });

      // Keep the highest priority/confidence tag
      const winnerTag = sortedTags[0];
      conflict.resolved = winnerTag;

      // Mark other tags for removal
      for (let i = 1; i < sortedTags.length; i++) {
        tagsToRemove.add(sortedTags[i].id);
      }
    }

    // Remove conflicting tags
    return resolvedTags.filter((tag) => !tagsToRemove.has(tag.id));
  }

  /**
   * Generate clean text with resolved tags removed
   */
  private generateCleanText(originalText: string, tags: ParsedTag[]): string {
    if (tags.length === 0) return originalText;

    // Sort tags by position (descending) to remove from end to start
    const sortedTags = [...tags].sort((a, b) => b.startIndex - a.startIndex);

    let cleanText = originalText;

    for (const tag of sortedTags) {
      const before = cleanText.substring(0, tag.startIndex);
      const after = cleanText.substring(tag.endIndex);

      // Clean up spacing
      let result = before + after;

      // Remove double spaces
      result = result.replace(/\s{2,}/g, ' ');

      // Trim whitespace
      result = result.trim();

      cleanText = result;
    }

    return cleanText;
  }

  /**
   * Calculate overall parsing confidence
   */
  private calculateOverallConfidence(tags: ParsedTag[]): number {
    if (tags.length === 0) return 1.0;

    // Weighted average based on tag confidence and parser priority
    let totalWeight = 0;
    let weightedSum = 0;

    for (const tag of tags) {
      const parser = this.parsers.find((p) => p.id === tag.source);
      const weight = (parser?.priority || 1) * tag.confidence;

      weightedSum += weight;
      totalWeight += parser?.priority || 1;
    }

    return totalWeight > 0 ? Math.min(1.0, weightedSum / totalWeight) : 0.5;
  }

  /**
   * Check if two tags overlap
   */
  private tagsOverlap(tag1: ParsedTag, tag2: ParsedTag): boolean {
    return this.rangesOverlap(
      { start: tag1.startIndex, end: tag1.endIndex },
      { start: tag2.startIndex, end: tag2.endIndex }
    );
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    range1: { start: number; end: number },
    range2: { start: number; end: number }
  ): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }

  /**
   * Add a custom parser to the pipeline
   */
  addParser(parser: Parser): void {
    this.parsers.push(parser);
    this.parsers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a parser from the pipeline
   */
  removeParser(parserId: string): void {
    this.parsers = this.parsers.filter((p) => p.id !== parserId);
  }

  /**
   * Get all available parsers
   */
  getParsers(): Parser[] {
    return [...this.parsers];
  }

  /**
   * Test parsing without side effects (for debugging)
   */
  async testParse(
    text: string
  ): Promise<{ parserResults: Array<{ parser: string; tags: ParsedTag[] }> }> {
    const results = [];

    for (const parser of this.parsers) {
      try {
        if (parser.test(text)) {
          const tags = parser.parse(text);
          results.push({
            parser: parser.name,
            tags,
          });
        }
      } catch {
        results.push({
          parser: parser.name,
          tags: [],
        });
      }
    }

    return { parserResults: results };
  }
}
