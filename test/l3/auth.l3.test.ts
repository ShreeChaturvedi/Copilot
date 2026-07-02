/**
 * L3 — /api/auth/* contract tests through the REAL catch-all dispatcher
 * (api/[...route].ts), real AuthService/RefreshTokenService, real bcrypt, real
 * JWTs and a real Postgres. No service or response-helper mocks.
 *
 * Frontend consumer contracts pinned here come from
 * src/services/api/auth.ts (normalizeAuthData reads data.data.tokens.
 * {accessToken,refreshToken,expiresAt} and data.data.user.{id,email,name,
 * createdAt} — auth.ts:108-124) and src/stores (token storage).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  startTestServer,
  closeAppPools,
  resetRateLimitStore,
  type TestServer,
} from './adapter.js';
import {
  makeClient,
  registerUser,
  uniqueEmail,
  dbAvailable,
  cleanupPool,
  cleanupTestData,
  TEST_PASSWORD,
} from './helpers.js';

interface Envelope<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
  meta?: { timestamp: string };
}

type AuthData = {
  user: { id: string; email: string; name: string | null; createdAt: string };
  tokens: { accessToken: string; refreshToken: string; expiresAt: number };
};

describe.skipIf(!dbAvailable)('L3 auth contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  describe('POST /api/auth/register', () => {
    it('201 with the nested user+tokens shape the frontend normalizes (src/services/api/auth.ts:108-124)', async () => {
      const email = uniqueEmail();
      const r = await req<Envelope<AuthData>>('POST', '/api/auth/register', {
        body: { email, password: TEST_PASSWORD, name: 'Reg User' },
      });
      expect(r.status).toBe(201);
      expect(r.body.success).toBe(true);
      const { user, tokens } = r.body.data!;
      // normalizeAuthData reads exactly these fields:
      expect(user.id).toEqual(expect.any(String));
      expect(user.email).toBe(email); // stored lowercased; uniqueEmail is lowercase
      expect(user.name).toBe('Reg User');
      expect(new Date(user.createdAt).getTime()).not.toBeNaN();
      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(tokens.refreshToken).toEqual(expect.any(String));
      expect(tokens.expiresAt).toEqual(expect.any(Number));
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
      expect(r.body.meta?.timestamp).toEqual(expect.any(String));
      // The refresh token is genuinely persisted (hashed) in refresh_tokens.
      const hash = createHash('sha256')
        .update(tokens.refreshToken)
        .digest('hex');
      const row = await cleanupPool!.query(
        `SELECT "userId", revoked FROM refresh_tokens WHERE "tokenHash" = $1`,
        [hash]
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0]).toMatchObject({ userId: user.id, revoked: false });
    });

    it('400 VALIDATION_ERROR with details[] for a weak password', async () => {
      const r = await req<Envelope>('POST', '/api/auth/register', {
        body: { email: uniqueEmail(), password: 'short' },
      });
      expect(r.status).toBe(400);
      expect(r.body.success).toBe(false);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      // details is the raw zod issue array (register.ts:29-37)
      expect(Array.isArray(r.body.error?.details)).toBe(true);
    });

    it('409 USER_ALREADY_EXISTS on duplicate email', async () => {
      const email = uniqueEmail();
      await registerUser(req, { email });
      const r = await req<Envelope>('POST', '/api/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      expect(r.status).toBe(409);
      expect(r.body.error?.code).toBe('USER_ALREADY_EXISTS');
    });

    it('405 METHOD_NOT_ALLOWED for GET', async () => {
      const r = await req<Envelope>('GET', '/api/auth/register');
      expect(r.status).toBe(405);
      expect(r.body.error?.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('POST /api/auth/login', () => {
    it('200 with the same nested shape as register', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope<AuthData>>('POST', '/api/auth/login', {
        body: { email: u.email, password: u.password },
      });
      expect(r.status).toBe(200);
      expect(r.body.data?.user).toMatchObject({ id: u.userId, email: u.email });
      expect(r.body.data?.tokens.accessToken).toEqual(expect.any(String));
      expect(r.body.data?.tokens.refreshToken).toEqual(expect.any(String));
      expect(r.body.data?.tokens.expiresAt).toEqual(expect.any(Number));
    });

    it('401 INVALID_CREDENTIALS for a wrong password AND for an unknown email (no user enumeration)', async () => {
      const u = await registerUser(req);
      const wrongPw = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: u.email, password: 'Wrong123456' },
      });
      expect(wrongPw.status).toBe(401);
      expect(wrongPw.body.error?.code).toBe('INVALID_CREDENTIALS');

      const unknown = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: uniqueEmail(), password: TEST_PASSWORD },
      });
      expect(unknown.status).toBe(401);
      expect(unknown.body.error?.code).toBe('INVALID_CREDENTIALS');
      // Identical message so responses cannot probe for accounts.
      expect(unknown.body.error?.message).toBe(wrongPw.body.error?.message);
    });

    it('400 VALIDATION_ERROR for a malformed email', async () => {
      const r = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: 'not-an-email', password: 'x' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    it('200 with id/email/name/createdAt/profile (consumed by src/services/api/auth.ts:309-321 verifyToken)', async () => {
      const u = await registerUser(req, { name: 'Me User' });
      const r = await req<
        Envelope<{
          id: string;
          email: string;
          name: string;
          createdAt: string;
          profile: { timezone: string } | null;
        }>
      >('GET', '/api/auth/me', { token: u.accessToken });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        id: u.userId,
        email: u.email,
        name: 'Me User',
        // Registration seeds user_profiles with timezone UTC (AuthService.ts:79)
        profile: { timezone: 'UTC' },
      });
      expect(new Date(r.body.data!.createdAt).getTime()).not.toBeNaN();
    });

    it('405 for POST', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope>('POST', '/api/auth/me', {
        token: u.accessToken,
        body: {},
      });
      expect(r.status).toBe(405);
      expect(r.body.error?.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('POST /api/auth/refresh (rotation + reuse detection)', () => {
    it('200 rotates: returns a NEW pair (flat tokens shape, src/services/api/auth.ts:195-212) and revokes the old refresh token', async () => {
      const u = await registerUser(req);
      const r = await req<
        Envelope<{
          accessToken: string;
          refreshToken: string;
          expiresAt: number;
        }>
      >('POST', '/api/auth/refresh', {
        body: { refreshToken: u.refreshToken },
      });
      expect(r.status).toBe(200);
      // NOTE: refresh data is FLAT (TokenPair), unlike register/login (nested).
      expect(r.body.data?.accessToken).toEqual(expect.any(String));
      expect(r.body.data?.refreshToken).toEqual(expect.any(String));
      expect(r.body.data?.refreshToken).not.toBe(u.refreshToken);
      expect(r.body.data?.expiresAt).toEqual(expect.any(Number));

      // New access token works against a protected route.
      const me = await req<Envelope>('GET', '/api/auth/me', {
        token: r.body.data!.accessToken,
      });
      expect(me.status).toBe(200);
    });

    it('401 TOKEN_REUSE_DETECTED when an already-rotated token is replayed, and the whole family is revoked', async () => {
      const u = await registerUser(req);
      const first = await req<Envelope<{ refreshToken: string }>>(
        'POST',
        '/api/auth/refresh',
        { body: { refreshToken: u.refreshToken } }
      );
      expect(first.status).toBe(200);

      // Replay the ORIGINAL (now revoked) token -> breach detection.
      const replay = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: u.refreshToken },
      });
      expect(replay.status).toBe(401);
      expect(replay.body.error?.code).toBe('TOKEN_REUSE_DETECTED');

      // Family revocation: the rotated token from `first` is now dead too.
      const afterBreach = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: first.body.data!.refreshToken },
      });
      expect(afterBreach.status).toBe(401);
      expect(afterBreach.body.error?.code).toBe('TOKEN_REUSE_DETECTED');
    });

    it('401 INVALID_REFRESH_TOKEN for a garbage token and for an access token', async () => {
      const garbage = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: 'not-a-jwt' },
      });
      expect(garbage.status).toBe(401);
      expect(garbage.body.error?.code).toBe('INVALID_REFRESH_TOKEN');

      // An access token is never stored in refresh_tokens -> NOT_FOUND path.
      const u = await registerUser(req);
      const access = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: u.accessToken },
      });
      expect(access.status).toBe(401);
      expect(access.body.error?.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('400 VALIDATION_ERROR when refreshToken is missing', async () => {
      const r = await req<Envelope>('POST', '/api/auth/refresh', { body: {} });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('200 revokes the refresh token; replaying it afterwards is treated as reuse', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/logout',
        { body: { refreshToken: u.refreshToken } }
      );
      expect(r.status).toBe(200);
      expect(r.body.data?.message).toBe('Logged out successfully');

      // The revoked token presented again -> reuse detection (family revoked).
      const after = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: u.refreshToken },
      });
      expect(after.status).toBe(401);
      expect(after.body.error?.code).toBe('TOKEN_REUSE_DETECTED');
    });

    it('logoutAll with Bearer access token revokes every session', async () => {
      const u = await registerUser(req);
      // Second session for the same user.
      const login = await req<Envelope<AuthData>>('POST', '/api/auth/login', {
        body: { email: u.email, password: u.password },
      });
      const secondRefresh = login.body.data!.tokens.refreshToken;

      const r = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/logout',
        {
          token: u.accessToken,
          body: { refreshToken: u.refreshToken, logoutAll: true },
        }
      );
      expect(r.status).toBe(200);
      expect(r.body.data?.message).toBe('Logged out from all devices');

      const other = await req<Envelope>('POST', '/api/auth/refresh', {
        body: { refreshToken: secondRefresh },
      });
      expect(other.status).toBe(401);
    });

    it('400 VALIDATION_ERROR without refreshToken', async () => {
      const r = await req<Envelope>('POST', '/api/auth/logout', { body: {} });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/forgot-password + /api/auth/reset-password', () => {
    it('forgot-password answers the same generic 200 for existing and unknown emails (frontend shows data.message, src/services/api/auth.ts:384)', async () => {
      const u = await registerUser(req);
      const known = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/forgot-password',
        { body: { email: u.email } }
      );
      const unknown = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/forgot-password',
        { body: { email: uniqueEmail() } }
      );
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body.data?.message).toBe(unknown.body.data?.message);
    });

    it('full reset round-trip: token redeems once (200), new password logs in, replay is 400 RESET_TOKEN_USED', async () => {
      const u = await registerUser(req);
      // Seed a reset token directly: only the SHA-256 hash is stored
      // (AuthService.requestPasswordReset), so tests plant a known token.
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await cleanupPool!.query(
        `INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, NOW() + interval '1 hour', NOW())`,
        [u.userId, tokenHash]
      );

      const newPassword = 'Brand2NewPass';
      const reset = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/reset-password',
        { body: { token: rawToken, newPassword } }
      );
      expect(reset.status).toBe(200);
      expect(reset.body.data?.message).toEqual(expect.any(String));

      const login = await req<Envelope<AuthData>>('POST', '/api/auth/login', {
        body: { email: u.email, password: newPassword },
      });
      expect(login.status).toBe(200);

      const replay = await req<Envelope>('POST', '/api/auth/reset-password', {
        body: { token: rawToken, newPassword: 'Another2Pass' },
      });
      expect(replay.status).toBe(400);
      expect(replay.body.error?.code).toBe('RESET_TOKEN_USED');
    });

    it('400 INVALID_RESET_TOKEN for an unknown token, RESET_TOKEN_EXPIRED for an expired one', async () => {
      const bad = await req<Envelope>('POST', '/api/auth/reset-password', {
        body: { token: 'deadbeef', newPassword: 'Valid1Password' },
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error?.code).toBe('INVALID_RESET_TOKEN');

      const u = await registerUser(req);
      const rawToken = randomBytes(32).toString('hex');
      await cleanupPool!.query(
        `INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, NOW() - interval '1 minute', NOW())`,
        [u.userId, createHash('sha256').update(rawToken).digest('hex')]
      );
      const expired = await req<Envelope>('POST', '/api/auth/reset-password', {
        body: { token: rawToken, newPassword: 'Valid1Password' },
      });
      expect(expired.status).toBe(400);
      expect(expired.body.error?.code).toBe('RESET_TOKEN_EXPIRED');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('200 changes the password; old password stops working', async () => {
      const u = await registerUser(req);
      const newPassword = 'Changed1Pass!';
      const r = await req<Envelope<{ message: string }>>(
        'POST',
        '/api/auth/change-password',
        {
          token: u.accessToken,
          body: { currentPassword: u.password, newPassword },
        }
      );
      expect(r.status).toBe(200);
      expect(r.body.data?.message).toBe('Password updated successfully');

      const oldLogin = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: u.email, password: u.password },
      });
      expect(oldLogin.status).toBe(401);
      const newLogin = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: u.email, password: newPassword },
      });
      expect(newLogin.status).toBe(200);
    });

    it('400 INVALID_CURRENT_PASSWORD for a wrong current password', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope>('POST', '/api/auth/change-password', {
        token: u.accessToken,
        body: { currentPassword: 'Wrong1Current', newPassword: 'Valid1Pass!' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('400 WEAK_PASSWORD: change-password demands a special character that register does NOT (pins issue #66)', async () => {
      // register accepts TEST_PASSWORD ('Password123', no special char), but
      // AuthService.validatePassword (used only by change-password) also
      // requires a special character, so a user can never "change" to a
      // password of the same strength they registered with. Issue #66 tracks
      // unifying the policy; update this pin when it lands.
      const u = await registerUser(req);
      const r = await req<Envelope>('POST', '/api/auth/change-password', {
        token: u.accessToken,
        body: { currentPassword: u.password, newPassword: 'NewPassword123' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('WEAK_PASSWORD');
      expect(Array.isArray(r.body.error?.details)).toBe(true);
    });
  });

  describe('google OAuth surfaces (no live Google; unauthenticated/validation only)', () => {
    it('GET /api/auth/google -> 503 GOOGLE_OAUTH_NOT_CONFIGURED when client env is absent', async () => {
      const r = await req<Envelope>('GET', '/api/auth/google');
      expect(r.status).toBe(503);
      expect(r.body.error?.code).toBe('GOOGLE_OAUTH_NOT_CONFIGURED');
    });

    it('POST /api/auth/google/verify -> 400 VALIDATION_ERROR without idToken', async () => {
      const r = await req<Envelope>('POST', '/api/auth/google/verify', {
        body: {},
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});
