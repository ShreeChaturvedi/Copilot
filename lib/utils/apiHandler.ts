/**
 * API route handler utilities for Vercel
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest, RouteConfig, HttpMethod } from '../types/api';
import { asyncHandler, sendError } from '../middleware/errorHandler';
import { corsMiddleware } from '../middleware/cors';
import { requestIdMiddleware, requestLogger } from '../middleware/requestId';
import { rateLimitPresets } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import { composeMiddleware } from '../middleware';
import { ApiError } from '../types/api';

/**
 * Create a standardized API route handler
 */
export function createApiHandler(routes: Partial<Record<HttpMethod, RouteConfig>>) {
  return asyncHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const method = req.method as HttpMethod;
    const route = routes[method];

    if (!route) {
      return sendError(res, new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed'));
    }

    // Build middleware pipeline
    const middlewares = [
      corsMiddleware(),
      requestIdMiddleware(),
      requestLogger(),
    ];

    // Add rate limiting if configured
    if (route.rateLimit) {
      const { windowMs, max } = route.rateLimit;
      middlewares.push(rateLimitPresets.api); // Use default or create custom
    } else {
      middlewares.push(rateLimitPresets.api); // Default rate limiting
    }

    // Add authentication if required
    if (route.requireAuth) {
      // Auth middleware will be implemented in task 4.1
      // middlewares.push(authenticateJWT);
    }

    // Add validation if configured
    const validationConfig: any = {};
    if (route.validateBody) validationConfig.body = route.validateBody;
    if (route.validateQuery) validationConfig.query = route.validateQuery;
    
    if (Object.keys(validationConfig).length > 0) {
      middlewares.push(validateRequest(validationConfig));
    }

    // Execute middleware pipeline
    await composeMiddleware(...middlewares)(req, res, async () => {
      await route.handler(req, res);
    });
  });
}

/**
 * Simple method-based route handler
 */
export function createMethodHandler(handlers: Partial<Record<HttpMethod, Function>>) {
  return asyncHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const method = req.method as HttpMethod;
    const handler = handlers[method];

    if (!handler) {
      return sendError(res, new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed'));
    }

    // Apply basic middleware
    await composeMiddleware(
      corsMiddleware(),
      requestIdMiddleware(),
      requestLogger(),
      rateLimitPresets.api
    )(req, res, async () => {
      await handler(req, res);
    });
  });
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
  rateLimit?: 'read' | 'write' | 'api';
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

  return createApiHandler(routes);
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