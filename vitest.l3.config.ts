/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * L3 — real-handler integration suite (docs/design-research/recon/test-audit.md
 * §7 "L3"). Mounts the real api/[...route].ts + api/google/[...route].ts
 * dispatchers via a thin Express adapter and drives them over HTTP against a
 * real Postgres. Gated on a reachable DB (clean skip otherwise).
 *
 * NODE_ENV=production is deliberate: createApiHandler only injects devAuth (the
 * dev ADMIN-user shortcut) when NODE_ENV !== 'production', so production mode is
 * what lets the real authenticateJWT enforce tokens and 401/403 be asserted.
 * JWT_SECRET must therefore be set explicitly (jwt.ts refuses to start in
 * production without it). DATABASE_URL points at a dedicated L3 database
 * (override with L3_DATABASE_URL in CI) so it never shares rows with the
 * packages/backend workspace suite.
 */
const DB_URL =
  process.env.L3_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/taskflow_l3_test';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/l3/**/*.l3.test.ts'],
    setupFiles: ['./test/l3/setup.ts'],
    // Files share one Postgres and clean up by email/tag prefix, so run them
    // one at a time to avoid cross-file row deletion.
    fileParallelism: false,
    // A few flows do real bcrypt (register/login) which is CPU-heavy.
    testTimeout: 30000,
    hookTimeout: 30000,
    // The middleware-bug pin (routing.l3.test.ts) DELIBERATELY provokes the
    // dropped-UnauthorizedError unhandled rejection that is the bug itself, so
    // the run must not fail on it. Remove together with that pinned test once
    // the middleware chain propagates errors.
    dangerouslyIgnoreUnhandledErrors: true,
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: DB_URL,
      JWT_SECRET: process.env.JWT_SECRET || 'l3-integration-test-secret',
      // Deterministic CORS allow-list for the CORS assertions.
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://l3.example.test',
    },
  },
});
