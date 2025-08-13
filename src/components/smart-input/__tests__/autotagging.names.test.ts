import { describe, it, expect } from 'vitest';
import { SmartParser } from '../parsers/SmartParser';

async function parse(text: string) {
  const parser = new SmartParser();
  return parser.parse(text);
}

describe('Autotagging - Names/People', () => {
  it("strips possessive for person's name (John's -> John)", async () => {
    const input = "Pick up John's dog from school";
    const res = await parse(input);
    const people = res.tags.filter(t => t.type === 'person');
    expect(people.length).toBeGreaterThan(0);
    // Display text should be normalized without possessive
    expect(people.some(p => p.displayText === 'John')).toBe(true);
    // Preserve original highlight span (may include possessive)
    expect(people.some(p => p.originalText.toLowerCase().includes("john"))).toBe(true);
  });

  it('recognizes lowercase names in context (call jose)', async () => {
    const input = 'call jose about the report';
    const res = await parse(input);
    const names = res.tags.filter(t => t.type === 'person').map(t => t.displayText.toLowerCase());
    expect(names).toContain('jose');
  });

  it('recognizes names with diacritics', async () => {
    const input = 'Meet with José at cafe';
    const res = await parse(input);
    const names = res.tags.filter(t => t.type === 'person').map(t => t.displayText);
    expect(names.some(n => n.toLowerCase().includes('jos'))).toBe(true);
  });

  it('recognizes kinship/person-like terms (mom)', async () => {
    const input = 'Call mom about dinner';
    const res = await parse(input);
    const names = res.tags.filter(t => t.type === 'person').map(t => t.displayText.toLowerCase());
    expect(names).toContain('mom');
  });
});