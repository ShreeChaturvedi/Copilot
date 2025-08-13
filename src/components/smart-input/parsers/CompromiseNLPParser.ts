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
    /\b(at|in|near|by|to)\s+([A-Z][a-z\p{L}\p{M}]+(?:\s+[A-Z][a-z\p{L}\p{M}]+)*)/gu,
    /\b(downtown|uptown|mall|center|office|store|restaurant|bank|hospital|school|gym|park)\b/gi,
    /\b([A-Z][a-z\p{L}\p{M}]+\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Pl|Place))\b/gu,
  ];

  // Address patterns (numbers + street + optional unit/city/state/zip)
  private readonly addressPatterns = [
    // e.g., 123 Main St, 500 5th Ave, 42 Wallaby Way
    /\b\d+\s+(?:[A-Za-z\p{L}\p{M}]+(?:\s+\d+)?(?:\s+[A-Za-z\p{L}\p{M}]+)*?)\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Pl|Place|Ln|Lane|Ct|Court|Cir|Circle)\b(?:\s*(?:#|Apt|Unit)\s*[\w-]+)?/gu,
    // e.g., 1 Infinite Loop, Cupertino, CA 95014
    /\b\d+\s+[A-Za-z\p{L}\p{M}]+(?:\s+[A-Za-z\p{L}\p{M}]+)*,\s*[A-Za-z\p{L}\p{M}]+(?:\s+[A-Za-z\p{L}\p{M}]+)*,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/gu,
    // Simpler numeric street pattern fallback
    /\b\d{1,6}\s+[A-Za-z\p{L}\p{M}.'-]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Pl|Place|Ln|Lane|Ct|Court|Cir|Circle)\b/iu,
  ];

  // Fallback location patterns for prepositions followed by words (case-insensitive)
  private readonly fallbackPrepLocationPatterns = [
    /\b(?:at|in|near|by|to)\s+([A-Za-z\p{L}\p{M}]+(?:\s+[A-Za-z\p{L}\p{M}]+)*)/giu,
  ];

  // Fallback name patterns
  private readonly nameContextPatterns = [
    /\b(?:with|call|text|email|meet|message|ping|dm|zoom with)\s+([a-z\p{L}\p{M}][\w\p{L}\p{M}'’.-]*)/giu,
  ];

  // Kinship terms considered as persons
  private readonly kinshipTerms = [
    'mom', 'mum', 'dad', 'father', 'mother', 'brother', 'sister', 'son', 'daughter',
    'grandma', 'grandmother', 'grandpa', 'grandfather', 'aunt', 'uncle', 'cousin', 'partner', 'spouse'
  ];

  // Task category patterns for semantic labeling
  private readonly taskCategories: Record<string, RegExp> = {
    work: /\b(work|office|meeting|project|presentation|deadline|client|boss|manager|colleague|coworker|email|report|proposal|brief|sprint|scrum|standup|jira|pr|pull request|review|deploy|zoom|slack)\b/gi,
    personal: /\b(personal|family|home|house|chores|cleaning|cooking|grocery|shopping|doctor|dentist|appointment|kids|children|errand|laundry|garden|pets?)\b/gi,
    health: /\b(doctor|dentist|hospital|clinic|pharmacy|medicine|workout|gym|exercise|yoga|therapy|checkup|physio|run|jog|cycle|swim)\b/gi,
    shopping: /\b(buy|purchase|shop|store|mall|grocery|groceries|food|clothes|gift|amazon|online|order|cart|checkout|wishlist)\b/gi,
    finance: /\b(bank|atm|money|payment|bill|invoice|taxes|budget|insurance|loan|mortgage|salary|payroll|expense|refund)\b/gi,
    social: /\b(friend|friends|dinner|lunch|coffee|party|birthday|wedding|event|meet|hangout|brunch|drinks?|movie|concert|game night)\b/gi,
    travel: /\b(flight|plane|airport|hotel|vacation|trip|travel|book|ticket|passport|visa|train|bus|uber|lyft|drive|commute|itinerary|boarding pass)\b/gi,
    education: /\b(school|university|college|class|study|homework|exam|test|assignment|library|lecture|seminar|course|tutor|thesis)\b/gi,
  };

  // Exclusive category groups: choose strongest within a group
  private readonly exclusiveCategoryGroups: string[][] = [
    ['work', 'education'],
    ['shopping', 'personal'],
  ];

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
    const hasLocationPatterns = [...this.locationPatterns, ...this.addressPatterns, ...this.fallbackPrepLocationPatterns].some((pattern) => {
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

    // Extract addresses
    this.extractAddresses(text, tags);

    // Extract semantic labels (possibly multiple with exclusivity rules)
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
    const lower = text.toLowerCase();

    const addPersonTag = (matchText: string, startIndex: number) => {
      const { value, display } = this.normalizePersonName(matchText);
      if (!value) return;

      const endIndex = startIndex + matchText.length;
      // Avoid duplicates over same range/value
      if (tags.some(t => t.type === 'person' && t.startIndex === startIndex && t.endIndex === endIndex)) return;

      tags.push({
        id: uuidv4(),
        type: 'person',
        value,
        displayText: display,
        iconName: 'User',
        startIndex,
        endIndex,
        originalText: matchText,
        confidence: 0.8,
        source: this.id,
        color: '#8b5cf6', // Purple for people
      });
    };

    // Primary: NER from compromise
    const people = doc.people();
    people.forEach((person: CompromiseMatch) => {
      const personText = person.text();
      const startIndex = lower.indexOf(personText.toLowerCase());
      if (startIndex !== -1) addPersonTag(personText, startIndex);
    });

    // Fallback: kinship terms
    for (const term of this.kinshipTerms) {
      const kinPattern = new RegExp(`\\b${term}\\b`, 'i');
      const match = lower.match(kinPattern);
      if (match && typeof match.index === 'number') {
        addPersonTag(match[0], match.index);
      }
    }

    // Fallback: context-based name following verbs/prepositions, including lowercase and diacritics
    for (const pattern of this.nameContextPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const matchedName = match[1];
        const startIndex = match.index + (match[0].length - matchedName.length);
        addPersonTag(matchedName, startIndex);
        if (pattern.global && pattern.lastIndex === match.index) break;
      }
    }

    // Fallback: capitalized name-like tokens with Unicode letters (two-word names as one tag)
    const capNamePattern = /\b([A-Z][\p{L}\p{M}.'’-]+(?:\s+[A-Z][\p{L}\p{M}.'’-]+)*)\b/gu;
    capNamePattern.lastIndex = 0;
    let capMatch: RegExpExecArray | null;
    while ((capMatch = capNamePattern.exec(text)) !== null) {
      const candidate = capMatch[1];
      // Skip if candidate is at sentence start and is a common word
      if (/^(I|The|A|An|And|But|Or)$/i.test(candidate)) continue;
      addPersonTag(candidate, capMatch.index);
    }
  }

  private normalizePersonName(raw: string): { value: string; display: string } {
    let name = raw.trim();
    // Strip possessive 's or ’s without changing highlight range
    name = name.replace(/['’]s\b/i, '');
    // Strip trailing punctuation
    name = name.replace(/[.,!?]$/, '');
    // Normalize whitespace
    name = name.replace(/\s{2,}/g, ' ');
    if (!name) return { value: '', display: '' };
    // Title-case words
    const display = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { value: display, display };
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
    const allPatterns = [...this.locationPatterns, ...this.fallbackPrepLocationPatterns];
    allPatterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const location = match[2] || match[1] || match[0]; // Prefer captured group

        // Skip if already processed
        const alreadyExists = tags.some(
          (tag) =>
            tag.type === 'location' &&
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
            confidence: 0.7,
            source: this.id,
            color: '#10b981',
          });
        }
      }
    });
  }

  /**
   * Extract addresses using robust patterns
   */
  private extractAddresses(text: string, tags: ParsedTag[]): void {
    for (const pattern of this.addressPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;
        const overlapping = tags.some(t => t.type === 'location' && !(endIndex <= t.startIndex || startIndex >= t.endIndex));
        if (overlapping) continue;
        tags.push({
          id: uuidv4(),
          type: 'location',
          value: fullMatch,
          displayText: fullMatch,
          iconName: 'MapPin',
          startIndex,
          endIndex,
          originalText: fullMatch,
          confidence: 0.85,
          source: this.id,
          color: '#10b981',
        });
        if (pattern.global && pattern.lastIndex === match.index) break;
      }
    }
  }

  /**
   * Extract semantic labels based on task categories
   * Allows multiple categories, applying exclusivity rules for certain groups
   */
  private extractSemanticLabels(text: string, tags: ParsedTag[]): void {
    type CatScore = { category: string; score: number; match: RegExpMatchArray | null };
    const scores: CatScore[] = [];

    // Compute scores per category
    Object.entries(this.taskCategories).forEach(([category, pattern]) => {
      pattern.lastIndex = 0;
      const matches = Array.from(text.matchAll(pattern)) as RegExpMatchArray[];
      if (matches.length > 0) {
        const score = matches.length + (matches.some((m) => (m[0] || '').length > 5) ? 0.2 : 0);
        scores.push({ category, score, match: matches[0] as RegExpMatchArray });
      }
    });

    if (scores.length === 0) return;

    // Apply exclusivity groups: keep only the strongest within each group
    const selected = new Set<string>();

    // First, handle exclusive groups
    for (const group of this.exclusiveCategoryGroups) {
      const inGroup = scores.filter(s => group.includes(s.category));
      if (inGroup.length === 0) continue;
      inGroup.sort((a, b) => b.score - a.score);
      selected.add(inGroup[0].category);
    }

    // Then, include other categories (non-exclusive) if score passes threshold
    for (const s of scores) {
      const isInExclusive = this.exclusiveCategoryGroups.some(g => g.includes(s.category));
      if (!isInExclusive && s.score >= 1) {
        selected.add(s.category);
      }
    }

    // Emit tags for selected categories
    for (const cat of selected) {
      const best = scores.find(s => s.category === cat)!;
      const matchIndex = (best.match as RegExpMatchArray & { index?: number }).index ?? -1;
      const matchText: string = (best.match?.[0] as unknown as string) || cat;
      if (matchIndex >= 0 && typeof matchText === 'string') {
        tags.push({
          id: uuidv4(),
          type: 'label',
          value: cat,
          displayText: this.formatCategoryDisplayText(cat),
          iconName: this.getCategoryIcon(cat),
          startIndex: matchIndex,
          endIndex: matchIndex + matchText.length,
          originalText: matchText,
          confidence: Math.min(0.9, 0.5 + best.score * 0.1),
          source: this.id,
          color: this.getCategoryColor(cat),
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
