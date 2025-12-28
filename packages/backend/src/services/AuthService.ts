import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, withTransaction } from '../config/database.js';
import { generateTokenPair, TokenPair } from '../utils/jwt.js';
import { refreshTokenService } from './RefreshTokenService.js';

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
      }>(
        `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
         RETURNING id, email, name, "createdAt"`,
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

    // Generate tokens
    const tokens = await generateTokenPair(user.id, user.email);

    // Store refresh token
    refreshTokenService.storeRefreshToken(
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
    }>(
      `SELECT id, email, name, password, "createdAt" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
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

    // Generate tokens
    const tokens = await generateTokenPair(user.id, user.email);

    // Store refresh token
    refreshTokenService.storeRefreshToken(
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
   * Request password reset (generates reset token)
   */
  async requestPasswordReset(email: string): Promise<string> {
    const result = await query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      // Don't reveal if user exists or not
      throw new Error('PASSWORD_RESET_REQUESTED');
    }

    // Generate a secure reset token (in production, this should be stored in database)
    const resetToken = this.generateSecureToken();

    // In a real implementation, you would:
    // 1. Store the reset token in database with expiration
    // 2. Send email with reset link
    // For now, we'll just return the token

    return resetToken;
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(
    _token: string,
    _newPassword: string
  ): Promise<void> {
    // In a real implementation, you would:
    // 1. Verify the reset token from database
    // 2. Check if token is not expired
    // 3. Update user password
    // 4. Invalidate the reset token

    // For now, this is a placeholder
    throw new Error('PASSWORD_RESET_NOT_IMPLEMENTED');
  }

  /**
   * Generate secure token for password reset
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
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
