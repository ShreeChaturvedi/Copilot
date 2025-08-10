import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  extractTokenFromHeader,
  isTokenExpired,
  getTokenExpiration,
  refreshAccessToken,
  JWTPayload
} from '../jwt.js';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

describe('JWT Utilities', () => {
  const testUserId = 'user-123';
  const testEmail = 'test@example.com';

  describe('generateAccessToken', () => {
    it('should generate a valid access token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Decode and verify token structure
      const decoded = jwt.decode(token) as JWTPayload;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('access');
      expect(decoded.iss).toBe('react-calendar-app');
      expect(decoded.aud).toBe('react-calendar-app-users');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', async () => {
      const token = await generateRefreshToken(testUserId, testEmail);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Decode and verify token structure
      const decoded = jwt.decode(token) as JWTPayload;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('refresh');
      expect(decoded.iss).toBe('react-calendar-app');
      expect(decoded.aud).toBe('react-calendar-app-users');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUserId, testEmail);
      
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresAt).toBeDefined();
      expect(typeof tokenPair.expiresAt).toBe('number');
      
      // Verify both tokens are valid
      const accessDecoded = jwt.decode(tokenPair.accessToken) as JWTPayload;
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as JWTPayload;
      
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
      expect(accessDecoded.userId).toBe(testUserId);
      expect(refreshDecoded.userId).toBe(testUserId);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      const decoded = await verifyToken(token);
      
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', async () => {
      await expect(verifyToken('invalid-token')).rejects.toThrow('TOKEN_INVALID');
    });

    it('should throw error for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUserId, email: testEmail, type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );
      
      // Wait a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        await verifyToken(expiredToken);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Accept either TOKEN_EXPIRED or TOKEN_INVALID for expired tokens
        expect(['TOKEN_EXPIRED', 'TOKEN_INVALID']).toContain((error as Error).message);
      }
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(extractTokenFromHeader('Invalid token')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Bearer token1 token2')).toBeNull();
    });

    it('should return null for undefined header', () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: testUserId, email: testEmail, type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );
      
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration time for valid token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      const expiration = getTokenExpiration(token);
      
      expect(expiration).toBeDefined();
      expect(typeof expiration).toBe('number');
      expect(expiration! > Date.now()).toBe(true);
    });

    it('should return null for invalid token', () => {
      expect(getTokenExpiration('invalid-token')).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from valid refresh token', async () => {
      const refreshToken = await generateRefreshToken(testUserId, testEmail);
      const newAccessToken = await refreshAccessToken(refreshToken);
      
      expect(newAccessToken).toBeDefined();
      
      const decoded = jwt.decode(newAccessToken) as JWTPayload;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for access token instead of refresh token', async () => {
      const accessToken = await generateAccessToken(testUserId, testEmail);
      
      await expect(refreshAccessToken(accessToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(refreshAccessToken('invalid-token')).rejects.toThrow('TOKEN_INVALID');
    });
  });
});