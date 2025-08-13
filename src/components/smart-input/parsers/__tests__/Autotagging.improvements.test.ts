import { describe, it, expect } from 'vitest';
import { SmartParser } from '../SmartParser';

async function parse(text: string) {
  const parser = new SmartParser();
  return parser.parse(text);
}

describe('Autotagging improvements', () => {
  describe('Person name recognition', () => {
    it("sanitizes possessives to base name (John's -> John)", async () => {
      const text = "Pick up John's dog from school";
      const result = await parse(text);
      const people = result.tags.filter(t => t.type === 'person');
      expect(people.length).toBeGreaterThan(0);
      expect(people.some(p => p.displayText === 'John')).toBe(true);
      // Should not display possessive in tag displayText
      expect(people.some(p => /'s$/.test(p.displayText))).toBe(false);
    });

    it('detects lowercase names with contextual verbs', async () => {
      const text = 'call john about the report';
      const result = await parse(text);
      const people = result.tags.filter(t => t.type === 'person');
      expect(people.some(p => p.displayText.toLowerCase() === 'john')).toBe(true);
    });

    it('detects @mentions as people', async () => {
      const text = 'meet @mike at cafe';
      const result = await parse(text);
      const people = result.tags.filter(t => t.type === 'person');
      expect(people.some(p => p.displayText.toLowerCase().includes('mike'))).toBe(true);
    });

    it("doesn't treat common nouns as people via possessive heuristics", async () => {
      const text = "Review company's policy update";
      const result = await parse(text);
      const people = result.tags.filter(t => t.type === 'person');
      expect(people.length).toBe(0);
    });

    it('deduplicates overlapping person detections for possessive names', async () => {
      const text = "Email John's about the schedule";
      const result = await parse(text);
      const people = result.tags.filter(t => t.type === 'person');
      // Only one person tag should remain after conflict resolution
      expect(people.length).toBe(1);
      expect(people[0].displayText).toBe('John');
    });
  });

  describe('Label hierarchy and coexistence', () => {
    it('allows multiple applicable labels (work + education)', async () => {
      const text = 'Finish project for class';
      const result = await parse(text);
      const labels = result.tags.filter(t => t.type === 'label');
      const values = new Set(labels.map(l => String(l.value)));
      expect(values.has('work')).toBe(true);
      expect(values.has('education')).toBe(true);
    });

    it('allows shopping and personal to both appear when applicable', async () => {
      const text = 'Buy groceries for mom';
      const result = await parse(text);
      const values = new Set(result.tags.filter(t => t.type === 'label').map(l => String(l.value)));
      expect(values.has('shopping')).toBe(true);
      expect(values.has('personal')).toBe(true);
    });
  });

  describe('Priority consolidation', () => {
    it('maps p1 to High Priority display', async () => {
      const text = 'p1 fix critical bug';
      const result = await parse(text);
      const priorities = result.tags.filter(t => t.type === 'priority');
      expect(priorities.length).toBeGreaterThan(0);
      expect(priorities[0].displayText).toBe('High Priority');
      expect(priorities[0].value).toBe('high');
    });

    it('maps high priority phrase to High Priority display', async () => {
      const text = 'high priority bugfix';
      const result = await parse(text);
      const p = result.tags.find(t => t.type === 'priority');
      expect(p?.displayText).toBe('High Priority');
      expect(p?.value).toBe('high');
    });
  });

  describe('Location and address recognition', () => {
    it('recognizes explicit street addresses', async () => {
      const text = 'Meet at 123 Main St, Springfield, IL 62704';
      const result = await parse(text);
      const loc = result.tags.find(t => t.type === 'location');
      expect(loc).toBeTruthy();
      expect(String(loc?.displayText)).toContain('123 Main St');
    });

    it('recognizes locations even if lowercase', async () => {
      const text = 'coffee in berlin with anna';
      const result = await parse(text);
      const locs = result.tags.filter(t => t.type === 'location');
      expect(locs.length).toBeGreaterThan(0);
    });
  });

  describe('Complex date parsing', () => {
    it('parses ordinal weekday of month expressions', async () => {
      const text = 'the third friday of next month';
      const result = await parse(text);
      const dates = result.tags.filter(t => t.type === 'date');
      expect(dates.length).toBeGreaterThan(0);
      expect(dates[0].value instanceof Date).toBe(true);
    });
  });
});