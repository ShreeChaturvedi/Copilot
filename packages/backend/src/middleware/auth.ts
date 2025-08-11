import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { tokenBlacklistService } from '../services/TokenBlacklistService.js';
import { updateContextWithUser } from '../utils/requestContext.js';

// Extend Express Request interface to include user
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  token?: string;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

export interface RequestWithResource extends Request {
  resource?: {
    [key: string]: unknown;
  };
}

/**
 * Authentication middleware that validates JWT tokens
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if token is blacklisted
    if (tokenBlacklistService.isTokenBlacklisted(token)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been invalidated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify token
    const decoded = await verifyToken(token);

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Access token required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    req.token = token;

    // Update request context with user information
    updateContextWithUser(decoded.userId, decoded.email);

    next();
  } catch (error) {
    let errorCode = 'TOKEN_VERIFICATION_FAILED';
    let errorMessage = 'Token verification failed';

    if (error instanceof Error) {
      switch (error.message) {
        case 'TOKEN_EXPIRED':
          errorCode = 'TOKEN_EXPIRED';
          errorMessage = 'Token has expired';
          break;
        case 'TOKEN_INVALID':
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Invalid token format';
          break;
        case 'TOKEN_NOT_ACTIVE':
          errorCode = 'TOKEN_NOT_ACTIVE';
          errorMessage = 'Token is not yet active';
          break;
      }
    }

    res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Check if token is blacklisted
    if (tokenBlacklistService.isTokenBlacklisted(token)) {
      // Token is blacklisted, continue without authentication
      next();
      return;
    }

    // Try to verify token
    const decoded = await verifyToken(token);

    if (decoded.type === 'access') {
      req.user = {
        id: decoded.userId,
        email: decoded.email
      };
      req.token = token;
      
      // Update request context with user information
      updateContextWithUser(decoded.userId, decoded.email);
    }

    next();
  } catch {
    // Token verification failed, continue without authentication
    next();
  }
}

/**
 * Middleware to check if user owns a resource
 */
export function requireResourceOwnership(resourceUserIdField: string = 'userId') {
  return (req: AuthRequest & RequestWithResource, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // This middleware should be used after resource is loaded
    // The resource should be available in req.locals or similar
    const resource = req.resource;
    if (resource && resource[resourceUserIdField] !== user.id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate refresh token
 */
export async function validateRefreshToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if token is blacklisted
    if (tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Refresh token has been invalidated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify refresh token
    const decoded = await verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Refresh token required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Add decoded token info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    req.token = refreshToken;

    next();
  } catch (error) {
    let errorCode = 'REFRESH_TOKEN_VERIFICATION_FAILED';
    let errorMessage = 'Refresh token verification failed';

    if (error instanceof Error) {
      switch (error.message) {
        case 'TOKEN_EXPIRED':
          errorCode = 'REFRESH_TOKEN_EXPIRED';
          errorMessage = 'Refresh token has expired';
          break;
        case 'TOKEN_INVALID':
          errorCode = 'REFRESH_TOKEN_INVALID';
          errorMessage = 'Invalid refresh token format';
          break;
      }
    }

    res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
}