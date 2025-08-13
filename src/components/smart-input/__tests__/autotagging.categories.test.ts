import { describe, it, expect } from 'vitest';
import { SmartParser } from '../parsers/SmartParser';

async function parse(text: string) {
  const parser = new SmartParser();
  return parser.parse(text);
}

describe('Autotagging - Categories', () => {
  it('detects Work and Social simultaneously when appropriate', async () => {
    const input = 'Schedule standup meeting and dinner with friends';
    const res = await parse(input);
    const labels = res.tags.filter(t => t.type === 'label').map(t => t.value);
    expect(labels).toContain('work');
    expect(labels).toContain('social');
  });

  it('applies exclusivity: chooses strongest between Work and Education', async () => {
    const input = 'Finish assignment and project sprint review for class';
    const res = await parse(input);
    const labels = res.tags.filter(t => t.type === 'label').map(t => t.value);
    // Should include only one of the pair based on stronger evidence
    const hasWork = labels.includes('work');
    const hasEdu = labels.includes('education');
    expect(hasWork || hasEdu).toBe(true);
    expect(!(hasWork && hasEdu)).toBe(true);
  });

  it('recognizes richer vocab like sprint, jira, zoom for Work', async () => {
    const input = 'Update JIRA ticket and join Zoom for sprint retro';
    const res = await parse(input);
    const labels = res.tags.filter(t => t.type === 'label').map(t => t.value);
    expect(labels).toContain('work');
  });
});