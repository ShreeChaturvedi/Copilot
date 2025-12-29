/**
 * CORS middleware for Vercel API routes
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CorsConfig } from '../types/api.js';

/**
 * Default CORS configuration
 */
const defaultCorsConfig: CorsConfig = {
  origin:
    process.env.NODE_ENV === 'production'
      ? ([
          `https://${process.env.VERCEL_URL}`,
          `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
          process.env.FRONTEND_URL,
        ].filter(Boolean) as string[])
      : true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Request-ID',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * CORS middleware
 */
export function corsMiddleware(config: Partial<CorsConfig> = {}) {
  const corsConfig = { ...defaultCorsConfig, ...config };

  return (req: VercelRequest, res: VercelResponse, next: () => void) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res, corsConfig, req);
      res.status(200).end();
      return; // Ensure void return type
    }

    // Set CORS headers for all requests
    setCorsHeaders(res, corsConfig, req);
    next();
  };
}

/**
 * Set CORS headers on response
 */
function setCorsHeaders(
  res: VercelResponse,
  config: CorsConfig,
  req: VercelRequest
) {
  // Handle origin
  if (config.origin === true) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (typeof config.origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', config.origin);
  } else if (Array.isArray(config.origin)) {
    const origin = req.headers.origin;
    if (origin && config.origin.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  // Set other headers
  res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
  res.setHeader(
    'Access-Control-Allow-Headers',
    config.allowedHeaders.join(', ')
  );

  if (config.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (config.maxAge) {
    res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Simple CORS middleware for quick setup
 */
export const cors = corsMiddleware();
