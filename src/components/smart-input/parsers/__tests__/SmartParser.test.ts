/**
 * L1 characterization tests for the SmartParser orchestration pipeline
 * (src/components/smart-input/parsers/SmartParser.ts).
 *
 * Covers: empty/whitespace short-circuit, multi-parser composition, conflict
 * detection + resolution, clean-text generation, overall confidence, and the
 * parser-registry helpers (get/add/remove). Time is pinned for the date parser.
 */
process.env.TZ = 'America/New_York';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Parser } from '@shared/types';
import { SmartParser } from '../SmartParser';

const WED = new Date(2026, 0, 14, 12, 0, 0);

describe('SmartParser', () => {
  let parser: SmartParser;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WED);
    parser = new SmartParser();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('empty / whitespace short-circuit', () => {
    it('empty string returns no tags with confidence 1.0', async () => {
      const result = await parser.parse('');
      expect(result.tags).toEqual([]);
      expect(result.cleanText).toBe('');
      expect(result.confidence).toBe(1.0);
      expect(result.conflicts).toEqual([]);
    });

    it('whitespace-only returns the original text unchanged with confidence 1.0', async () => {
      const result = await parser.parse('   ');
      expect(result.tags).toEqual([]);
      expect(result.cleanText).toBe('   ');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('plain text with no parseable entities', () => {
    it('returns text unchanged, no tags, confidence 1.0', async () => {
      const result = await parser.parse('plain task title');
      expect(result.tags).toEqual([]);
      expect(result.cleanText).toBe('plain task title');
      expect(result.confidence).toBe(1.0);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('composition across parsers', () => {
    it('"Buy milk tomorrow 2pm high priority" extracts time, priority, and label', async () => {
      const result = await parser.parse('Buy milk tomorrow 2pm high priority');
      const types = result.tags.map((t) => t.type).sort();
      expect(types).toEqual(['label', 'priority', 'time']);

      const time = result.tags.find((t) => t.type === 'time');
      expect(time?.displayText).toBe('Tomorrow at 2:00 PM');
      const priority = result.tags.find((t) => t.type === 'priority');
      expect(priority?.value).toBe('high');

      // clean text strips all matched spans and collapses whitespace
      expect(result.cleanText).toBe('milk');
      expect(result.conflicts).toHaveLength(0);
      expect(result.confidence).toBeCloseTo(0.867, 2);
    });

    it('"Call John #urgent p1" keeps both priority tags and the person', async () => {
      const result = await parser.parse('Call John #urgent p1');
      const priorities = result.tags.filter((t) => t.type === 'priority');
      expect(priorities).toHaveLength(2); // "urgent" and "p1"
      expect(result.tags.some((t) => t.type === 'person' && t.value === 'John')).toBe(true);
      expect(result.cleanText).toBe('Call #');
      expect(result.confidence).toBeCloseTo(0.87, 2);
    });
  });

  describe('conflict resolution', () => {
    it('overlapping location vs project on "at Google" resolves to a single winner', async () => {
      const result = await parser.parse('Meeting friday at Google');
      expect(result.conflicts).toHaveLength(1);
      // The higher-confidence project (org) tag survives; the "at Google" location is dropped.
      expect(result.tags.some((t) => t.type === 'project' && t.value === 'Google')).toBe(true);
      expect(result.tags.some((t) => t.originalText === 'at Google')).toBe(false);
      expect(result.tags.some((t) => t.type === 'date')).toBe(true);
      expect(result.cleanText).toBe('at');
    });

    // BUG #60: a date RANGE loses its end date in the pipeline. ChronoDateParser
    // emits the start and "Until ..." end tags with IDENTICAL span indices, so
    // SmartParser.detectConflicts treats them as an overlap and drops the end tag.
    // Marked it.fails: it passes today (documenting the loss) and will start
    // failing loudly once #60 is fixed and both range tags survive.
    it.fails('DESIRED (fails until #60): a date range keeps BOTH start and end tags', async () => {
      const result = await parser.parse('from monday to friday');
      const dateTags = result.tags.filter((t) => t.type === 'date');
      expect(dateTags).toHaveLength(2);
      expect(dateTags.some((t) => t.displayText.startsWith('Until'))).toBe(true);
    });

    it('CHARACTERIZATION (#60): the range end tag is currently dropped, leaving only the start', async () => {
      const result = await parser.parse('from monday to friday');
      const dateTags = result.tags.filter((t) => t.type === 'date');
      expect(dateTags).toHaveLength(1);
      expect(dateTags[0].displayText).toBe('Monday');
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('parser registry helpers', () => {
    it('getParsers returns the 3 built-in parsers ordered by priority desc', () => {
      const ids = parser.getParsers().map((p) => p.id);
      expect(ids).toEqual([
        'chrono-date-parser', // priority 10
        'priority-parser', // priority 8
        'compromise-nlp-parser', // priority 6
      ]);
    });

    it('addParser inserts and re-sorts by priority', () => {
      const custom: Parser = {
        id: 'custom',
        name: 'Custom',
        priority: 9,
        test: () => false,
        parse: () => [],
      };
      parser.addParser(custom);
      const ids = parser.getParsers().map((p) => p.id);
      expect(ids).toEqual([
        'chrono-date-parser',
        'custom', // priority 9 slots between 10 and 8
        'priority-parser',
        'compromise-nlp-parser',
      ]);
    });

    it('removeParser removes by id', () => {
      parser.removeParser('priority-parser');
      const ids = parser.getParsers().map((p) => p.id);
      expect(ids).not.toContain('priority-parser');
      expect(ids).toHaveLength(2);
    });
  });

  describe('testParse (debug helper)', () => {
    it('reports per-parser results for each applicable parser', async () => {
      const { parserResults } = await parser.testParse('tomorrow high priority');
      const names = parserResults.map((r) => r.parser);
      expect(names).toContain('Date/Time Parser');
      expect(names).toContain('Priority Parser');
      const dateResult = parserResults.find((r) => r.parser === 'Date/Time Parser');
      expect(dateResult!.tags.length).toBeGreaterThan(0);
    });
  });

  describe('resilience: a throwing parser is skipped, not fatal', () => {
    it('keeps parsing when one custom parser throws in test()', async () => {
      const boom: Parser = {
        id: 'boom',
        name: 'Boom',
        priority: 100,
        test: () => {
          throw new Error('kaboom');
        },
        parse: () => [],
      };
      parser.addParser(boom);
      const result = await parser.parse('tomorrow');
      // Chrono still runs and produces the date tag despite the throwing parser.
      expect(result.tags.some((t) => t.type === 'date')).toBe(true);
    });
  });
});
