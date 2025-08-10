import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth, validateRefreshToken } from '../auth.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { tokenBlacklistService } from '../../services/TokenBlacklistService.js';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing';

// Mock request context
vi.mock('../../utils/requestContext.js', () => ({
  updateContextWithUser: vi.fn()
}));

describe('Authentication Middleware', () => {
  const testUserId = 'user-123';
  const testEmail = 'test@example.com';
  
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined,
      token: undefined
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    
    mockNext = vi.fn();
    
    // Clear blacklist before each test
    tokenBlacklistService.clear();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: testUserId,
        email: testEmail
      });
      expect(mockRequest.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization header format', async () => {
      mockRequest.headers = {
        authorization: 'Invalid token-format'
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      tokenBlacklistService.blacklistToken(token);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been invalidated',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject refresh token', async () => {
      const refreshToken = await generateRefreshToken(testUserId, testEmail);
      mockRequest.headers = {
        authorization: `Bearer ${refreshToken}`
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Access token required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token format',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token when provided', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: testUserId,
        email: testEmail
      });
      expect(mockRequest.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.token).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token is blacklisted', async () => {
      const token = await generateAccessToken(testUserId, testEmail);
      tokenBlacklistService.blacklistToken(token);
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.token).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.token).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate valid refresh token', async () => {
      const refreshToken = await generateRefreshToken(testUserId, testEmail);
      mockRequest.body = { refreshToken };

      await validateRefreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: testUserId,
        email: testEmail
      });
      expect(mockRequest.token).toBe(refreshToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without refresh token', async () => {
      mockRequest.body = {};

      await validateRefreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted refresh token', async () => {
      const refreshToken = await generateRefreshToken(testUserId, testEmail);
      tokenBlacklistService.blacklistToken(refreshToken);
      
      mockRequest.body = { refreshToken };

      await validateRefreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Refresh token has been invalidated',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject access token instead of refresh token', async () => {
      const accessToken = await generateAccessToken(testUserId, testEmail);
      mockRequest.body = { refreshToken: accessToken };

      await validateRefreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Refresh token required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid refresh token', async () => {
      mockRequest.body = { refreshToken: 'invalid-token' };

      await validateRefreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_INVALID',
          message: 'Invalid refresh token format',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});