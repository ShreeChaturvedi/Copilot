/**
 * Translate errors into user-facing copy (design brief section 7, #58).
 *
 * Server errors can carry machine codes ("VALIDATION_ERROR: Task list not
 * found or access denied"). Codes never reach a toast: the prefix is
 * stripped, and a message that is nothing but a code falls back to the
 * caller's plain-language fallback.
 */

/** Leading machine-code prefix, e.g. "VALIDATION_ERROR: " or "AUTH_FAILED - ". */
const CODE_PREFIX = /^[A-Z][A-Z0-9_]{2,}\s*[:-]\s*/;

/** A message that is only a machine code, e.g. "TOKEN_REUSE_DETECTED". */
const BARE_CODE = /^[A-Z][A-Z0-9_]*$/;

export function toUserMessage(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!raw) return fallback;

  const stripped = raw.replace(CODE_PREFIX, '').trim();
  if (!stripped || BARE_CODE.test(stripped)) return fallback;
  return stripped;
}
