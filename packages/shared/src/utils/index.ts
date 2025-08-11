// Placeholder for shared utilities
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Truncate a string in the middle with ellipsis.
 * When preserveExtension is true, keeps the file extension suffix intact.
 */
export const truncateMiddle = (
  input: string,
  maxLength: number,
  options: { preserveExtension?: boolean } = { preserveExtension: true }
): string => {
  if (input.length <= maxLength) return input;

  const { preserveExtension = true } = options;

  if (preserveExtension) {
    const lastDot = input.lastIndexOf('.');
    if (lastDot > 0 && lastDot < input.length - 1) {
      const base = input.slice(0, lastDot);
      const ext = input.slice(lastDot); // includes the dot
      const budget = maxLength - ext.length - 3; // 3 for '...'
      if (budget <= 0) {
        // Not enough room to show base; fall back to showing start and end of extension
        return '...' + ext.slice(Math.max(0, ext.length - (maxLength - 3)));
      }
      const head = Math.ceil(budget / 2);
      const tail = Math.floor(budget / 2);
      return base.slice(0, head) + '...' + base.slice(-tail) + ext;
    }
  }

  const budget = maxLength - 3;
  const head = Math.ceil(budget / 2);
  const tail = Math.floor(budget / 2);
  return input.slice(0, head) + '...' + input.slice(-tail);
};