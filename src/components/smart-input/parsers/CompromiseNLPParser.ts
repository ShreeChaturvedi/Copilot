/**
 * NLP parser using Compromise.js for named entity recognition and semantic analysis
 * Handles locations, people, organizations, and semantic labels
 */

import nlp from 'compromise';
import { Parser, ParsedTag } from "@shared/types";
import { v4 as uuidv4 } from 'uuid';

// Using minimal interfaces for compromise objects we actually use
// to avoid pulling in heavy and conflicting type definitions.
type CompromiseDoc = {
  people: () => CompromiseMatch[];
  places: () => CompromiseMatch[];
  organizations: () => CompromiseMatch[];
};
type CompromiseMatch = {
  text: () => string;
};

export class CompromiseNLPParser implements Parser {
  readonly id = 'compromise-nlp-parser';
  readonly name = 'NLP Entity Parser';
  readonly priority = 6; // Lower priority than dates and priorities

  // Location indicator patterns
  private readonly locationPatterns = [
    /\b(at|in|near|by|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /\b(downtown|uptown|mall|center|office|store|restaurant|bank|hospital|school|gym|park)\b/gi,
    /\b([A-Z][a-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Pl|Place))\b/g,
  ];

  // Task category patterns for semantic labeling
  private readonly taskCategories = {
    work: /\b(work|office|meeting|project|presentation|deadline|client|boss|colleague|email|report|proposal)\b/gi,
    personal:
      /\b(personal|family|home|house|chores|cleaning|cooking|grocery|shopping|doctor|dentist|appointment)\b/gi,
    health:
      /\b(doctor|dentist|hospital|clinic|pharmacy|medicine|workout|gym|exercise|yoga|therapy|checkup)\b/gi,
    shopping:
      /\b(buy|purchase|shop|store|mall|grocery|groceries|food|clothes|gift|amazon|online)\b/gi,
    finance:
      /\b(bank|atm|money|payment|bill|invoice|taxes|budget|insurance|loan|mortgage)\b/gi,
    social:
      /\b(friend|friends|dinner|lunch|coffee|party|birthday|wedding|event|meet|hangout)\b/gi,
    travel:
      /\b(flight|plane|airport|hotel|vacation|trip|travel|book|ticket|passport|visa)\b/gi,
    education:
      /\b(school|university|college|class|study|homework|exam|test|assignment|library)\b/gi,
  };

  /**
   * Test if the text contains entities that can be processed by NLP
   */
  test(text: string): boolean {
    const doc = nlp(text) as unknown as CompromiseDoc;

    // Check for named entities
    const hasEntities =
      doc.people().length > 0 ||
      doc.places().length > 0 ||
      doc.organizations().length > 0;

    // Check for location patterns
    const hasLocationPatterns = this.locationPatterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });

