/**
 * Authentication middleware - placeholder implementation
 * Full implementation will be completed in task 4.1
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest, Middleware } from '../types/api.js';
import { UnauthorizedError } from '../types/api.js';

/**
 * JWT authentication middleware (placeholder)
 * This will be fully implemented in task 4.1
 */
export function authenticateJWT(): Middleware {
  return async (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    // Placeholder implementation - will be completed in task 4.1
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      throw new UnauthorizedError('Missing JWT token');
    }
    
    // TODO: Implement JWT verification in task 4.1
    // For now, just set a placeholder user
    req.user = {
      id: 'placeholder-user-id',
      email: 'placeholder@example.com',
      name: 'Placeholder User',
    };
    
    next();
  };
}

/**
 * Optional authentication middleware
 * Adds user context if token is present, but doesn't require it
 */
export function optionalAuth(): Middleware {
  return async (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        if (token) {
          // TODO: Implement JWT verification in task 4.1
          req.user = {
            id: 'placeholder-user-id',
            email: 'placeholder@example.com',
            name: 'Placeholder User',
          };
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
  return async (req: AuthenticatedRequest, _res: VercelResponse, next: () => void) => {
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
  return async (_req: AuthenticatedRequest, _res: VercelResponse, next: () => void) => {
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
  return async (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
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