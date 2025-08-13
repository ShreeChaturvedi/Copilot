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
    /\b(at|in|near|by|to|on)\s+([\p{Lu}\p{Ll}][\p{L}]+(?:\s+[\p{Lu}\p{Ll}][\p{L}]+)*)/gu,
    /\b(downtown|uptown|mall|center|office|hq|store|restaurant|cafe|bank|hospital|clinic|school|campus|gym|park|airport|station)\b/gi,
    /\b([\p{Lu}\p{Ll}][\p{L}]+\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Cir|Circle|Pkwy|Parkway|Hwy|Highway))\b/gu,
  ];

  // Street address patterns (e.g., 123 Main St, City, ST 12345)
  private readonly addressPatterns = [
    /\b\d{1,6}\s+[A-Za-z0-9\.\-]+(?:\s+[A-Za-z0-9\.\-]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Cir|Circle|Pkwy|Parkway|Hwy|Highway)\.?\s*(?:Apt|Unit|Suite)?\s*#?\s*[\w\-]*\s*(?:,\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?(?:\s*\d{5}(?:-\d{4})?)?)?/gi,
  ];

  // Task category patterns for semantic labeling
  private readonly taskCategories = {
    work: /\b(work|office|meeting|project|presentation|deadline|client|boss|colleague|email|report|proposal|review|deploy|standup|sprint|interview|okr|sync|spec|tickets?)\b/gi,
    personal:
      /\b(personal|family|home|house|chores?|cleaning|cooking|laundry|grocery|grocer(?:y|ies)|shopping|appointment|kids?|mom|dad|parents?)\b/gi,
    health:
      /\b(doctor|dentist|hospital|clinic|pharmacy|medicine|meds|workout|gym|exercise|yoga|therapy|checkup|physio|cardio|run|running)\b/gi,
    shopping:
      /\b(buy|purchase|shop|store|mall|grocery|grocer(?:y|ies)|food|clothes|gift|amazon|cart|order|checkout|online)\b/gi,
    finance:
      /\b(bank|atm|money|payment|pay|bill|invoice|tax(?:es)?|budget|insurance|loan|mortgage|payroll|expense|reimbursement)\b/gi,
    social:
      /\b(friend|friends|dinner|lunch|coffee|party|birthday|wedding|event|meet|hangout|call|text|message|invite)\b/gi,
    travel:
      /\b(flight|plane|airport|hotel|vacation|trip|travel|book|booking|ticket|passport|visa|itinerary|car\s*rental|train|uber|lyft)\b/gi,
    education:
      /\b(school|university|college|class|lecture|study|homework|exam|test|assignment|library|campus|professor|tuition)\b/gi,
  };

  // Context verbs indicating a following person name (can be lowercase)
  private readonly personContextVerbs = [
    'call','text','email','meet','message','dm','ping','invite','ask','remind','follow up with','follow up','talk to','meet with','grab','lunch with','dinner with','coffee with','schedule with'
  ];

  // Non-person common nouns to avoid false positives in possessive/name heuristics
  private readonly nonPersonNouns = new Set<string>([
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
    'january','february','march','april','may','june','july','august','september','october','november','december',
    'company','team','bank','office','clinic','school','gym','hospital','project','meeting','event','party','airport','station'
  ]);

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
    this.extractPeopleHeuristics(text, tags);

    // Extract places/locations
    this.extractPlaces(doc, text, tags);

    // Extract organizations
    this.extractOrganizations(doc, text, tags);

    // Extract location patterns
    this.extractLocationPatterns(text, tags);
    this.extractAddressPatterns(text, tags);

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
      const refined = this.refinePersonEntityText(personText);
      let startIndex = text.toLowerCase().indexOf(personText.toLowerCase());
      let endIndex = startIndex !== -1 ? startIndex + personText.length : -1;
      if (startIndex !== -1 && refined && refined.length < personText.length) {
        const innerOffset = personText.toLowerCase().indexOf(refined.toLowerCase());
        if (innerOffset >= 0) {
          startIndex = startIndex + innerOffset;
          endIndex = startIndex + refined.length;
        }
      }

      if (startIndex !== -1) {
        tags.push({
          id: uuidv4(),
          type: 'person',
          value: refined,
          displayText: refined,
          iconName: 'User',
          startIndex,
          endIndex: endIndex,
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
            confidence: /\bat\b|\bin\b|\bnear\b|\bon\b/i.test(fullMatch) ? 0.7 : 0.6,
            source: this.id,
            color: '#10b981',
          });
        }
      }
    });
  }

  /**
   * Extract explicit street addresses
   */
  private extractAddressPatterns(text: string, tags: ParsedTag[]): void {
    this.addressPatterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;
        const alreadyExists = tags.some((t) => startIndex >= t.startIndex && endIndex <= t.endIndex && t.type === 'location');
        if (!alreadyExists) {
          tags.push({
            id: uuidv4(),
            type: 'location',
            value: fullMatch,
            displayText: fullMatch,
            iconName: 'MapPin',
            startIndex,
            endIndex,
            originalText: fullMatch,
            confidence: 0.88,
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
    const createdRanges: Array<{ start: number; end: number }> = [];
    const rangeOverlaps = (s: number, e: number) => createdRanges.some(r => s < r.end && e > r.start);

    Object.entries(this.taskCategories).forEach(([category, pattern]) => {
      pattern.lastIndex = 0;
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length === 0) return;

      // Score by frequency and token length
      const score = matches.length + (matches.some((m) => (m[0] || '').length > 5) ? 0.2 : 0);
      const first = matches[0] as RegExpMatchArray & { index?: number };
      const matchIndex = first.index ?? -1;
      const matchText = (first[0] as unknown as string) || '';
      if (matchIndex >= 0 && typeof matchText === 'string') {
        const startIndex = matchIndex;
        const endIndex = matchIndex + matchText.length;
        if (!rangeOverlaps(startIndex, endIndex)) {
          createdRanges.push({ start: startIndex, end: endIndex });
        }
        tags.push({
          id: uuidv4(),
          type: 'label',
          value: category,
          displayText: this.formatCategoryDisplayText(category),
          iconName: this.getCategoryIcon(category),
          startIndex,
          endIndex,
          originalText: matchText,
          confidence: Math.min(0.9, 0.5 + score * 0.1),
          source: this.id,
          color: this.getCategoryColor(category),
        });
      }
    });
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

  /**
   * Additional heuristics for person detection: possessives, @mentions, contextual lowercase names
   */
  private extractPeopleHeuristics(text: string, tags: ParsedTag[]): void {
    const existingRanges = tags.map(t => ({ start: t.startIndex, end: t.endIndex }));

    const overlaps = (s: number, e: number) => existingRanges.some(r => s < r.end && e > r.start);

    // Possessive names like John's, Anna’s
    const possessivePattern = /\b([\p{Lu}\p{Ll}][\p{L}'’\-]{1,})['’]s\b/gu;
    let m: RegExpExecArray | null;
    possessivePattern.lastIndex = 0;
    while ((m = possessivePattern.exec(text)) !== null) {
      const raw = m[0];
      const nameRaw = m[1];
      const nameCore = this.sanitizePersonName(nameRaw);
      if (!nameCore || this.nonPersonNouns.has(nameCore.toLowerCase())) continue;
      const startIndex = m.index;
      const endIndex = m.index + raw.length;
      if (!overlaps(startIndex, endIndex)) {
        tags.push({
          id: uuidv4(),
          type: 'person',
          value: this.capitalizeName(nameCore),
          displayText: this.capitalizeName(nameCore),
          iconName: 'User',
          startIndex,
          endIndex,
          originalText: raw,
          confidence: 0.7,
          source: this.id,
          color: '#8b5cf6',
        });
        existingRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // @mentions like @john, @mary-smith
    const mentionPattern = /@([A-Za-z0-9_][\w\.\-]{1,})/g;
    mentionPattern.lastIndex = 0;
    while ((m = mentionPattern.exec(text)) !== null) {
      const raw = m[0];
      const nameRaw = m[1];
      const startIndex = m.index;
      const endIndex = m.index + raw.length;
      if (!overlaps(startIndex, endIndex)) {
        const display = this.capitalizeName(nameRaw.replace(/_/g, ' '));
        tags.push({
          id: uuidv4(),
          type: 'person',
          value: display,
          displayText: display,
          iconName: 'User',
          startIndex,
          endIndex,
          originalText: raw,
          confidence: 0.8,
          source: this.id,
          color: '#8b5cf6',
        });
        existingRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // Contextual verbs followed by a name (allow lowercase names)
    const verbsAlternation = this.personContextVerbs.map(v => v.replace(/\s+/g, '\\s+')).join('|');
    const contextualPattern = new RegExp(`\\b(?:${verbsAlternation})\\s+(?:with\\s+)?([@]?[A-Za-zÀ-ÖØ-öø-ÿ'’\\-]+(?:\\s+[A-Za-zÀ-ÖØ-öø-ÿ'’\\-]+){0,2})`, 'gi');
    contextualPattern.lastIndex = 0;
    while ((m = contextualPattern.exec(text)) !== null) {
      const rawName = m[1].replace(/^@/, '');
      const clean = this.sanitizePersonName(rawName.trim());
      if (!clean || this.nonPersonNouns.has(clean.toLowerCase())) continue;
      const fullMatch = m[0];
      const nameStart = m.index + fullMatch.lastIndexOf(rawName);
      const nameEnd = nameStart + rawName.length;
      if (!overlaps(nameStart, nameEnd)) {
        const display = this.capitalizeName(clean);
        tags.push({
          id: uuidv4(),
          type: 'person',
          value: display,
          displayText: display,
          iconName: 'User',
          startIndex: nameStart,
          endIndex: nameEnd,
          originalText: rawName,
          confidence: 0.72,
          source: this.id,
          color: '#8b5cf6',
        });
        existingRanges.push({ start: nameStart, end: nameEnd });
      }
    }
  }

  private sanitizePersonName(name: string): string {
    let result = name.trim();
    // Remove possessive suffix and trailing punctuation
    result = result.replace(/['’]s$/i, '');
    result = result.replace(/[\.,;:!?]+$/, '');
    return result;
  }

  private capitalizeName(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private readonly titleStopwords = new Set<string>([
    'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'sir', 'madam', 'mx', 'jr', 'sr'
  ]);

  private readonly leadingStopwords = new Set<string>(['the','a','an','to','with','and','of']);

  private refinePersonEntityText(personText: string): string {
    // Normalize whitespace and remove possessive first
    let text = this.sanitizePersonName(personText).trim();
    if (!text) return text;

    // Tokenize, remove titles and leading verbs/stopwords
    const rawTokens = text.split(/\s+/);
    const tokens: string[] = [];
    for (const tok of rawTokens) {
      const t = tok.replace(/[\.,]+$/, '');
      const lower = t.toLowerCase();
      if (this.titleStopwords.has(lower)) continue;
      tokens.push(t);
    }

    // Drop leading context verbs/stopwords like 'Email', 'Call', 'Meet', 'with'
    while (tokens.length > 0) {
      const first = tokens[0];
      const firstLower = first.toLowerCase();
      if (this.personContextVerbs.includes(firstLower) || this.leadingStopwords.has(firstLower)) {
        tokens.shift();
        continue;
      }
      break;
    }

    // If more than two tokens remain, keep the last two (e.g., John Doe)
    const kept = tokens.length > 2 ? tokens.slice(-2) : tokens;
    const joined = kept.join(' ').trim();
    return this.capitalizeName(this.sanitizePersonName(joined));
  }
}
