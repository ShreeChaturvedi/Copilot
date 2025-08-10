import { getTokenExpiration } from '../utils/jwt.js';

/**
 * In-memory token blacklist service
 * In production, this should use Redis or a database
 */
class TokenBlacklistService {
  private blacklistedTokens: Set<string> = new Set();
  private tokenExpirations: Map<string, number> = new Map();

  /**
   * Add token to blacklist
   */
  blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);
    
    // Store expiration time for cleanup
    const expiration = getTokenExpiration(token);
    if (expiration) {
      this.tokenExpirations.set(token, expiration);
    }
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Clean up expired tokens from blacklist
   * This should be called periodically
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredTokens: string[] = [];

    for (const [token, expiration] of this.tokenExpirations.entries()) {
      if (expiration < now) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.blacklistedTokens.delete(token);
      this.tokenExpirations.delete(token);
    }
  }

  /**
   * Get blacklist statistics
   */
  getStats(): { totalBlacklisted: number; expiredTokens: number } {
    const now = Date.now();
    let expiredCount = 0;

    for (const expiration of this.tokenExpirations.values()) {
      if (expiration < now) {
        expiredCount++;
      }
    }

    return {
      totalBlacklisted: this.blacklistedTokens.size,
      expiredTokens: expiredCount
    };
  }

  /**
   * Clear all blacklisted tokens (for testing)
   */
  clear(): void {
    this.blacklistedTokens.clear();
    this.tokenExpirations.clear();
  }
}

// Singleton instance
export const tokenBlacklistService = new TokenBlacklistService();

// Cleanup expired tokens every hour
setInterval(() => {
  tokenBlacklistService.cleanupExpiredTokens();
}, 60 * 60 * 1000);

export default TokenBlacklistService;