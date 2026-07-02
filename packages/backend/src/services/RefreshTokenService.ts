import crypto from 'crypto';
import {
  generateTokenPair,
  verifyToken,
  getTokenExpiration,
  type TokenPair,
} from '../utils/jwt.js';
import { query } from '../config/database.js';

/**
 * Refresh token service with rotation and reuse detection, backed by the
 * `refresh_tokens` table.
 *
 * Serverless functions are stateless and short-lived, so an in-memory store
 * loses every session on each cold start. Tokens are persisted here; only a
 * SHA-256 hash of each token is stored (never the raw token). Revocation is a
 * boolean column, which also replaces the old in-memory blacklist.
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokenFamily(): string {
  return `family_${crypto.randomBytes(12).toString('hex')}`;
}

class RefreshTokenService {
  /**
   * Persist a refresh token (hashed) so it can later be validated/rotated.
   */
  async storeRefreshToken(
    refreshToken: string,
    userId: string,
    email: string,
    family?: string
  ): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const expMs =
      getTokenExpiration(refreshToken) ?? Date.now() + SEVEN_DAYS_MS;
    const tokenFamily = family || generateTokenFamily();

    await query(
      `INSERT INTO refresh_tokens
         (id, "tokenHash", "userId", email, family, "issuedAt", "expiresAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), $5)
       ON CONFLICT ("tokenHash") DO NOTHING`,
      [tokenHash, userId, email, tokenFamily, new Date(expMs)]
    );
  }

  /**
   * Validate a refresh token against the store and its JWT signature.
   * Throws error codes the /api/auth/refresh handler maps to HTTP responses.
   */
  async validateRefreshToken(refreshToken: string): Promise<{
    userId: string;
    email: string;
    family: string;
  }> {
    const tokenHash = hashToken(refreshToken);
    const res = await query<{
      userId: string;
      email: string;
      family: string;
      revoked: boolean;
      expiresAt: Date;
    }>(
      `SELECT "userId", email, family, revoked, "expiresAt"
       FROM refresh_tokens WHERE "tokenHash" = $1 LIMIT 1`,
      [tokenHash]
    );
    const row = res.rows[0];

    if (!row || row.revoked) {
      // A revoked token presented for validation is indistinguishable from a
      // missing one to the caller; reuse is handled by detectTokenReuse().
      throw new Error('REFRESH_TOKEN_NOT_FOUND');
    }
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      throw new Error('TOKEN_EXPIRED');
    }

    // Verify JWT signature/expiry/type (throws TOKEN_EXPIRED/TOKEN_INVALID).
    const decoded = await verifyToken(refreshToken);
    if (decoded.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    if (decoded.userId !== row.userId) {
      throw new Error('TOKEN_USER_MISMATCH');
    }

    return { userId: row.userId, email: row.email, family: row.family };
  }

  /**
   * Rotate: validate the old token, issue a new pair in the same family, and
   * revoke the old token.
   */
  async rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
    const info = await this.validateRefreshToken(oldRefreshToken);
    // Carry the role claim into the rotated access token so requireRole avoids
    // a per-request DB lookup (refresh tokens themselves do not store the role).
    const roleRes = await query<{ role: string | null }>(
      `SELECT "role" FROM users WHERE id = $1 LIMIT 1`,
      [info.userId]
    );
    const role = roleRes.rows[0]?.role ?? undefined;
    const newPair = await generateTokenPair(info.userId, info.email, role);
    await this.storeRefreshToken(
      newPair.refreshToken,
      info.userId,
      info.email,
      info.family
    );
    await this.invalidateRefreshToken(oldRefreshToken);
    return newPair;
  }

  /**
   * Revoke a single refresh token.
   */
  async invalidateRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await query(
      `UPDATE refresh_tokens SET revoked = true, "revokedAt" = NOW()
       WHERE "tokenHash" = $1 AND revoked = false`,
      [tokenHash]
    );
  }

  /**
   * Revoke every refresh token for a user (logout from all devices).
   */
  async invalidateAllUserTokens(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked = true, "revokedAt" = NOW()
       WHERE "userId" = $1 AND revoked = false`,
      [userId]
    );
  }

  /**
   * Revoke an entire token family (used on reuse/breach detection).
   */
  async invalidateTokenFamily(family: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked = true, "revokedAt" = NOW()
       WHERE family = $1 AND revoked = false`,
      [family]
    );
  }

  /**
   * Detect refresh-token reuse: a token that exists but was already revoked is
   * being presented again. Treat as a breach and revoke the whole family.
   */
  async detectTokenReuse(refreshToken: string): Promise<boolean> {
    const tokenHash = hashToken(refreshToken);
    const res = await query<{ family: string; revoked: boolean }>(
      `SELECT family, revoked FROM refresh_tokens WHERE "tokenHash" = $1 LIMIT 1`,
      [tokenHash]
    );
    const row = res.rows[0];
    if (row && row.revoked) {
      await this.invalidateTokenFamily(row.family);
      return true;
    }
    return false;
  }

  /**
   * Delete expired token rows. Safe to call from a scheduled job; validation
   * already rejects expired tokens, so this is only housekeeping.
   */
  async cleanupExpiredTokens(): Promise<number> {
    const res = await query(
      `DELETE FROM refresh_tokens WHERE "expiresAt" < NOW()`,
      []
    );
    return res.rowCount ?? 0;
  }

  /**
   * Aggregate stats over non-revoked, non-expired tokens.
   */
  async getStats(): Promise<{
    totalActiveTokens: number;
    tokensByUser: Record<string, number>;
    oldestToken: number | null;
  }> {
    const res = await query<{ userId: string; issuedAt: Date }>(
      `SELECT "userId", "issuedAt" FROM refresh_tokens
       WHERE revoked = false AND "expiresAt" >= NOW()`,
      []
    );
    const tokensByUser: Record<string, number> = {};
    let oldestToken: number | null = null;
    for (const row of res.rows) {
      tokensByUser[row.userId] = (tokensByUser[row.userId] || 0) + 1;
      const issued = new Date(row.issuedAt).getTime();
      if (oldestToken === null || issued < oldestToken) oldestToken = issued;
    }
    return { totalActiveTokens: res.rows.length, tokensByUser, oldestToken };
  }

  /**
   * Remove all tokens (test helper).
   */
  async clear(): Promise<void> {
    await query(`DELETE FROM refresh_tokens`, []);
  }
}

// Singleton instance
export const refreshTokenService = new RefreshTokenService();

export default RefreshTokenService;
