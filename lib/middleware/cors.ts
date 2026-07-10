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

// Surface a misconfigured production deploy: if none of VERCEL_URL /
// VERCEL_PROJECT_PRODUCTION_URL / FRONTEND_URL are set the allowlist is empty
// and every cross-origin call fails closed with no signal. Warn once at load.
if (
  process.env.NODE_ENV === 'production' &&
  Array.isArray(defaultCorsConfig.origin) &&
  defaultCorsConfig.origin.length === 0
) {
  console.warn(
    '[cors] Production CORS allowlist is empty; set FRONTEND_URL (or VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL) or all cross-origin requests will be blocked.'
  );
}

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
    // Return the promise so a downstream throw (e.g. authenticateJWT's
    // UnauthorizedError) propagates back up the chain instead of floating
    // as an unhandled rejection (issue #63).
    return next();
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
  const requestOrigin = req.headers.origin;
  if (config.origin === true) {
    // Dev: a wildcard '*' is invalid alongside Allow-Credentials (browsers
    // reject the combination), so reflect the caller's Origin when present and
    // only fall back to '*' when there is no Origin header.
    if (requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else if (typeof config.origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', config.origin);
  } else if (Array.isArray(config.origin)) {
    if (requestOrigin && config.origin.includes(requestOrigin)) {
      // Reflecting from an allowlist means the response varies by Origin; set
      // Vary so a shared cache/CDN can't serve one origin's CORS response to
      // another.
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }
  }

  // Set other headers
  res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
  res.setHeader(
    'Access-Control-Allow-Headers',
    config.allowedHeaders.join(', ')
  );

  // Never send Allow-Credentials together with a wildcard origin: the pair is
  // invalid and, if honored, dangerous.
  if (
    config.credentials &&
    res.getHeader('Access-Control-Allow-Origin') !== '*'
  ) {
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
