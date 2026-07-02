/**
 * L3 setup: quiet the handlers' request logger and error logger so the console
 * isn't flooded (errorHandler logs every ApiError, including the intentional
 * 401/404s these tests assert). Assertion output is unaffected. Set
 * L3_VERBOSE=1 to restore real console output when debugging.
 */
import { vi } from 'vitest';

if (!process.env.L3_VERBOSE) {
  const noop = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).console = {
    ...console,
    log: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}
