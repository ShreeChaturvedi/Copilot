/**
 * Request ID middleware for tracing and debugging
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../types/api.js';

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `req_${timestamp}_${random}`;
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware() {
  return (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    // Check if request ID already exists in headers
    const existingId = req.headers['x-request-id'] as string;
    const requestId = existingId || generateRequestId();

    // Add request ID to request object
    req.requestId = requestId;

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    next();
  };
}

/**
 * Request logging middleware
 */
export function requestLogger() {
  return (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    const startTime = Date.now();
    const requestId = req.requestId || 'unknown';

    // Log incoming request
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url}`, {
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      ip: getClientIP(req),
    });

    // Log on finish to avoid messing with res.end signature
    res.once('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [${requestId}] Response ${res.statusCode} - ${duration}ms`);
    });

    next();
  };
}

/**
 * Get client IP address
 */
function getClientIP(req: AuthenticatedRequest): string | undefined {
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