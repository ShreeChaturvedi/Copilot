/**
 * Authentication middleware - JWT token verification
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest, Middleware } from '../types/api.js';
import { UnauthorizedError } from '../types/api.js';
import {
  verifyToken,
  extractTokenFromHeader,
} from '../../packages/backend/src/utils/jwt.js';

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user context to request
 */
export function authenticateJWT(): Middleware {
  return async (
    req: AuthenticatedRequest,
    res: VercelResponse,
    next: () => void
  ) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new UnauthorizedError('Missing JWT token');
    }

    try {
      // Verify JWT token
      const decoded = await verifyToken(token);

      // Ensure it's an access token
      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }

      // Attach user context to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.email.split('@')[0], // Extract name from email as fallback
      };

      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'TOKEN_EXPIRED') {
          throw new UnauthorizedError('Token expired');
        } else if (error.message === 'TOKEN_INVALID') {
          throw new UnauthorizedError('Invalid token');
        }
      }
      throw new UnauthorizedError('Authentication failed');
    }
  };
}

/**
 * Optional authentication middleware
 * Adds user context if token is present, but doesn't require it
 */
export function optionalAuth(): Middleware {
  return async (
    req: AuthenticatedRequest,
    res: VercelResponse,
    next: () => void
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = extractTokenFromHeader(authHeader);

        if (token) {
          try {
            // Verify JWT token
            const decoded = await verifyToken(token);

            // Ensure it's an access token
            if (decoded.type === 'access') {
              // Attach user context to request
              req.user = {
                id: decoded.userId,
                email: decoded.email,
                name: decoded.email.split('@')[0],
              };
            }
          } catch {
            // Silently ignore verification errors for optional auth
          }
        }
      }
    } catch {
      // Ignore auth errors for optional auth
    }

    next();
  };
}

/**
 * Dev-only auth injection
 * In development, attach a default user so endpoints can run without full JWT.
 */
export function devAuth(): Middleware {
  return async (
    req: AuthenticatedRequest,
    _res: VercelResponse,
    next: () => void
  ) => {
    if (process.env.NODE_ENV !== 'production' && !req.user) {
      req.user = {
        id: 'dev-user-id',
        email: 'dev@example.com',
        name: 'Dev User',
      };
    }
    next();
  };
}

/**
 * Role-based authorization middleware (placeholder)
 * Will be implemented if needed in future tasks
 */
export function requireRole(_role: string): Middleware {
  return async (
    _req: AuthenticatedRequest,
    _res: VercelResponse,
    next: () => void
  ) => {
    if (!_req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Reference parameter to satisfy linter until roles are implemented
    void _role;

    // TODO: Implement role checking when user roles are added
    // For now, just pass through
    next();
  };
}

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources
 */
export function requireOwnership(
  getResourceUserId: (req: AuthenticatedRequest) => string | Promise<string>
): Middleware {
  return async (
    req: AuthenticatedRequest,
    res: VercelResponse,
    next: () => void
  ) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const resourceUserId = await getResourceUserId(req);

    if (resourceUserId !== req.user.id) {
      throw new UnauthorizedError('Access denied');
    }

    next();
  };
}
