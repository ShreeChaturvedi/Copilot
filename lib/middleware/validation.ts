/**
 * Request validation middleware using Zod schemas
 */
import type { VercelResponse } from '@vercel/node';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/api.js';
import { ValidationError } from '../types/api.js';

/**
 * Validation target types
 */
export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation configuration
 */
export interface ValidationConfig {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

/**
 * Request validation middleware
 */
export function validateRequest(config: ValidationConfig) {
  return async (req: AuthenticatedRequest, res: VercelResponse, next: () => void) => {
    try {
      req.validated = req.validated || {};
      // Validate request body
      if (config.body) {
        req.validated.body = await validateTarget(req.body, config.body, 'body');
      }

      // Validate query parameters
      if (config.query) {
        req.validated.query = await validateTarget(req.query, config.query, 'query') as unknown;
      }

      // Validate route parameters
      if (config.params) {
        // Note: Vercel doesn't provide params directly, they're in query
        // This would be used with a custom router implementation
        const params = extractParamsFromUrl(req.url || '', (req.query as unknown as Record<string, unknown>) || {});
        req.validated.params = await validateTarget(params, config.params, 'params');
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
      throw error;
    }
  };
}

/**
 * Validate specific target (body, query, params)
 */
async function validateTarget<Output>(
  data: unknown,
  schema: z.ZodSchema<Output>,
  target: ValidationTarget
): Promise<Output> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: `${target}.${err.path.join('.')}`,
        message: err.message,
        code: err.code,
      }));

      const message =
        error.errors.length === 1
          ? error.errors[0]?.message || `${target} validation failed`
          : `${target} validation failed`;

      throw new ValidationError(
        formattedErrors,
        message
      );
    }
    throw error;
  }
}

/**
 * Extract parameters from URL (for custom routing)
 */
function extractParamsFromUrl(url: string, query: Record<string, unknown>): Record<string, unknown> {
  // This is a simplified implementation
  // In a real scenario, you'd use a proper router
  const params: Record<string, unknown> = {};
  
  // Extract dynamic segments like [id] from the URL
  const urlParts = url.split('/');
  const queryKeys = Object.keys(query);
  
  // Look for dynamic segments and match them with query parameters
  urlParts.forEach(part => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const paramName = part.slice(1, -1);
      if (queryKeys.includes(paramName)) {
        params[paramName] = query[paramName];
      }
    }
  });
  
  return params;
}

/**
 * Body validation middleware
 */
export function validateBody(schema: z.ZodSchema) {
  return validateRequest({ body: schema });
}

/**
 * Query validation middleware
 */
export function validateQuery(schema: z.ZodSchema) {
  return validateRequest({ query: schema });
}

/**
 * Params validation middleware
 */
export function validateParams(schema: z.ZodSchema) {
  return validateRequest({ params: schema });
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination query schema
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
  }).refine(data => {
    const pageValid = Number.isFinite(data.page) && data.page >= 1;
    const limitValid =
      Number.isFinite(data.limit) && data.limit >= 1 && data.limit <= 100;
    const offsetValid = Number.isFinite(data.offset) && data.offset >= 0;

    return pageValid && limitValid && offsetValid;
  }, {
    message: 'Invalid pagination parameters',
  }),

  // ID parameter schema
  id: z.object({
    id: z.string().min(1, 'ID is required'),
  }),

  // Date range query schema
  dateRange: z.object({
    startDate: z.string().optional().refine(val => {
      if (!val) return true;
      return !isNaN(Date.parse(val));
    }, 'Invalid start date format'),
    endDate: z.string().optional().refine(val => {
      if (!val) return true;
      return !isNaN(Date.parse(val));
    }, 'Invalid end date format'),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'Start date must be before end date',
  }),

  // Search query schema
  search: z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    sortBy: z.string().optional(),
  }),
};
