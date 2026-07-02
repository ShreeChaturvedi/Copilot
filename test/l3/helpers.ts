/**
 * Shared helpers for the L3 real-handler integration suite.
 *
 * - Resolves the test database URL and probes it once so suites can
 *   `describe.skipIf(!dbAvailable)` when no Postgres is reachable (mirrors the
 *   gating convention in lib/services/__tests__/EventService.tz.integration.test.ts
 *   and lib/google/__tests__/GoogleSyncService.dbintegration.test.ts).
 * - Provides a fetch-based HTTP client, a real-user factory (via the register
 *   handler) and DB cleanup keyed on a per-suite email/tag prefix.
 *
 * The suite runs with NODE_ENV=production (set in vitest.l3.config.ts) so the
 * real authenticateJWT enforces tokens; devAuth's dev-user injection (which only
 * fires when NODE_ENV !== 'production') is disabled, letting us assert real 401s.
 */
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export const TEST_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/taskflow_l3_test';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'l3-integration-test-secret';

async function canConnect(url: string): Promise<boolean> {
  const probe = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 3000,
    max: 1,
  });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

/** Resolved once at import so `describe.skipIf(!dbAvailable)` works. */
export const dbAvailable = await canConnect(TEST_DB_URL);

/** Shared pool for row seeding / cleanup (separate from the handlers' pools). */
export const cleanupPool: Pool | null = dbAvailable
  ? new Pool({ connectionString: TEST_DB_URL, max: 4 })
  : null;

// Satisfies the shared strong policy (upper, lower, digit, special char) so
// registerUser succeeds now that register enforces it too (issue #66).
export const TEST_PASSWORD = 'Password123!';
/** Email prefix used to scope cleanup so parallel suites don't clobber. */
export const EMAIL_PREFIX = 'l3-';
/** Tag name prefix (tags table is GLOBAL / not user-scoped, cascade won't reach it). */
export const TAG_PREFIX = 'l3tag-';

export function uniqueEmail(): string {
  return `${EMAIL_PREFIX}${randomUUID()}@example.com`;
}

export interface HttpResult<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  text: string;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Raw (non-JSON) body, e.g. for the upload endpoint. */
  raw?: { data: Buffer | string; contentType?: string };
}

/** Minimal fetch client bound to a base URL. */
export function makeClient(baseUrl: string) {
  return async function req<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<HttpResult<T>> {
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    let payload: string | Buffer | undefined;
    if (opts.raw) {
      payload = opts.raw.data;
      if (opts.raw.contentType) headers['Content-Type'] = opts.raw.contentType;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: payload as BodyInit | undefined,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    return { status: res.status, headers: res.headers, body: body as T, text };
  };
}

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register a fresh real user through POST /api/auth/register and return its
 * tokens. Exercises the real bcrypt + SQL path, so the row and refresh token
 * genuinely exist in the DB.
 */
export async function registerUser(
  req: ReturnType<typeof makeClient>,
  overrides: { email?: string; name?: string } = {}
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const res = await req<{
    success: boolean;
    data: {
      user: { id: string; email: string };
      tokens: { accessToken: string; refreshToken: string };
    };
  }>('POST', '/api/auth/register', {
    body: { email, password: TEST_PASSWORD, name: overrides.name ?? 'L3 User' },
  });
  if (res.status !== 201 || !res.body?.data) {
    throw new Error(
      `registerUser failed (${res.status}): ${res.text.slice(0, 300)}`
    );
  }
  return {
    userId: res.body.data.user.id,
    email: res.body.data.user.email,
    password: TEST_PASSWORD,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken: res.body.data.tokens.refreshToken,
  };
}

/** Sign an access token directly (for expired / custom-role / wrong-type cases). */
export function signAccessToken(
  payload: Record<string, unknown>,
  expiresIn: string | number = '15m'
): string {
  return jwt.sign({ type: 'access', ...payload }, JWT_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'react-calendar-app',
    audience: 'react-calendar-app-users',
  });
}

/** Remove all rows created by the L3 suite (cascades from users + global tags). */
export async function cleanupTestData(): Promise<void> {
  if (!cleanupPool) return;
  await cleanupPool.query(`DELETE FROM users WHERE email LIKE $1`, [
    `${EMAIL_PREFIX}%`,
  ]);
  await cleanupPool.query(`DELETE FROM tags WHERE name LIKE $1`, [
    `${TAG_PREFIX}%`,
  ]);
}
