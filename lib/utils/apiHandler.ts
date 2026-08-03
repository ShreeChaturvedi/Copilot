/**
 * API route handler utilities for Vercel
 */
import type { VercelResponse } from '@vercel/node';
import type {
  AuthenticatedRequest,
  RouteConfig,
  RouteHandler,
} from '../types/api.js';
import { HttpMethod } from '../types/api.js';
import { asyncHandler, sendError } from '../middleware/errorHandler.js';
import { corsMiddleware } from '../middleware/cors.js';
import { requestIdMiddleware, requestLogger } from '../middleware/requestId.js';
import { rateLimitPresets } from '../middleware/rateLimit.js';
import { validateRequest } from '../middleware/validation.js';
import type { ValidationConfig } from '../middleware/validation.js';
import { composeMiddleware } from '../middleware/index.js';
import { devAuth, authenticateJWT } from '../middleware/auth.js';
import { ApiError } from '../types/api.js';

/**
 * Rate-limit tier names. Each maps to a preset in rateLimitPresets. Handlers
 * pick a tier (default 'api') instead of every route sharing the 100/15min
 * bucket, so the strict `auth` (5/15min) and `upload` (10/hour) presets are
 * actually reachable in production.
 */
export type RateLimitTier = keyof typeof rateLimitPresets;

function selectRateLimit(tier?: RateLimitTier) {
  return rateLimitPresets[tier ?? 'api'] ?? rateLimitPresets.api;
}

/**
 * Create a standardized API route handler
 */
export function createApiHandler(
  routes: Partial<Record<HttpMethod, RouteConfig>>,
  options: { rateLimit?: RateLimitTier } = {}
) {
  return asyncHandler(
    async (req: AuthenticatedRequest, res: VercelResponse) => {
      const method = req.method as HttpMethod;

      // CORS preflight must be answered before method dispatch: OPTIONS is never
      // registered in the route table, so dispatching first returned 405 and
      // corsMiddleware's OPTIONS branch was dead code (issue #65). Let cors set
      // the preflight headers and end the response.
      if (method === HttpMethod.OPTIONS) {
        return corsMiddleware()(req, res, () => {});
      }

      const route = routes[method];

      if (!route) {
        return sendError(
          res,
          new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed')
        );
      }

      // Build middleware pipeline
      const middlewares = [
        corsMiddleware(),
        requestIdMiddleware(),
        // Move devAuth before logger so logs show userId in dev
        ...(process.env.NODE_ENV !== 'production' ? [devAuth()] : []),
        requestLogger(),
      ];

      // Authenticate before rate-limiting when the route requires auth so the
      // limiter's default keyGenerator can key on req.user.id. Shared-NAT users
      // then each get their own bucket instead of one IP-wide budget (issue #89).
      // Public/auth tiers stay IP-keyed because no JWT runs first.
      if (route.requireAuth) {
        middlewares.push(authenticateJWT());
      }

      // Rate limiting: select the configured tier (default 'api'). This is what
      // makes the strict `auth`/`upload` presets reachable instead of every
      // route sharing the 100/15min `api` bucket.
      middlewares.push(selectRateLimit(options.rateLimit));

      // Add validation if configured
      const validationConfig: ValidationConfig = {};
      if (route.validateBody) validationConfig.body = route.validateBody;
      if (route.validateQuery) validationConfig.query = route.validateQuery;

      if (Object.keys(validationConfig).length > 0) {
        middlewares.push(validateRequest(validationConfig));
      }

      // Execute middleware pipeline
      // Dev auth injection so req.user exists in development
      // devAuth injected earlier to ensure requestLogger sees userId in dev

      await composeMiddleware(...middlewares)(req, res, async () => {
        await route.handler(req, res);
      });
    }
  );
}

/**
 * Simple method-based route handler.
 *
 * Pass `{ requireAuth: true }` to authenticate the request. Without it this
 * factory ran no auth middleware at all — unlike createApiHandler it did not
 * even inject devAuth — so any handler that gated on `req.user` returned 401 for
 * every caller, including ones with a valid Bearer token (issue #64).
 */
export function createMethodHandler(
  handlers: Partial<Record<HttpMethod, RouteHandler>>,
  options: { requireAuth?: boolean; rateLimit?: RateLimitTier } = {}
) {
  return asyncHandler(
    async (req: AuthenticatedRequest, res: VercelResponse) => {
      const method = req.method as HttpMethod;

      // Answer the CORS preflight before method dispatch (issue #65); OPTIONS is
      // not a registered handler so it would otherwise 405.
      if (method === HttpMethod.OPTIONS) {
        return corsMiddleware()(req, res, () => {});
      }

      const handler = handlers[method];

      if (!handler) {
        return sendError(
          res,
          new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed')
        );
      }

      // Build the pipeline. Auth middleware is added only for requireAuth routes
      // so public endpoints (health, register, login, ...) are unchanged. devAuth
      // (dev only) mirrors createApiHandler and is placed before the logger so
      // logs carry the userId in development.
      //
      // Rate limit runs AFTER authenticateJWT on requireAuth routes so the
      // bucket keys on req.user.id (issue #89). Public routes keep IP-keyed
      // limiting because they never authenticate first.
      const middlewares = [corsMiddleware(), requestIdMiddleware()];

      if (options.requireAuth && process.env.NODE_ENV !== 'production') {
        middlewares.push(devAuth());
      }

      middlewares.push(requestLogger());

      if (options.requireAuth) {
        middlewares.push(authenticateJWT());
      }

      middlewares.push(selectRateLimit(options.rateLimit));

      await composeMiddleware(...middlewares)(req, res, async () => {
        await handler(req, res);
      });
    }
  );
}

/**
 * Quick handler for simple CRUD operations
 */
export function createCrudHandler(config: {
  get?: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;
  post?: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;
  put?: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;
  patch?: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;
  delete?: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;
  requireAuth?: boolean;
  rateLimit?: RateLimitTier;
}) {
  const routes: Partial<Record<HttpMethod, RouteConfig>> = {};

  if (config.get) {
    routes[HttpMethod.GET] = {
      method: HttpMethod.GET,
      handler: config.get,
      requireAuth: config.requireAuth,
    };
  }

  if (config.post) {
    routes[HttpMethod.POST] = {
      method: HttpMethod.POST,
      handler: config.post,
      requireAuth: config.requireAuth,
    };
  }

  if (config.put) {
    routes[HttpMethod.PUT] = {
      method: HttpMethod.PUT,
      handler: config.put,
      requireAuth: config.requireAuth,
    };
  }

  if (config.patch) {
    routes[HttpMethod.PATCH] = {
      method: HttpMethod.PATCH,
      handler: config.patch,
      requireAuth: config.requireAuth,
    };
  }

  if (config.delete) {
    routes[HttpMethod.DELETE] = {
      method: HttpMethod.DELETE,
      handler: config.delete,
      requireAuth: config.requireAuth,
    };
  }

  return createApiHandler(routes, { rateLimit: config.rateLimit });
}

/**
 * Health check handler
 */
export const healthCheckHandler = createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      },
    });
  },
});

/**
 * Not found handler
 */
export const notFoundHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: VercelResponse) => {
    sendError(res, new ApiError(404, 'NOT_FOUND', 'Endpoint not found'));
  }
);