    // Check for task categories
    const hasCategories = Object.values(this.taskCategories).some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });

    return hasEntities || hasLocationPatterns || hasCategories;
  }

  /**
   * Parse the text and extract entities and semantic information
   */
  parse(text: string): ParsedTag[] {
    const tags: ParsedTag[] = [];
    const doc = nlp(text) as unknown as CompromiseDoc;

    // Extract people
    this.extractPeople(doc, text, tags);

    // Extract places/locations
    this.extractPlaces(doc, text, tags);

    // Extract organizations
    this.extractOrganizations(doc, text, tags);

    // Extract location patterns
    this.extractLocationPatterns(text, tags);

    // Extract semantic labels
    this.extractSemanticLabels(text, tags);

    return tags;
  }

  /**
   * Extract people entities
   */
  private extractPeople(
    doc: CompromiseDoc,
    text: string,
    tags: ParsedTag[]
  ): void {
    const people = doc.people();

    people.forEach((person: CompromiseMatch) => {
      const personText = person.text();
      const startIndex = text.toLowerCase().indexOf(personText.toLowerCase());

      if (startIndex !== -1) {
        tags.push({
          id: uuidv4(),
          type: 'person',
          value: personText,
          displayText: personText,
          iconName: 'User',
          startIndex,
          endIndex: startIndex + personText.length,
          originalText: personText,
          confidence: 0.75,
          source: this.id,
          color: '#8b5cf6', // Purple for people
        });
      }
    });
  }

  /**
   * Extract place entities
   */
  private extractPlaces(
    doc: CompromiseDoc,
    text: string,
    tags: ParsedTag[]
  ): void {
    const places = doc.places();

    places.forEach((place: CompromiseMatch) => {
      const placeText = place.text();
      const startIndex = text.toLowerCase().indexOf(placeText.toLowerCase());

      if (startIndex !== -1) {
        tags.push({
          id: uuidv4(),
          type: 'location',
          value: placeText,
          displayText: placeText,
          iconName: 'MapPin',
          startIndex,
          endIndex: startIndex + placeText.length,
          originalText: placeText,
          confidence: 0.8,
          source: this.id,
          color: '#10b981', // Green for locations
        });
      }
    });
  }

  /**
   * Extract organization entities
   */
  private extractOrganizations(
    doc: CompromiseDoc,
    text: string,
    tags: ParsedTag[]
  ): void {
    const organizations = doc.organizations();

    organizations.forEach((org: CompromiseMatch) => {
      const orgText = org.text();
      const startIndex = text.toLowerCase().indexOf(orgText.toLowerCase());

      if (startIndex !== -1) {
        tags.push({
          id: uuidv4(),
          type: 'project', // Treat organizations as projects
          value: orgText,
          displayText: orgText,
          iconName: 'Building',
          startIndex,
          endIndex: startIndex + orgText.length,
          originalText: orgText,
          confidence: 0.7,
          source: this.id,
          color: '#f59e0b', // Amber for projects/organizations
        });
      }
    });
  }

  /**
   * Extract location patterns (at, in, near, etc.)
   */
  private extractLocationPatterns(text: string, tags: ParsedTag[]): void {
    this.locationPatterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const location = match[2] || match[0]; // Prefer captured group

        // Skip if already processed
        const alreadyExists = tags.some(
          (tag) =>
            tag.startIndex <= match!.index &&
            tag.endIndex >= match!.index + fullMatch.length
        );

        if (!alreadyExists) {
          tags.push({
            id: uuidv4(),
            type: 'location',
            value: location,
            displayText: location,
            iconName: 'MapPin',
            startIndex: match.index,
            endIndex: match.index + fullMatch.length,
            originalText: fullMatch,
            confidence: 0.65,
            source: this.id,
            color: '#10b981',
          });
        }
      }
    });
  }

  /**
   * Extract semantic labels based on task categories
   */
  private extractSemanticLabels(text: string, tags: ParsedTag[]): void {
    let bestCategory: string | null = null;
    let bestScore = 0;
    let bestMatch: RegExpMatchArray | null = null;

    // Find the category with the highest confidence
    Object.entries(this.taskCategories).forEach(([category, pattern]) => {
      pattern.lastIndex = 0;
      const matches = Array.from(text.matchAll(pattern)) as RegExpMatchArray[];

      if (matches.length > 0) {
        const score = matches.length + (matches.some((m) => (m[0] || '').length > 5) ? 0.2 : 0);

        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
          bestMatch = matches[0] as RegExpMatchArray; // Explicit type assertion
        }
      }
    });

    // Create semantic label tag
    if (bestCategory && bestMatch) {
      const matchIndex = (bestMatch as RegExpMatchArray & { index?: number }).index ?? -1;
      const matchText: string = (bestMatch[0] as unknown as string) || '';
      if (matchIndex >= 0 && typeof matchText === 'string') {
        tags.push({
          id: uuidv4(),
          type: 'label',
          value: bestCategory,
          displayText: this.formatCategoryDisplayText(bestCategory),
          iconName: this.getCategoryIcon(bestCategory),
          startIndex: matchIndex,
          endIndex: matchIndex + (matchText?.length || 0),
          originalText: matchText,
          confidence: Math.min(0.85, 0.5 + bestScore * 0.1),
          source: this.id,
          color: this.getCategoryColor(bestCategory),
        });
      }
    }
  }

  /**
   * Format display text for category labels
   */
  private formatCategoryDisplayText(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Get icon for task category
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      work: 'Briefcase',
      personal: 'Home',
      health: 'Heart',
      shopping: 'ShoppingCart',
      finance: 'DollarSign',
      social: 'Users',
      travel: 'Plane',
      education: 'GraduationCap',
    };

    return icons[category] || 'Tag';
  }

  /**
   * Get color for task category
   */
  private getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      work: '#3b82f6', // Blue
      personal: '#10b981', // Green
      health: '#ef4444', // Red
      shopping: '#f59e0b', // Amber
      finance: '#059669', // Emerald
      social: '#8b5cf6', // Purple
      travel: '#06b6d4', // Cyan
      education: '#dc2626', // Red
    };

    return colors[category] || '#6b7280';
  }
}
