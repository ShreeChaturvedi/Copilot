/**
 * L1 characterization tests for CompromiseNLPParser
 * (src/components/smart-input/parsers/CompromiseNLPParser.ts).
 *
 * Backed by compromise@14 NER + regex category/location patterns. Deterministic
 * (no time dependency). Asserts the CURRENT set of tags each input produces.
 */
import { describe, it, expect } from 'vitest';
import type { ParsedTag } from '@shared/types';
import { CompromiseNLPParser } from '../CompromiseNLPParser';

const parser = new CompromiseNLPParser();

function find(tags: ParsedTag[], type: string, value?: string): ParsedTag | undefined {
  return tags.find((t) => t.type === type && (value === undefined || t.value === value));
}

describe('CompromiseNLPParser', () => {
  describe('test()', () => {
    it.each([
      ['Meeting at Google', true],
      ['buy groceries', true],
      ['Call John tomorrow', true],
      ['gym workout', true],
      ['nothing', false],
      ['', false],
    ])('test(%j) === %s', (input, expected) => {
      expect(parser.test(input)).toBe(expected);
    });
  });

  describe('people (NER)', () => {
    it('extracts a person and tags it purple with confidence 0.75', () => {
      const tags = parser.parse('Call John tomorrow');
      const person = find(tags, 'person', 'John');
      expect(person).toBeDefined();
      expect(person!.displayText).toBe('John');
      expect(person!.iconName).toBe('User');
      expect(person!.color).toBe('#8b5cf6');
      expect(person!.confidence).toBeCloseTo(0.75, 5);
      expect([person!.startIndex, person!.endIndex]).toEqual([5, 9]);
      expect(person!.source).toBe('compromise-nlp-parser');
    });
  });

  describe('places (NER) and location patterns', () => {
    it('"flight to Paris" tags Paris as a place (0.8) and via the "to X" pattern (0.65)', () => {
      const tags = parser.parse('flight to Paris');
      const place = find(tags, 'location', 'Paris');
      expect(place).toBeDefined();
      expect(place!.confidence).toBeCloseTo(0.8, 5);
      expect([place!.startIndex, place!.endIndex]).toEqual([10, 15]);
      expect(place!.iconName).toBe('MapPin');
      // The "to Paris" location-pattern match also exists (lower confidence).
      const pattern = tags.find(
        (t) => t.type === 'location' && t.originalText === 'to Paris'
      );
      expect(pattern).toBeDefined();
      expect(pattern!.confidence).toBeCloseTo(0.65, 5);
    });

    it('bare location keyword "gym" is tagged as a location (0.65)', () => {
      const tags = parser.parse('gym workout');
      const loc = find(tags, 'location', 'gym');
      expect(loc).toBeDefined();
      expect(loc!.confidence).toBeCloseTo(0.65, 5);
      expect([loc!.startIndex, loc!.endIndex]).toEqual([0, 3]);
    });
  });

  describe('organizations mapped to project tags', () => {
    it('"Meeting at Google" tags Google as a project (org) with amber color', () => {
      const tags = parser.parse('Meeting at Google');
      const org = find(tags, 'project', 'Google');
      expect(org).toBeDefined();
      expect(org!.iconName).toBe('Building');
      expect(org!.color).toBe('#f59e0b');
      expect(org!.confidence).toBeCloseTo(0.7, 5);
      expect([org!.startIndex, org!.endIndex]).toEqual([11, 17]);
    });
  });

  describe('semantic category label (single best-scoring category)', () => {
    it.each<[string, string, string, string]>([
      // input, category value, iconName, first-match originalText
      ['buy groceries', 'shopping', 'ShoppingCart', 'buy'],
      ['work on project', 'work', 'Briefcase', 'work'],
      ['doctor appointment', 'personal', 'Home', 'doctor'],
      ['flight to Paris', 'travel', 'Plane', 'flight'],
    ])('%j -> label %s', (input, category, icon, orig) => {
      const tags = parser.parse(input);
      const label = find(tags, 'label', category);
      expect(label).toBeDefined();
      expect(label!.iconName).toBe(icon);
      expect(label!.originalText).toBe(orig);
      expect(label!.confidence).toBeLessThanOrEqual(0.85);
      expect(label!.confidence).toBeGreaterThan(0.5);
    });

    it('only ONE label tag is emitted (the highest-scoring category wins)', () => {
      // "doctor" is in both personal and health; personal wins (more matches).
      const labels = parser.parse('doctor appointment').filter((t) => t.type === 'label');
      expect(labels).toHaveLength(1);
      expect(labels[0].value).toBe('personal');
    });
  });

  describe('combined entity extraction', () => {
    it('"lunch with Sarah in Chicago" yields person, place, and a social label', () => {
      const tags = parser.parse('lunch with Sarah in Chicago');
      expect(find(tags, 'person', 'Sarah')).toBeDefined();
      expect(find(tags, 'location', 'Chicago')).toBeDefined();
      expect(find(tags, 'label', 'social')).toBeDefined();
    });
  });

  describe('garbage / empty', () => {
    it.each(['nothing', '', '   ', '12345'])('parse(%j) yields no tags', (input) => {
      expect(parser.parse(input)).toEqual([]);
    });
  });
});
