import { describe, it, expect } from 'vitest';
import { SmartParser } from '../parsers/SmartParser';

async function parse(text: string) {
  const parser = new SmartParser();
  return parser.parse(text);
}

describe('Autotagging - Locations and Dates', () => {
  it('recognizes simple prepositional locations (at/in)', async () => {
    const input = 'Lunch at Central Park';
    const res = await parse(input);
    const locs = res.tags.filter(t => t.type === 'location').map(t => t.displayText.toLowerCase());
    expect(locs.some(l => l.includes('central') && l.includes('park'))).toBe(true);
  });

  it('recognizes addresses with street types', async () => {
    const input = 'Meet at 123 Main St, bring docs';
    const res = await parse(input);
    const locs = res.tags.filter(t => t.type === 'location').map(t => t.displayText);
    expect(locs.some(l => /123\s+main\s+st/i.test(l))).toBe(true);
  });

  it('recognizes full addresses with city/state/zip', async () => {
    const input = 'Ship to 1 Infinite Loop, Cupertino, CA 95014';
    const res = await parse(input);
    const locs = res.tags.filter(t => t.type === 'location').map(t => t.displayText);
    expect(locs.some(l => /Infinite Loop/i.test(l) && /95014/.test(l))).toBe(true);
  });

  it('parses complex date phrase: the third friday of next month', async () => {
    const input = 'Pay rent on the third friday of next month';
    const res = await parse(input);
    const dates = res.tags.filter(t => t.type === 'date' || t.type === 'time');
    expect(dates.length).toBeGreaterThan(0);
  });

  it('parses relative ranges like two weeks from now', async () => {
    const input = 'Follow up two weeks from now';
    const res = await parse(input);
    const dates = res.tags.filter(t => t.type === 'date' || t.type === 'time');
    expect(dates.length).toBeGreaterThan(0);
  });
});