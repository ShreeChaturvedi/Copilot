import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import {
  API_PORT,
  WEB_PORT,
  API_ORIGIN,
  WEB_ORIGIN,
  E2E_DATABASE_URL,
  JWT_SECRET,
  API_LOG_PATH,
} from './e2e/support/constants';

/**
 * L5 — browser E2E (docs/design-research/recon/test-audit.md §7 "L5").
 *
 * Boots the REAL stack against a dedicated database and dedicated ports so it
 * never disturbs the shared local stack (:3001 API, :5180 Vite,
 * react_calendar_dev):
 *   1. scripts/dev-server.ts (the local Express mirror of api/**) on API_PORT,
 *      against taskflow_e2e_test, with its stdout captured to API_LOG_PATH so
 *      the password-reset flow can read the emitted reset link.
 *   2. Vite dev serving the SPA under /app on WEB_PORT, with its /api proxy
 *      pointed at the dev-server above (API_PROXY_TARGET).
 *
 * Runs its OWN runner — excluded from the vitest frontend/backend jobs (their
 * includes are src/**, api/**, lib/**; nothing matches e2e/**). Invoke with
 * `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Shared dev-user backend state → run serially to keep the suite deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Dev Vite compiles routes on demand (slow first hit); keep generous budgets.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: './e2e/support/global-setup.ts',
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: WEB_ORIGIN,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Real local API mirror. stdout → API_LOG_PATH so the reset test can read
      // the logged reset link. No BLOB_READ_WRITE_TOKEN → /api/upload returns
      // the 503 the attachments spec asserts (issue #35). No GOOGLE_* → the
      // integrations panel shows "Connect" without real consent.
      command: `mkdir -p "${path.dirname(API_LOG_PATH)}" && npx tsx scripts/dev-server.ts > "${API_LOG_PATH}" 2>&1`,
      url: `${API_ORIGIN}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET,
        // Reset links point back at THIS Vite origin so they open in-app.
        FRONTEND_URL: WEB_ORIGIN,
        NODE_ENV: 'development',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `${WEB_ORIGIN}/app/`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        API_PROXY_TARGET: API_ORIGIN,
      },
    },
  ],
});
