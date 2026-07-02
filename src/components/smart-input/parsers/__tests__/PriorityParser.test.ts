/**
 * L1 characterization tests for PriorityParser
 * (src/components/smart-input/parsers/PriorityParser.ts).
 *
 * Pure regex-based parser, no time dependency. Asserts CURRENT behavior:
 * level mapping, confidence scoring, overlap suppression, and sort order.
 */
import { describe, it, expect } from 'vitest';
import { PriorityParser } from '../PriorityParser';

const parser = new PriorityParser();

describe('PriorityParser', () => {
  describe('test()', () => {
    it.each([
      ['p1', true],
      ['urgent', true],
      ['high', true],
      ['someday', true],
      ['must do', true],
      ['nothing here', false],
      ['p4', false],
      ['', false],
    ])('test(%j) === %s', (input, expected) => {
      expect(parser.test(input)).toBe(expected);
    });
  });

  describe('single-token mappings', () => {
    // [input, level, displayText, iconName, color, span, originalText, confidence]
    const cases: Array<[string, string, string, string, string, [number, number], string, number]> = [
      ['p1', 'high', 'P1', 'AlertCircle', '#ef4444', [0, 2], 'p1', 0.98],
      ['p2', 'medium', 'P2', 'Flag', '#f59e0b', [0, 2], 'p2', 0.98],
      ['p3', 'low', 'P3', 'Minus', '#6b7280', [0, 2], 'p3', 0.98],
      ['urgent', 'high', 'High Priority', 'AlertCircle', '#ef4444', [0, 6], 'urgent', 0.85],
      ['asap', 'high', 'High Priority', 'AlertCircle', '#ef4444', [0, 4], 'asap', 0.85],
      ['high', 'high', 'High Priority', 'AlertCircle', '#ef4444', [0, 4], 'high', 0.75],
      ['medium', 'medium', 'Medium Priority', 'Flag', '#f59e0b', [0, 6], 'medium', 0.7],
      ['low', 'low', 'Low Priority', 'Minus', '#6b7280', [0, 3], 'low', 0.65],
      ['someday', 'low', 'Low Priority', 'Minus', '#6b7280', [0, 7], 'someday', 0.8],
    ];

    it.each(cases)('parse(%j)', (input, level, display, icon, color, span, orig, conf) => {
      const tags = parser.parse(input);
      expect(tags).toHaveLength(1);
      const [tag] = tags;
      expect(tag.type).toBe('priority');
      expect(tag.value).toBe(level);
      expect(tag.displayText).toBe(display);
      expect(tag.iconName).toBe(icon);
      expect(tag.color).toBe(color);
      expect([tag.startIndex, tag.endIndex]).toEqual(span);
      expect(tag.originalText).toBe(orig);
      expect(tag.confidence).toBeCloseTo(conf, 5);
      expect(tag.source).toBe('priority-parser');
    });
  });

  describe('phrase mappings get a +0.05 phrase bonus', () => {
    it.each<[string, string, number]>([
      ['high priority', 'high', 0.9],
      ['low priority', 'low', 0.85],
      ['must do', 'high', 0.95],
      ['highest priority', 'high', 0.95],
      ['nice to have', 'low', 0.9],
    ])('parse(%j) -> %s @ %f', (input, level, conf) => {
      const tags = parser.parse(input);
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(level);
      expect(tags[0].confidence).toBeCloseTo(conf, 5);
      expect(tags[0].originalText).toBe(input);
    });
  });

  describe('overlap suppression', () => {
    it('"high priority" does not also emit a bare "high" tag', () => {
      const tags = parser.parse('high priority');
      expect(tags).toHaveLength(1);
      expect(tags[0].originalText).toBe('high priority');
    });

    it('word boundaries prevent matches embedded in larger words', () => {
      // "p1" inside "sp1n" and "high" inside "highlight" have no \b boundary
      expect(parser.parse('sp1n highlight champion')).toEqual([]);
    });
  });

  describe('multi-token titles with embedded priority keywords', () => {
    it('extracts "important" from "important task" (single word, no phrase bonus)', () => {
      const tags = parser.parse('important task');
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe('high');
      expect(tags[0].originalText).toBe('important');
      expect([tags[0].startIndex, tags[0].endIndex]).toEqual([0, 9]);
      expect(tags[0].confidence).toBeCloseTo(0.85, 5);
    });
  });

  describe('multiple priorities sort by confidence desc then position', () => {
    it('"p1 p2" keeps both, in positional order (equal confidence)', () => {
      const tags = parser.parse('p1 p2');
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.displayText)).toEqual(['P1', 'P2']);
      expect(tags.map((t) => t.value)).toEqual(['high', 'medium']);
      expect(tags.every((t) => t.confidence === 0.98)).toBe(true);
    });

    it('higher-confidence explicit code sorts before a lower-confidence keyword', () => {
      // "low" (0.65) appears first in text, "p1" (0.98) second; sort puts p1 first.
      const tags = parser.parse('low p1');
      expect(tags).toHaveLength(2);
      expect(tags[0].displayText).toBe('P1');
      expect(tags[0].confidence).toBeGreaterThan(tags[1].confidence);
    });
  });

  describe('garbage / empty', () => {
    it.each(['', '   ', 'buy the milk', 'p4 p5 p9'])('parse(%j) yields no tags', (input) => {
      expect(parser.parse(input)).toEqual([]);
    });
  });
});
