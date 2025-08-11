import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting configuration for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((900000 + Date.now()) / 1000) // 15 minutes in seconds
      }
    });
  }
});

/**
 * Rate limiting for login attempts (more restrictive)
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 login attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((900000 + Date.now()) / 1000)
      }
    });
  }
});

/**
 * Rate limiting for password reset requests
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset requests. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset requests. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((3600000 + Date.now()) / 1000)
      }
    });
  }
});

/**
 * Rate limiting for token refresh requests
 */
export const refreshTokenRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 refresh requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'REFRESH_RATE_LIMIT_EXCEEDED',
      message: 'Too many token refresh attempts. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'REFRESH_RATE_LIMIT_EXCEEDED',
        message: 'Too many token refresh attempts. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((300000 + Date.now()) / 1000)
      }
    });
  }
});

/**
 * General API rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((900000 + Date.now()) / 1000)
      }
    });
  }
});

/**
 * Create a custom rate limiter with specific configuration
 */
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message: string;
  code: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        code: options.code,
        message: options.message,
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: options.code,
          message: options.message,
          timestamp: new Date().toISOString(),
          retryAfter: Math.round((options.windowMs + Date.now()) / 1000)
        }
      });
    }
  });
}