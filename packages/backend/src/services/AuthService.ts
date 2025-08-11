import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
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
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Register a new user with email and password
   */
  async registerUser(userData: RegisterUserData): Promise<AuthResult> {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        profile: {
          create: {
            timezone: 'UTC'
          }
        }
      },
      include: {
        profile: true
      }
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
        createdAt: user.createdAt
      },
      tokens
    };
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

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
        createdAt: user.createdAt
      },
      tokens
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true
      }
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        profile: true
      }
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
  }

  /**
   * Verify password for a user
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.password) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  /**
   * Request password reset (generates reset token)
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async confirmPasswordReset(_token: string, _newPassword: string): Promise<void> {
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
      errors
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