/**
 * Middleware barrel export
 */

// Core middleware
export * from './cors.js';
export * from './errorHandler.js';
export * from './validation.js';
export * from './rateLimit.js';
export * from './requestId.js';

// Auth middleware (will be implemented in task 4.1)
export * from './auth.js';

// Middleware composition utilities
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest, Middleware } from '../types/api';

/**
 * Compose multiple middleware functions
 */
export function composeMiddleware(...middlewares: Middleware[]) {
  return async (req: AuthenticatedRequest, res: VercelResponse, finalHandler: () => void) => {
    let index = 0;

    async function next(): Promise<void> {
      if (index >= middlewares.length) {
        return finalHandler();
      }

      const middleware = middlewares[index++];
      await middleware(req, res, next);
    }

    await next();
  };
}

/**
 * Create a middleware pipeline
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(
    req: AuthenticatedRequest,
    res: VercelResponse,
    finalHandler: () => void
  ): Promise<void> {
    let index = 0;
    const middlewares = this.middlewares;

    async function next(): Promise<void> {
      if (index >= middlewares.length) {
        return finalHandler();
      }

      const middleware = middlewares[index++];
      await middleware(req, res, next);
    }

    await next();
  }
}

/**
 * Conditional middleware wrapper
 */
export function conditionalMiddleware(
  condition: (req: AuthenticatedRequest) => boolean,
  middleware: Middleware
): Middleware {
  return async (req, res, next) => {
    if (condition(req)) {
      await middleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Method-specific middleware wrapper
 */
export function methodMiddleware(
  method: string | string[],
  middleware: Middleware
): Middleware {
  const methods = Array.isArray(method) ? method : [method];
  
  return conditionalMiddleware(
    (req) => methods.includes(req.method || ''),
    middleware
  );
}