import { generateTokenPair, verifyToken, TokenPair } from '../utils/jwt.js';
import { tokenBlacklistService } from './TokenBlacklistService.js';

/**
 * Refresh token service with token rotation
 * In production, this should use a database to store refresh tokens
 */
class RefreshTokenService {
  private validRefreshTokens: Map<string, {
    userId: string;
    email: string;
    issuedAt: number;
    family: string; // Token family for rotation detection
  }> = new Map();

  /**
   * Store refresh token information
   */
  storeRefreshToken(
    refreshToken: string,
    userId: string,
    email: string,
    family?: string
  ): void {
    const tokenFamily = family || this.generateTokenFamily();
    
    this.validRefreshTokens.set(refreshToken, {
      userId,
      email,
      issuedAt: Date.now(),
      family: tokenFamily
    });
  }

  /**
   * Validate refresh token and return user info
   */
  async validateRefreshToken(refreshToken: string): Promise<{
    userId: string;
    email: string;
    family: string;
  }> {
    // Check if token exists in our store
    const tokenInfo = this.validRefreshTokens.get(refreshToken);
    if (!tokenInfo) {
      throw new Error('REFRESH_TOKEN_NOT_FOUND');
    }

    // Verify JWT signature and expiration
    const decoded = await verifyToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }

    if (decoded.userId !== tokenInfo.userId) {
      throw new Error('TOKEN_USER_MISMATCH');
    }

    return {
      userId: tokenInfo.userId,
      email: tokenInfo.email,
      family: tokenInfo.family
    };
  }

  /**
   * Rotate refresh token - invalidate old token and create new token pair
   */
  async rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
    const tokenInfo = await this.validateRefreshToken(oldRefreshToken);
    
    // Generate new token pair
    const newTokenPair = await generateTokenPair(tokenInfo.userId, tokenInfo.email);
    
    // Store new refresh token with same family
    this.storeRefreshToken(
      newTokenPair.refreshToken,
      tokenInfo.userId,
      tokenInfo.email,
      tokenInfo.family
    );
    
    // Invalidate old refresh token
    this.invalidateRefreshToken(oldRefreshToken);
    
    return newTokenPair;
  }

  /**
   * Invalidate refresh token
   */
  invalidateRefreshToken(refreshToken: string): void {
    this.validRefreshTokens.delete(refreshToken);
    tokenBlacklistService.blacklistToken(refreshToken);
  }

  /**
   * Invalidate all refresh tokens for a user (logout from all devices)
   */
  invalidateAllUserTokens(userId: string): void {
    const tokensToInvalidate: string[] = [];
    
    for (const [token, tokenInfo] of this.validRefreshTokens.entries()) {
      if (tokenInfo.userId === userId) {
        tokensToInvalidate.push(token);
      }
    }
    
    for (const token of tokensToInvalidate) {
      this.invalidateRefreshToken(token);
    }
  }

  /**
   * Invalidate all tokens in a family (security breach detection)
   */
  invalidateTokenFamily(family: string): void {
    const tokensToInvalidate: string[] = [];
    
    for (const [token, tokenInfo] of this.validRefreshTokens.entries()) {
      if (tokenInfo.family === family) {
        tokensToInvalidate.push(token);
      }
    }
    
    for (const token of tokensToInvalidate) {
      this.invalidateRefreshToken(token);
    }
  }

  /**
   * Check if refresh token reuse is detected (security breach)
   */
  async detectTokenReuse(refreshToken: string): Promise<boolean> {
    try {
      // If token is blacklisted but someone tries to use it, it's reuse
      if (tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
        // Try to find the token family and invalidate all tokens in that family
        const decoded = await verifyToken(refreshToken);
        
        // Find any token with the same user to get the family
        for (const [, tokenInfo] of this.validRefreshTokens.entries()) {
          if (tokenInfo.userId === decoded.userId) {
            this.invalidateTokenFamily(tokenInfo.family);
            break;
          }
        }
        
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredTokens: string[] = [];
    
    for (const [token, tokenInfo] of this.validRefreshTokens.entries()) {
      // Check if token is expired (7 days by default)
      const tokenAge = now - tokenInfo.issuedAt;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      
      if (tokenAge > maxAge) {
        expiredTokens.push(token);
      }
    }
    
    for (const token of expiredTokens) {
      this.invalidateRefreshToken(token);
    }
  }

  /**
   * Generate unique token family identifier
   */
  private generateTokenFamily(): string {
    return `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get refresh token statistics
   */
  getStats(): {
    totalActiveTokens: number;
    tokensByUser: Record<string, number>;
    oldestToken: number | null;
  } {
    const tokensByUser: Record<string, number> = {};
    let oldestToken: number | null = null;
    
    for (const [, tokenInfo] of this.validRefreshTokens.entries()) {
      tokensByUser[tokenInfo.userId] = (tokensByUser[tokenInfo.userId] || 0) + 1;
      
      if (oldestToken === null || tokenInfo.issuedAt < oldestToken) {
        oldestToken = tokenInfo.issuedAt;
      }
    }
    
    return {
      totalActiveTokens: this.validRefreshTokens.size,
      tokensByUser,
      oldestToken
    };
  }

  /**
   * Clear all tokens (for testing)
   */
  clear(): void {
    this.validRefreshTokens.clear();
  }
}

// Singleton instance
export const refreshTokenService = new RefreshTokenService();

// Clean up expired tokens every hour
setInterval(() => {
  refreshTokenService.cleanupExpiredTokens();
}, 60 * 60 * 1000);

export default RefreshTokenService;