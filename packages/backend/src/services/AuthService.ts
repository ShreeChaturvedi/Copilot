import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, withTransaction } from '../config/database.js';
import { generateTokenPair, TokenPair } from '../utils/jwt.js';
import { refreshTokenService } from './RefreshTokenService.js';

// Password reset tokens are valid for one hour.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  tokens: TokenPair;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

class AuthService {
  private readonly saltRounds = 12;
  constructor() {}

  /**
   * Register a new user with email and password
   */
  async registerUser(userData: RegisterUserData): Promise<AuthResult> {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()]
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await withTransaction(async (tx) => {
      const insert = await query<{
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        role: string;
      }>(
        `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
         RETURNING id, email, name, "createdAt", "role"`,
        [email.toLowerCase(), name || null, hashedPassword],
        tx
      );
      const u = insert.rows[0];
      await query(
        `INSERT INTO user_profiles (id, "userId", timezone) VALUES (gen_random_uuid()::text, $1, 'UTC')`,
        [u.id],
        tx
      );
      return u;
    });

    // Generate tokens (carry the role claim so requireRole avoids a DB lookup)
    const tokens = await generateTokenPair(user.id, user.email, user.role);

    // Store refresh token
    await refreshTokenService.storeRefreshToken(
      tokens.refreshToken,
      user.id,
      user.email
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    // Find user by email
    const res = await query<{
      id: string;
      email: string;
      name: string | null;
      password: string | null;
      createdAt: Date;
      role: string;
    }>(
      `SELECT id, email, name, password, "createdAt", "role" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.toLowerCase()]
    );
    const user = res.rows[0];

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.password) {
      throw new Error('OAUTH_USER_NO_PASSWORD');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Generate tokens (carry the role claim so requireRole avoids a DB lookup)
    const tokens = await generateTokenPair(user.id, user.email, user.role);

    // Store refresh token
    await refreshTokenService.storeRefreshToken(
      tokens.refreshToken,
      user.id,
      user.email
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      timezone: string | null;
    }>(
      `SELECT u.id, u.email, u.name, u."createdAt", p.timezone
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...row,
      profile: row.timezone ? { timezone: row.timezone } : null,
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      timezone: string | null;
    }>(
      `SELECT u.id, u.email, u.name, u."createdAt", p.timezone
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [email]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...row,
      profile: row.timezone ? { timezone: row.timezone } : null,
    };
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await query(
      `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
      [hashedPassword, userId]
    );
  }

  /**
   * Verify password for a user
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const res = await query<{ id: string; password: string | null }>(
      `SELECT id, password FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const user = res.rows[0];

    if (!user || !user.password) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  /**
   * Request a password reset. Persists a hashed, single-use token with a ~1h
   * expiry and emails the reset link (via Resend when configured, otherwise
   * logs it). Always resolves the same way whether or not the email is
   * registered, so the response cannot be used to probe for accounts.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const result = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    const user = result.rows[0];

    // Do not reveal whether the email exists: silently return on no match.
    if (!user) {
      return;
    }

    // Generate a high-entropy token; only its SHA-256 hash is persisted.
    const resetToken = this.generateSecureToken();
    const tokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await query(
      `INSERT INTO password_reset_tokens
         (id, "userId", "tokenHash", "expiresAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
      [user.id, tokenHash, expiresAt]
    );

    await this.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Confirm a password reset: look the token up by hash, verify it is unused
   * and unexpired, set the new bcrypt password, and mark the token used. The
   * lookup/update runs in a transaction so a token cannot be redeemed twice.
   */
  async confirmPasswordReset(
    token: string,
    newPassword: string
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await withTransaction(async (tx) => {
      const res = await query<{
        id: string;
        userId: string;
        expiresAt: Date;
        usedAt: Date | null;
      }>(
        `SELECT id, "userId", "expiresAt", "usedAt"
         FROM password_reset_tokens
         WHERE "tokenHash" = $1
         LIMIT 1
         FOR UPDATE`,
        [tokenHash],
        tx
      );
      const row = res.rows[0];

      if (!row) {
        throw new Error('INVALID_RESET_TOKEN');
      }
      if (row.usedAt) {
        throw new Error('RESET_TOKEN_USED');
      }
      if (new Date(row.expiresAt).getTime() <= Date.now()) {
        throw new Error('RESET_TOKEN_EXPIRED');
      }

      await query(
        `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
        [hashedPassword, row.userId],
        tx
      );
      await query(
        `UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = $1`,
        [row.id],
        tx
      );
    });
  }

  /**
   * Generate secure token for password reset
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * SHA-256 hash of a reset token. Only the hash is stored, never the raw
   * token (mirrors RefreshTokenService).
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Send the password reset link. Uses Resend's HTTP API when both
   * RESEND_API_KEY and FROM_EMAIL are set; otherwise logs the link so the
   * flow stays usable in local/dev without email configured.
   */
  private async sendPasswordResetEmail(
    email: string,
    token: string
  ): Promise<void> {
    // Prefer an explicit FRONTEND_URL so links point at the canonical host,
    // then the stable Vercel production domain, then the deployment-specific
    // VERCEL_URL, and finally the real local Vite dev port (5173, not 3000).
    const baseUrl =
      process.env.FRONTEND_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:5173');
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(
      token
    )}`;

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.log(`[password-reset] Reset link for ${email}: ${resetLink}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: 'Reset your Taskflow password',
          html: `<p>We received a request to reset your Taskflow password.</p>
<p><a href="${resetLink}">Click here to choose a new password</a>. This link expires in 1 hour and can be used once.</p>
<p>If you did not request this, you can safely ignore this email.</p>`,
          text: `Reset your Taskflow password using this link (expires in 1 hour, single use): ${resetLink}\n\nIf you did not request this, you can ignore this email.`,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error(
          `[password-reset] Resend send failed (${response.status}): ${detail}`
        );
      }
    } catch (err) {
      // Never surface email-delivery failures to the caller: the request
      // response must stay generic regardless of email outcome.
      console.error('[password-reset] Failed to send reset email:', err);
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Singleton instance
export const authService = new AuthService();
export default AuthService;
