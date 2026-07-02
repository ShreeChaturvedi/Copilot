/**
 * AuthService — L2 suite against a REAL Postgres.
 *
 * Complements the mocked AuthService.test.ts (real bcrypt over mocked SQL).
 * This exercises real rows: registration (hashed password + user_profile +
 * refresh-token row), login success/failure branches, password update/verify,
 * the password-reset token lifecycle (single-use, expiry), and refresh-token
 * rotation + revocation.
 *
 * Gated on L2_TEST_DATABASE_URL so the DB-less runs skip it. It points at its
 * OWN test database (distinct from comprehensive-requirements' DATABASE_URL) so
 * that suite's global cleanup can never race this one. It seeds only l2auth-*
 * users and deletes them (cascades cover profiles/tokens) in afterAll.
 *
 * Run:
 *   L2_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow_l2_test \
 *     npx vitest run src/services/__tests__/AuthService.db.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const DB_URL = process.env.L2_TEST_DATABASE_URL;
const PREFIX = 'l2auth-';

type Db = typeof import('../../config/database.js');
type AuthMod = typeof import('../AuthService.js');
type AuthServiceInstance = InstanceType<AuthMod['default']>;
type Jwt = typeof import('../../utils/jwt.js');
type RtMod = typeof import('../RefreshTokenService.js');

const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');
const email = () => `${PREFIX}${crypto.randomUUID().slice(0, 12)}@example.com`;

describe.skipIf(!DB_URL)('AuthService (real Postgres, L2)', () => {
  let db: Db;
  let auth: AuthServiceInstance;
  let jwt: Jwt;
  let rt: RtMod['refreshTokenService'];

  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL!;
    db = await import('../../config/database.js');
    const authMod = await import('../AuthService.js');
    auth = new authMod.default();
    jwt = await import('../../utils/jwt.js');
    rt = (await import('../RefreshTokenService.js')).refreshTokenService;
  });

  afterAll(async () => {
    // Delete only this suite's users; cascades cover profiles + tokens. We do
    // NOT call pool.end() here: this workspace's database.ts ends the pool from
    // its own process 'beforeExit' handler (without a guard), so ending it here
    // too would surface a "Called end on pool more than once" rejection. This
    // matches comprehensive-requirements.test.ts, which also leaves it open.
    if (db) {
      await db
        .query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`])
        .catch(() => {});
    }
  });

  describe('registerUser', () => {
    it('creates a user with a hashed password, a profile, and a stored refresh token', async () => {
      const e = email();
      const result = await auth.registerUser({
        email: e,
        password: 'Secret123!',
        name: 'Ada',
      });

      expect(result.user.email).toBe(e);
      expect(result.user.name).toBe('Ada');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();

      // Password is bcrypt-hashed, never stored in the clear.
      const row = await db.query<{ password: string | null }>(
        `SELECT password FROM users WHERE id = $1`,
        [result.user.id]
      );
      expect(row.rows[0].password).not.toBe('Secret123!');
      expect(await bcrypt.compare('Secret123!', row.rows[0].password!)).toBe(
        true
      );

      // A user_profile row is created at registration.
      const profile = await db.query<{ timezone: string }>(
        `SELECT timezone FROM user_profiles WHERE "userId" = $1`,
        [result.user.id]
      );
      expect(profile.rows[0].timezone).toBe('UTC');

      // A single default 'Personal' calendar is created at registration so the
      // calendar view isn't empty on first load.
      const calendars = await db.query<{
        name: string;
        isDefault: boolean;
        isVisible: boolean;
      }>(
        `SELECT name, "isDefault", "isVisible" FROM calendars WHERE "userId" = $1`,
        [result.user.id]
      );
      expect(calendars.rowCount).toBe(1);
      expect(calendars.rows[0].name).toBe('Personal');
      expect(calendars.rows[0].isDefault).toBe(true);
      expect(calendars.rows[0].isVisible).toBe(true);

      // The refresh token is persisted (hashed) and linked to the user.
      const stored = await db.query<{ userId: string }>(
        `SELECT "userId" FROM refresh_tokens WHERE "tokenHash" = $1`,
        [sha256(result.tokens.refreshToken)]
      );
      expect(stored.rows[0]?.userId).toBe(result.user.id);

      // Access token carries the userId, email and the default USER role claim.
      const decoded = await jwt.verifyToken(result.tokens.accessToken);
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(e);
      expect(decoded.type).toBe('access');
      expect(decoded.role).toBe('USER');
    });

    it('rejects a duplicate email', async () => {
      const e = email();
      await auth.registerUser({ email: e, password: 'Secret123!' });
      await expect(
        auth.registerUser({ email: e, password: 'Secret123!' })
      ).rejects.toThrow('USER_ALREADY_EXISTS');
    });

    it('lowercases the email on registration', async () => {
      const e = email().toUpperCase();
      const result = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      expect(result.user.email).toBe(e.toLowerCase());
    });
  });

  describe('loginUser', () => {
    it('returns tokens for correct credentials', async () => {
      const e = email();
      await auth.registerUser({
        email: e,
        password: 'Secret123!',
        name: 'Grace',
      });
      const result = await auth.loginUser({ email: e, password: 'Secret123!' });
      expect(result.user.email).toBe(e);
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('rejects a wrong password and an unknown email with INVALID_CREDENTIALS', async () => {
      const e = email();
      await auth.registerUser({ email: e, password: 'Secret123!' });
      await expect(
        auth.loginUser({ email: e, password: 'wrong' })
      ).rejects.toThrow('INVALID_CREDENTIALS');
      await expect(
        auth.loginUser({ email: email(), password: 'whatever' })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('rejects an OAuth-only account (no password) with OAUTH_USER_NO_PASSWORD', async () => {
      const e = email();
      await db.query(
        `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'OAuth', NULL, NOW(), NOW())`,
        [e]
      );
      await expect(auth.loginUser({ email: e, password: 'x' })).rejects.toThrow(
        'OAUTH_USER_NO_PASSWORD'
      );
    });
  });

  describe('lookups', () => {
    it('getUserById returns the user with its profile timezone; null when missing', async () => {
      const e = email();
      const { user } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      const found = await auth.getUserById(user.id);
      expect(found?.email).toBe(e);
      expect(found?.profile?.timezone).toBe('UTC');
      expect(await auth.getUserById('does-not-exist')).toBeNull();
    });

    it('getUserByEmail is case-insensitive', async () => {
      const e = email();
      await auth.registerUser({ email: e, password: 'Secret123!' });
      const found = await auth.getUserByEmail(e.toUpperCase());
      expect(found?.email).toBe(e);
    });
  });

  describe('password update + verify', () => {
    it('updatePassword changes the hash so old fails and new succeeds', async () => {
      const e = email();
      const { user } = await auth.registerUser({
        email: e,
        password: 'OldPass123!',
      });
      expect(await auth.verifyPassword(user.id, 'OldPass123!')).toBe(true);

      await auth.updatePassword(user.id, 'NewPass456!');
      expect(await auth.verifyPassword(user.id, 'OldPass123!')).toBe(false);
      expect(await auth.verifyPassword(user.id, 'NewPass456!')).toBe(true);

      // The new password logs in.
      const login = await auth.loginUser({ email: e, password: 'NewPass456!' });
      expect(login.tokens.accessToken).toBeTruthy();
    });
  });

  describe('password reset token lifecycle', () => {
    it('requestPasswordReset stores a hashed token for a known email', async () => {
      const e = email();
      const { user } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      await auth.requestPasswordReset(e);
      const rows = await db.query<{ tokenHash: string }>(
        `SELECT "tokenHash" FROM password_reset_tokens WHERE "userId" = $1`,
        [user.id]
      );
      expect(rows.rowCount).toBe(1);
    });

    it('requestPasswordReset is silent and writes nothing for an unknown email', async () => {
      const before = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM password_reset_tokens`
      );
      await expect(auth.requestPasswordReset(email())).resolves.toBeUndefined();
      const after = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM password_reset_tokens`
      );
      expect(after.rows[0].count).toBe(before.rows[0].count);
    });

    it('confirmPasswordReset sets the new password once, then rejects reuse', async () => {
      const e = email();
      const { user } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      const rawToken = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, NOW() + interval '1 hour', NOW())`,
        [user.id, sha256(rawToken)]
      );

      await auth.confirmPasswordReset(rawToken, 'Reset789!');
      expect(await auth.verifyPassword(user.id, 'Reset789!')).toBe(true);

      // Single-use: the token is now marked used.
      const used = await db.query<{ usedAt: Date | null }>(
        `SELECT "usedAt" FROM password_reset_tokens WHERE "tokenHash" = $1`,
        [sha256(rawToken)]
      );
      expect(used.rows[0].usedAt).not.toBeNull();

      await expect(
        auth.confirmPasswordReset(rawToken, 'Again000!')
      ).rejects.toThrow('RESET_TOKEN_USED');
    });

    it('rejects an expired token and an unknown token', async () => {
      const e = email();
      const { user } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      const expired = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, NOW() - interval '1 minute', NOW())`,
        [user.id, sha256(expired)]
      );
      await expect(
        auth.confirmPasswordReset(expired, 'Nope123!')
      ).rejects.toThrow('RESET_TOKEN_EXPIRED');
      await expect(
        auth.confirmPasswordReset('never-issued', 'Nope123!')
      ).rejects.toThrow('INVALID_RESET_TOKEN');
    });
  });

  describe('refresh token rotation (real rows)', () => {
    it('rotates the token, revokes the old one, and validates the new one', async () => {
      const e = email();
      const { tokens } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      const oldRefresh = tokens.refreshToken;

      const rotated = await rt.rotateRefreshToken(oldRefresh);
      expect(rotated.refreshToken).not.toBe(oldRefresh);

      // The new token validates...
      const info = await rt.validateRefreshToken(rotated.refreshToken);
      expect(info.email).toBe(e);

      // ...and the old token is revoked (row updated), so it no longer validates.
      await expect(rt.validateRefreshToken(oldRefresh)).rejects.toThrow(
        'REFRESH_TOKEN_NOT_FOUND'
      );
      const oldRow = await db.query<{ revoked: boolean }>(
        `SELECT revoked FROM refresh_tokens WHERE "tokenHash" = $1`,
        [sha256(oldRefresh)]
      );
      expect(oldRow.rows[0].revoked).toBe(true);
    });

    it('detects reuse of a revoked token and revokes the whole family', async () => {
      const e = email();
      const { tokens } = await auth.registerUser({
        email: e,
        password: 'Secret123!',
      });
      const oldRefresh = tokens.refreshToken;
      const rotated = await rt.rotateRefreshToken(oldRefresh); // revokes oldRefresh

      // Presenting the already-revoked token is treated as a breach.
      expect(await rt.detectTokenReuse(oldRefresh)).toBe(true);
      // The family (including the rotated live token) is now revoked.
      await expect(
        rt.validateRefreshToken(rotated.refreshToken)
      ).rejects.toThrow('REFRESH_TOKEN_NOT_FOUND');
    });
  });
});
