import { describe, it, expect } from 'vitest';
import { SmartParser } from '../parsers/SmartParser';

async function parse(text: string) {
  const parser = new SmartParser();
  return parser.parse(text);
}

describe('Autotagging - Priority', () => {
  it('consolidates multiple cues into highest severity High Priority', async () => {
    const input = 'ASAP fix bug p2 maybe urgent';
    const res = await parse(input);
    const priorities = res.tags.filter(t => t.type === 'priority');
    expect(priorities.length).toBe(1);
    expect(priorities[0].value).toBe('high');
    expect(priorities[0].displayText).toBe('High Priority');
  });

  it('supports p1/p2/p3 mapping to standardized display text', async () => {
    const res1 = await parse('p1 call customer');
    const res2 = await parse('update docs p2');
    const res3 = await parse('refactor code p3');

    expect(res1.tags.find(t => t.type === 'priority')?.displayText).toBe('High Priority');
    expect(res2.tags.find(t => t.type === 'priority')?.displayText).toBe('Medium Priority');
    expect(res3.tags.find(t => t.type === 'priority')?.displayText).toBe('Low Priority');
  });
});