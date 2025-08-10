import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware to validate request body using Zod schema
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Unexpected error
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_PROCESSING_ERROR',
          message: 'Error processing validation',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Middleware to validate request query parameters using Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'QUERY_VALIDATION_ERROR',
            message: 'Query parameter validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_VALIDATION_PROCESSING_ERROR',
          message: 'Error processing query validation',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Middleware to validate request parameters using Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'PARAMS_VALIDATION_ERROR',
            message: 'URL parameter validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'PARAMS_VALIDATION_PROCESSING_ERROR',
          message: 'Error processing parameter validation',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Generic validation function that can be used in route handlers
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}