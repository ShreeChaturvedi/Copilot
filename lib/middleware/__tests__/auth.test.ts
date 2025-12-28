/**
 * Authentication middleware test suite
 * Tests JWT validation, optional auth, dev auth, role-based auth, and ownership checks
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  authenticateJWT,
  optionalAuth,
  devAuth,
  requireRole,
  requireOwnership,
} from '../auth';
import { UnauthorizedError } from '../../types/api';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';
import type { AuthenticatedRequest } from '../../types/api';
import {
  extractTokenFromHeader,
  verifyToken,
} from '../../../packages/backend/src/utils/jwt.js';

vi.mock('../../../packages/backend/src/utils/jwt.js', () => ({
  verifyToken: vi.fn(),
  extractTokenFromHeader: vi.fn(),
}));

describe('Authentication Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
    vi.mocked(extractTokenFromHeader).mockImplementation(
      (authHeader?: string) => {
        if (!authHeader) return null;
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
        return parts[1];
      }
    );
    vi.mocked(verifyToken).mockImplementation(async (token: string) => {
      if (token.includes('malformed')) {
        throw new Error('TOKEN_INVALID');
      }
      return {
        userId: 'user-123',
        email: 'user@example.com',
        type: 'access',
      };
    });
  });

  describe('authenticateJWT', () => {
    it('should authenticate request with valid Bearer token', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = authenticateJWT();
      await middleware(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('user-123');
      expect(req.user?.email).toBe('user@example.com');
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should throw UnauthorizedError when authorization header is missing', async () => {
      const req = createMockRequest({
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = authenticateJWT();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Missing or invalid authorization header'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when authorization header does not start with Bearer', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Basic invalid-token',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = authenticateJWT();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when token is empty', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer ',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = authenticateJWT();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Missing JWT token'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Bearer header', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = authenticateJWT();
      await middleware(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('optionalAuth', () => {
    it('should add user context when valid Bearer token is present', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = optionalAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should continue without user when authorization header is missing', async () => {
      const req = createMockRequest({
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = optionalAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should continue without user when Bearer prefix is missing', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Basic invalid',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = optionalAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should continue without user when token is empty', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer ',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = optionalAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should ignore auth errors and continue', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer malformed-token-that-could-throw',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = optionalAuth();

      // Should not throw, even if token parsing fails in future implementation
      await expect(middleware(req, res, mockNext)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('devAuth', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should inject dev user in development when no user exists', async () => {
      process.env.NODE_ENV = 'development';

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = devAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('dev-user-id');
      expect(req.user?.email).toBe('dev@example.com');
      expect(req.user?.name).toBe('Dev User');
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not inject dev user in production', async () => {
      process.env.NODE_ENV = 'production';

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = devAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not overwrite existing authenticated user in development', async () => {
      process.env.NODE_ENV = 'development';

      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        name: 'Existing User',
      };

      const req = createMockRequest() as AuthenticatedRequest;
      req.user = existingUser;
      const res = createMockResponse();

      const middleware = devAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toEqual(existingUser);
      expect(req.user?.id).toBe('existing-user-id');
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle test environment as non-production', async () => {
      process.env.NODE_ENV = 'test';

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = devAuth();
      await middleware(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('dev-user-id');
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('requireRole', () => {
    it('should throw UnauthorizedError when user is not authenticated', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requireRole('admin');

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Authentication required'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through when user is authenticated (placeholder implementation)', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const middleware = requireRole('admin');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should work with different role values (placeholder)', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const adminMiddleware = requireRole('admin');
      const userMiddleware = requireRole('user');
      const moderatorMiddleware = requireRole('moderator');

      await adminMiddleware(req, res, mockNext);
      await userMiddleware(req, res, mockNext);
      await moderatorMiddleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
    });
  });

  describe('requireOwnership', () => {
    it('should throw UnauthorizedError when user is not authenticated', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const getResourceUserId = vi.fn().mockResolvedValue('resource-owner-id');
      const middleware = requireOwnership(getResourceUserId);

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Authentication required'
      );
      expect(mockNext).not.toHaveBeenCalled();
      expect(getResourceUserId).not.toHaveBeenCalled();
    });

    it('should pass when user owns the resource', async () => {
      const userId = 'user-123';
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const getResourceUserId = vi.fn().mockResolvedValue(userId);
      const middleware = requireOwnership(getResourceUserId);

      await middleware(req, res, mockNext);

      expect(getResourceUserId).toHaveBeenCalledWith(req);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should throw UnauthorizedError when user does not own the resource', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const getResourceUserId = vi.fn().mockResolvedValue('different-user-456');
      const middleware = requireOwnership(getResourceUserId);

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Access denied'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle synchronous getResourceUserId function', async () => {
      const userId = 'user-123';
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const getResourceUserId = vi.fn(() => userId);
      const middleware = requireOwnership(getResourceUserId);

      await middleware(req, res, mockNext);

      expect(getResourceUserId).toHaveBeenCalledWith(req);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle async getResourceUserId function', async () => {
      const userId = 'user-123';
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const getResourceUserId = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return userId;
      });
      const middleware = requireOwnership(getResourceUserId);

      await middleware(req, res, mockNext);

      expect(getResourceUserId).toHaveBeenCalledWith(req);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle errors from getResourceUserId', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const getResourceUserId = vi
        .fn()
        .mockRejectedValue(new Error('Database error'));
      const middleware = requireOwnership(getResourceUserId);

      await expect(middleware(req, res, mockNext)).rejects.toThrow(
        'Database error'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract resource user ID from request params', async () => {
      const userId = 'user-123';
      const req = createMockRequest({
        query: { taskId: 'task-456' },
      }) as AuthenticatedRequest;
      req.user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      // Simulate fetching resource from database
      const getResourceUserId = vi.fn((req: AuthenticatedRequest) => {
        const taskId = req.query?.taskId;
        // Mock database lookup
        return taskId === 'task-456' ? userId : 'other-user';
      });

      const middleware = requireOwnership(getResourceUserId);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('Integration Tests', () => {
    it('should chain authenticateJWT with requireOwnership', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      // First, authenticate
      const authMiddleware = authenticateJWT();
      await authMiddleware(req, res, mockNext);

      expect(req.user).toBeDefined();

      // Then, check ownership
      const getResourceUserId = vi.fn().mockResolvedValue('user-123');
      const ownershipMiddleware = requireOwnership(getResourceUserId);
      await ownershipMiddleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should handle optional auth followed by conditional logic', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      // Optional auth without token
      const optionalAuthMiddleware = optionalAuth();
      await optionalAuthMiddleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();

      // Business logic can check if user exists
      if (!req.user) {
        // Inject dev user for testing
        const devAuthMiddleware = devAuth();
        await devAuthMiddleware(req, res, mockNext);
      }

      expect(req.user).toBeDefined();
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });
});
