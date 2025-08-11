/**
 * Global error handling middleware for Vercel API routes
 */
import type { VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/api.js';
import { ApiError, ValidationError, InternalServerError } from '../types/api.js';

/**
 * Error handler middleware
 */
export function errorHandler(
  error: Error,
  req: AuthenticatedRequest,
  res: VercelResponse
): void {
  const requestId = req.requestId || generateRequestId();
  const timestamp = new Date().toISOString();

  // Log error for debugging
  console.error(`[${timestamp}] [${requestId}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  // Handle different error types
  if (error instanceof ApiError) {
    return sendErrorResponse(res, error.statusCode, {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
        requestId,
      },
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      formatZodErrors(error),
      'Request validation failed'
    );
    
    return sendErrorResponse(res, validationError.statusCode, {
      success: false,
      error: {
        code: validationError.code,
        message: validationError.message,
        details: validationError.details,
        timestamp,
        requestId,
      },
    });
  }

  // Handle unexpected errors
  const internalError = new InternalServerError();
  sendErrorResponse(res, internalError.statusCode, {
    success: false,
    error: {
      code: internalError.code,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      timestamp,
      requestId,
    },
  });
}

/**
 * Send error response
 */
function sendErrorResponse(
  res: VercelResponse,
  statusCode: number,
  body: ApiResponse
): void {
  res.status(statusCode).json(body);
}

/**
 * Format Zod validation errors
 */
function formatZodErrors(error: ZodError): Array<{
  field: string;
  message: string;
  code: string;
}> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error as Error, req, res);
    }
  };
}

/**
 * Success response helper
 */
export function sendSuccess<T>(
  res: VercelResponse,
  data?: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Error response helper
 */
export function sendError(
  res: VercelResponse,
  error: ApiError,
  requestId?: string
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  res.status(error.statusCode).json(response);
}