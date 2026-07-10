/**
 * Authentication middleware - JWT token verification
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest, Middleware } from '../types/api.js';
import { ForbiddenError, UnauthorizedError } from '../types/api.js';
import {
  verifyToken,
  extractTokenFromHeader,
} from '../../packages/backend/src/utils/jwt.js';
import { query } from '../config/database.js';

// Baseline role assigned to every user by migration 008. The ADMIN role is a
// superuser that satisfies any requireRole check.
const DEFAULT_ROLE = 'USER';
const ADMIN_ROLE = 'ADMIN';

/**
 * Resolve the role for a user id from the database, falling back to the
 * baseline role when the user (or column) cannot be found.
 */
async function fetchUserRole(userId: string): Promise<string> {
  const result = await query<{ role: string | null }>(
    'SELECT "role" FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.role ?? DEFAULT_ROLE;
}

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
        role: decoded.role,
      };
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

    // next() is returned OUTSIDE the try so a downstream handler error is not
    // caught and mis-reported as 'Authentication failed', and so the thrown
    // UnauthorizedError above propagates up the chain to the error handler as a
    // 401 instead of a dropped rejection (issue #63).
    return next();
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
                role: decoded.role,
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

    return next();
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
    // Only inject the ADMIN dev user for genuine local development. On any
    // deployed environment (Vercel sets process.env.VERCEL) require an explicit
    // ENABLE_DEV_AUTH opt-in, so a preview/staging deploy where NODE_ENV is not
    // exactly 'production' can't silently hand ADMIN to every caller.
    const devAuthEnabled =
      process.env.NODE_ENV !== 'production' &&
      (!process.env.VERCEL || process.env.ENABLE_DEV_AUTH === 'true');

    if (devAuthEnabled && !req.user) {
      req.user = {
        id: 'dev-user-id',
        email: 'dev@example.com',
        name: 'Dev User',
        role: ADMIN_ROLE,
      };
    }
    return next();
  };
}

/**
 * Role-based authorization middleware
 * Requires the authenticated user to hold the given role. The ADMIN role is a
 * superuser and satisfies any role requirement. The role is read from the
 * request context (populated from the access token) and falls back to a
 * database lookup when the token predates roles.
 */
export function requireRole(role: string): Middleware {
  return async (
    req: AuthenticatedRequest,
    _res: VercelResponse,
    next: () => void
  ) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    let userRole = req.user.role;
    if (!userRole) {
      userRole = await fetchUserRole(req.user.id);
      req.user.role = userRole;
    }

    if (userRole !== role && userRole !== ADMIN_ROLE) {
      throw new ForbiddenError(`Requires '${role}' role`);
    }

    return next();
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

    return next();
  };
}
