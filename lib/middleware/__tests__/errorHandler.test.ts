/**
 * Error handling middleware test suite
 * Tests error transformation, Zod validation errors, response formatting, and helpers
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  errorHandler,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../errorHandler';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  InternalServerError,
} from '../../types/api';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';
import type { AuthenticatedRequest } from '../../types/api';

describe('Error Handler Middleware', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('errorHandler', () => {
    it('should handle ApiError with proper status code and structure', () => {
      const req = createMockRequest({
        url: '/api/test',
        method: 'GET',
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const error = new NotFoundError('Resource');
      errorHandler(error, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(404);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Resource not found',
            requestId: 'test-request-123',
          }),
        })
      );
    });

    it('should handle ZodError and transform to ValidationError', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['email'],
          message: 'String must contain at least 3 character(s)',
        },
      ]);

      errorHandler(zodError, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                message: 'Expected string, received number',
                code: 'invalid_type',
              }),
              expect.objectContaining({
                field: 'email',
                message: 'String must contain at least 3 character(s)',
                code: 'too_small',
              }),
            ]),
          }),
        })
      );
    });

    it('should handle generic Error as InternalServerError in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const error = new Error('Database connection failed');
      errorHandler(error, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(500);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred', // Generic message in production
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should expose detailed error message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const error = new Error('Detailed database connection failed at line 42');
      errorHandler(error, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(500);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Detailed database connection failed at line 42', // Detailed in development
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error details with request context', () => {
      const req = createMockRequest({
        url: '/api/tasks',
        method: 'POST',
      }) as AuthenticatedRequest;
      req.requestId = 'req-123';
      req.user = {
        id: 'user-456',
        email: 'test@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const error = new Error('Test error');
      errorHandler(error, req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[req-123]'),
        expect.objectContaining({
          message: 'Test error',
          url: '/api/tasks',
          method: 'POST',
          userId: 'user-456',
        })
      );
    });

    it('should generate request ID if not present', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const error = new Error('Test error');
      errorHandler(error, req, res);

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should include timestamp in error response', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const error = new Error('Test error');
      const beforeTime = new Date();
      errorHandler(error, req, res);
      const afterTime = new Date();

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      const timestamp = new Date(jsonCall.error?.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle UnauthorizedError correctly', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const error = new UnauthorizedError('Invalid token');
      errorHandler(error, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(401);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          }),
        })
      );
    });

    it('should handle ValidationError with details', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const validationDetails = [
        {
          field: 'email',
          message: 'Invalid email format',
          code: 'invalid_email',
        },
        { field: 'age', message: 'Must be at least 18', code: 'too_small' },
      ];
      const error = new ValidationError(validationDetails);
      errorHandler(error, req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: validationDetails,
          }),
        })
      );
    });

    it('should handle nested Zod error paths', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['user', 'profile', 'name'],
          message: 'Required',
        },
      ]);

      errorHandler(zodError, req, res);

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.details).toEqual([
        expect.objectContaining({
          field: 'user.profile.name',
          message: 'Required',
        }),
      ]);
    });
  });

  describe('asyncHandler', () => {
    it('should execute async handler successfully', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const handler = vi.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = asyncHandler(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalledWith(req, res);
      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
    });

    it('should catch and handle errors from async handler', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.requestId = 'test-123';
      const res = createMockResponse();

      const error = new NotFoundError('Task');
      const handler = vi.fn(async () => {
        throw error;
      });

      const wrappedHandler = asyncHandler(handler);
      await wrappedHandler(req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(404);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Task not found',
          }),
        })
      );
    });

    it('should handle async errors thrown in handler', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const handler = vi.fn(async () => {
        await Promise.resolve();
        throw new Error('Async operation failed');
      });

      const wrappedHandler = asyncHandler(handler);
      await wrappedHandler(req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(500);
    });

    it('should preserve handler arguments', async () => {
      const req = createMockRequest({
        query: { id: '123' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const handler = vi.fn(async (req, res) => {
        expect(req.query?.id).toBe('123');
        res.status(200).json({ id: req.query?.id });
      });

      const wrappedHandler = asyncHandler(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalledWith(req, res);
    });
  });

  describe('sendSuccess', () => {
    it('should send success response with data', () => {
      const res = createMockResponse();
      const data = { id: '123', name: 'Test Task' };

      sendSuccess(res, data);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          meta: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('should send success response without data', () => {
      const res = createMockResponse();

      sendSuccess(res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: undefined,
        })
      );
    });

    it('should send success response with custom status code', () => {
      const res = createMockResponse();
      const data = { id: '123' };

      sendSuccess(res, data, 201);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(201);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
        })
      );
    });

    it('should include custom meta data', () => {
      const res = createMockResponse();
      const data = [{ id: '1' }, { id: '2' }];
      const meta = {
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
        },
      };

      sendSuccess(res, data, 200, meta);

      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          meta: expect.objectContaining({
            timestamp: expect.any(String),
            pagination: meta.pagination,
          }),
        })
      );
    });

    it('should include timestamp in meta', () => {
      const res = createMockResponse();

      const beforeTime = new Date();
      sendSuccess(res, { test: 'data' });
      const afterTime = new Date();

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      const timestamp = new Date(jsonCall.meta?.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('sendError', () => {
    it('should send error response with ApiError', () => {
      const res = createMockResponse();
      const error = new NotFoundError('Resource');
      const requestId = 'req-123';

      sendError(res, error, requestId);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(404);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Resource not found',
            requestId: 'req-123',
          }),
        })
      );
    });

    it('should send error response without request ID', () => {
      const res = createMockResponse();
      const error = new UnauthorizedError('Access denied');

      sendError(res, error);

      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: undefined,
          }),
        })
      );
    });

    it('should include error details if present', () => {
      const res = createMockResponse();
      const details = [{ field: 'email', message: 'Invalid format' }];
      const error = new ValidationError(details);

      sendError(res, error);

      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details,
          }),
        })
      );
    });

    it('should include timestamp', () => {
      const res = createMockResponse();
      const error = new InternalServerError();

      const beforeTime = new Date();
      sendError(res, error);
      const afterTime = new Date();

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      const timestamp = new Date(jsonCall.error?.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete request-response cycle with asyncHandler and sendSuccess', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: { id: '123' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const handler = asyncHandler(async (req, res) => {
        const data = { id: req.query?.id, name: 'Test Task' };
        sendSuccess(res, data);
      });

      await handler(req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: '123' }),
        })
      );
    });

    it('should handle error flow with asyncHandler and error handler', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.requestId = 'req-456';
      const res = createMockResponse();

      const handler = asyncHandler(async () => {
        throw new NotFoundError('Task');
      });

      await handler(req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(404);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            requestId: 'req-456',
          }),
        })
      );
    });

    it('should handle validation error in async handler', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const handler = asyncHandler(async () => {
        const zodError = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['title'],
            message: 'Expected string',
          },
        ]);
        throw zodError;
      });

      await handler(req, res);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'title',
              }),
            ]),
          }),
        })
      );
    });
  });
});
