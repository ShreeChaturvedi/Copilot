/**
 * Shared constants for the L5 Playwright browser E2E suite.
 *
 * These are imported by BOTH playwright.config.ts (to wire the webServers) and
 * the spec/helper modules (to read the API log and clean the DB), so the ports,
 * URLs, database and log path stay in exactly one place.
 *
 * Dedicated ports/DB so L5 never touches the shared local stack (:3001 API,
 * :5180 Vite, react_calendar_dev DB). Override any of them via env in CI.
 */
import path from 'node:path';

/** Local Express API (scripts/dev-server.ts) — NOT the shared :3001. */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3011);
/** Vite dev server serving the SPA under /app — NOT the shared :5180. */
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5185);

export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

/** The SPA is mounted under /app (vite base '/app/', Router basename '/app'). */
export const APP_BASE = '/app';

/** Dedicated E2E database. Migrated separately; never shared with L2/L3. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/taskflow_e2e_test';

export const JWT_SECRET =
  process.env.E2E_JWT_SECRET ?? 'e2e-integration-secret';

/**
 * Where the dev-server's stdout is captured. The password-reset flow reads the
 * emitted reset link from here (email is unconfigured locally, so AuthService
 * logs `[password-reset] Reset link for <email>: <url>` instead of sending it).
 * Under e2e/ so it is git-ignored (*.log) and easy to find on failure.
 */
export const API_LOG_PATH = path.resolve('e2e/.artifacts/api-server.log');

/** Satisfies the shared strong-password policy (upper, lower, digit, special). */
export const TEST_PASSWORD = 'Password123!';
