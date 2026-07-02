import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBaseUrl } from '../env.js';

/**
 * Regression matrix for issue #34: the reset-link base URL must prefer an
 * explicit FRONTEND_URL, then the canonical VERCEL_PROJECT_PRODUCTION_URL, then
 * the deployment-specific VERCEL_URL, and finally the real local Vite port
 * (5173 per vite.config, NOT the old 3000 default).
 */
describe('getBaseUrl precedence (issue #34)', () => {
  const KEYS = [
    'FRONTEND_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('prefers an explicit FRONTEND_URL over every Vercel variable', () => {
    process.env.FRONTEND_URL = 'https://app.taskflow.com';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'taskflow-canonical.vercel.app';
    process.env.VERCEL_URL = 'taskflow-abc123-user.vercel.app';
    expect(getBaseUrl()).toBe('https://app.taskflow.com');
  });

  it('falls back to the canonical VERCEL_PROJECT_PRODUCTION_URL over VERCEL_URL', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'taskflow-canonical.vercel.app';
    process.env.VERCEL_URL = 'taskflow-abc123-user.vercel.app';
    expect(getBaseUrl()).toBe('https://taskflow-canonical.vercel.app');
  });

  it('falls back to the deployment-specific VERCEL_URL when no canonical domain is set', () => {
    process.env.VERCEL_URL = 'taskflow-abc123-user.vercel.app';
    expect(getBaseUrl()).toBe('https://taskflow-abc123-user.vercel.app');
  });

  it('defaults to the local Vite port 5173 (not 3000) when nothing is configured', () => {
    expect(getBaseUrl()).toBe('http://localhost:5173');
  });
});
