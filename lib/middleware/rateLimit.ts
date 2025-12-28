/**
 * Rate limiting middleware for Vercel API routes
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../types/api.js';
import { RateLimitError } from '../types/api.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator?: (req: AuthenticatedRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

/**
 * In-memory store for rate limiting
 * Note: In production, you'd want to use Redis or similar
 */
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: { count: number; resetTime: number }): void {
    this.store.set(key, value);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.get(key);
    
    if (!entry) {
      const newEntry = { count: 1, resetTime: now + windowMs };
      this.set(key, newEntry);
      return newEntry;
    }

    entry.count++;
    this.set(key, entry);
    return entry;
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, entry] = entries[i];
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Global store instance
const store = new MemoryStore();

// Cleanup expired entries every 5 minutes
setInterval(() => store.cleanup(), 5 * 60 * 1000);

// Test-only helper to reset the in-memory store between test cases.
export function resetRateLimitStore(): void {
  store.clear();
}

/**
 * Default rate limit configuration
 */
const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || getClientIP(req) || 'anonymous';
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: 'Too many requests, please try again later',
};

/**
 * Rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config };

  return async (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    const key = options.keyGenerator!(req);
    const entry = store.increment(key, options.windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

    // Check if rate limit exceeded
    if (entry.count > options.max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - Date.now()) / 1000).toString());
      
      const error = new RateLimitError(options.message);
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}

/**
 * Get client IP address
 */
function getClientIP(req: AuthenticatedRequest): string | undefined {
  // Check various headers for the real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return req.connection?.remoteAddress || req.socket?.remoteAddress;
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitPresets = {
  // Strict rate limiting for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later',
  }),

  // Standard rate limiting for API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  }),

  // Lenient rate limiting for read operations
  read: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
  }),

  // Strict rate limiting for write operations
  write: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
  }),

  // Very strict rate limiting for file uploads
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload limit exceeded, please try again later',
  }),
};
