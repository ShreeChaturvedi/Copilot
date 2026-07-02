/**
 * Predictable matching for a small command set: substring and word-prefix
 * only. cmdk's default fuzzy scorer matches across value+keyword boundaries
 * ("dark" hits Calendar via the keyword "week"), which misranks results.
 */
export function commandFilter(
  value: string,
  search: string,
  keywords?: string[]
): number {
  const q = search.toLowerCase().trim();
  if (!q) return 1;
  const v = value.toLowerCase();
  if (v === q) return 1;
  if (v.startsWith(q)) return 0.9;
  if (v.includes(q)) return 0.8;
  if (v.split(/\s+/).some((w) => w.startsWith(q))) return 0.7;
  if (keywords?.some((k) => k.toLowerCase().startsWith(q))) return 0.5;
  if (keywords?.some((k) => k.toLowerCase().includes(q))) return 0.4;
  return 0;
}
