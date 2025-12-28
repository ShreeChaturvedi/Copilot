/**
 * Middleware composition and pipeline test suite
 * Tests middleware chaining, composition, conditional execution, and method filtering
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  composeMiddleware,
  MiddlewarePipeline,
  conditionalMiddleware,
  methodMiddleware,
} from '../index';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';
import type { AuthenticatedRequest, Middleware } from '../../types/api';

describe('Middleware Composition', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  describe('composeMiddleware', () => {
    it('should execute middleware in order', async () => {
      const execOrder: number[] = [];

      const middleware1: Middleware = async (req, res, next) => {
        execOrder.push(1);
        next();
      };

      const middleware2: Middleware = async (req, res, next) => {
        execOrder.push(2);
        next();
      };

      const middleware3: Middleware = async (req, res, next) => {
        execOrder.push(3);
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware1, middleware2, middleware3);
      await composed(req, res, mockNext);

      expect(execOrder).toEqual([1, 2, 3]);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should stop execution if middleware does not call next', async () => {
      const execOrder: number[] = [];

      const middleware1: Middleware = async (req, res, next) => {
        execOrder.push(1);
        next();
      };

      const middleware2: Middleware = async (_req, _res, _next) => {
        execOrder.push(2);
        // Does not call next()
      };

      const middleware3: Middleware = async (req, res, next) => {
        execOrder.push(3);
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware1, middleware2, middleware3);
      await composed(req, res, mockNext);

      expect(execOrder).toEqual([1, 2]); // middleware3 never executed
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass request and response through chain', async () => {
      const middleware1: Middleware = async (req, res, next) => {
        (req as AuthenticatedRequest).requestId = 'test-123';
        next();
      };

      const middleware2: Middleware = async (req, res, next) => {
        res.setHeader(
          'X-Custom-Header',
          (req as AuthenticatedRequest).requestId || ''
        );
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware1, middleware2);
      await composed(req, res, mockNext);

      expect(req.requestId).toBe('test-123');
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-Custom-Header',
        'test-123'
      );
    });

    it('should handle async middleware', async () => {
      const middleware1: Middleware = async (req, res, next) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!(req as AuthenticatedRequest).data) {
          (req as AuthenticatedRequest).data = {};
        }
        (req as AuthenticatedRequest).data.step1 = true;
        await next();
      };

      const middleware2: Middleware = async (req, res, next) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!(req as AuthenticatedRequest).data) {
          (req as AuthenticatedRequest).data = {};
        }
        (req as AuthenticatedRequest).data.step2 = true;
        await next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware1, middleware2);
      await composed(req, res, mockNext);

      expect((req as AuthenticatedRequest).data).toEqual({
        step1: true,
        step2: true,
      });
    });

    it('should handle errors thrown in middleware', async () => {
      const middleware1: Middleware = async (req, res, next) => {
        await next();
      };

      const middleware2: Middleware = async (_req, _res, _next) => {
        throw new Error('Middleware error');
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware1, middleware2);

      await expect(composed(req, res, mockNext)).rejects.toThrow(
        'Middleware error'
      );
    });

    it('should work with empty middleware array', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware();
      await composed(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should work with single middleware', async () => {
      const middleware: Middleware = async (req, res, next) => {
        (req as AuthenticatedRequest).requestId = 'single';
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware);
      await composed(req, res, mockNext);

      expect(req.requestId).toBe('single');
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('MiddlewarePipeline', () => {
    it('should add middleware using use() method', async () => {
      const execOrder: number[] = [];

      const middleware1: Middleware = async (req, res, next) => {
        execOrder.push(1);
        next();
      };

      const middleware2: Middleware = async (req, res, next) => {
        execOrder.push(2);
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline();
      pipeline.use(middleware1);
      pipeline.use(middleware2);

      await pipeline.execute(req, res, mockNext);

      expect(execOrder).toEqual([1, 2]);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should allow method chaining', async () => {
      const middleware1: Middleware = async (req, res, next) => {
        (req as AuthenticatedRequest).step = 1;
        next();
      };

      const middleware2: Middleware = async (req, res, next) => {
        (req as AuthenticatedRequest).step = 2;
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(middleware1)
        .use(middleware2);

      await pipeline.execute(req, res, mockNext);

      expect((req as AuthenticatedRequest).step).toBe(2);
    });

    it('should execute middleware in order of addition', async () => {
      const execOrder: number[] = [];

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(async (req, res, next) => {
          execOrder.push(1);
          next();
        })
        .use(async (req, res, next) => {
          execOrder.push(2);
          next();
        })
        .use(async (req, res, next) => {
          execOrder.push(3);
          next();
        });

      await pipeline.execute(req, res, mockNext);

      expect(execOrder).toEqual([1, 2, 3]);
    });

    it('should stop execution if middleware does not call next', async () => {
      const execOrder: number[] = [];

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(async (_req, _res, next) => {
          execOrder.push(1);
          next();
        })
        .use(async (_req, _res, _next) => {
          execOrder.push(2);
          // Stop here
        })
        .use(async (_req, _res, next) => {
          execOrder.push(3);
          next();
        });

      await pipeline.execute(req, res, mockNext);

      expect(execOrder).toEqual([1, 2]);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors in pipeline', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(async (_req, _res, next) => {
          await next();
        })
        .use(async (_req, _res, _next) => {
          throw new Error('Pipeline error');
        });

      await expect(pipeline.execute(req, res, mockNext)).rejects.toThrow(
        'Pipeline error'
      );
    });

    it('should handle empty pipeline', async () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline();

      await pipeline.execute(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('conditionalMiddleware', () => {
    it('should execute middleware when condition is true', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const condition = (req: AuthenticatedRequest) => {
        return (req as AuthenticatedRequest).user !== undefined;
      };

      const req = createMockRequest() as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
      };
      const res = createMockResponse();

      const conditional = conditionalMiddleware(condition, middleware);
      await conditional(req, res, mockNext);

      expect(middleware).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should skip middleware when condition is false', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const condition = (req: AuthenticatedRequest) => {
        return (req as AuthenticatedRequest).user !== undefined;
      };

      const req = createMockRequest() as AuthenticatedRequest;
      // No user set
      const res = createMockResponse();

      const conditional = conditionalMiddleware(condition, middleware);
      await conditional(req, res, mockNext);

      expect(middleware).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should work with complex conditions', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const condition = (req: AuthenticatedRequest) => {
        return req.method === 'POST' && req.url?.includes('/api/tasks');
      };

      const req1 = createMockRequest({
        method: 'POST',
        url: '/api/tasks',
      }) as AuthenticatedRequest;
      const res1 = createMockResponse();

      const conditional = conditionalMiddleware(condition, middleware);
      await conditional(req1, res1, mockNext);

      expect(middleware).toHaveBeenCalledTimes(1);

      // Different request - should not execute
      const req2 = createMockRequest({
        method: 'GET',
        url: '/api/tasks',
      }) as AuthenticatedRequest;
      const res2 = createMockResponse();

      await conditional(req2, res2, mockNext);

      expect(middleware).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should pass through if condition throws error', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const condition = (_req: AuthenticatedRequest) => {
        throw new Error('Condition error');
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const conditional = conditionalMiddleware(condition, middleware);

      await expect(conditional(req, res, mockNext)).rejects.toThrow(
        'Condition error'
      );
    });
  });

  describe('methodMiddleware', () => {
    it('should execute middleware for matching method (string)', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const req = createMockRequest({
        method: 'POST',
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const methodMw = methodMiddleware('POST', middleware);
      await methodMw(req, res, mockNext);

      expect(middleware).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should skip middleware for non-matching method', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const req = createMockRequest({
        method: 'GET',
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const methodMw = methodMiddleware('POST', middleware);
      await methodMw(req, res, mockNext);

      expect(middleware).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should execute middleware for matching method (array)', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const methodMw = methodMiddleware(['GET', 'POST', 'PUT'], middleware);

      // Test GET
      const req1 = createMockRequest({ method: 'GET' }) as AuthenticatedRequest;
      await methodMw(req1, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(1);

      // Test POST
      const req2 = createMockRequest({
        method: 'POST',
      }) as AuthenticatedRequest;
      await methodMw(req2, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(2);

      // Test PUT
      const req3 = createMockRequest({ method: 'PUT' }) as AuthenticatedRequest;
      await methodMw(req3, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(3);
    });

    it('should skip middleware for non-matching method (array)', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const methodMw = methodMiddleware(['GET', 'POST'], middleware);

      const req = createMockRequest({
        method: 'DELETE',
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await methodMw(req, res, mockNext);

      expect(middleware).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle requests with no method', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const methodMw = methodMiddleware('POST', middleware);

      const req = createMockRequest({
        method: undefined,
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await methodMw(req, res, mockNext);

      expect(middleware).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should be case-sensitive for method matching', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      const methodMw = methodMiddleware('POST', middleware);

      const req = createMockRequest({ method: 'post' }) as AuthenticatedRequest;
      const res = createMockResponse();

      await methodMw(req, res, mockNext);

      expect(middleware).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should compose multiple types of middleware', async () => {
      const execOrder: number[] = [];

      const authMiddleware: Middleware = async (req, res, next) => {
        execOrder.push(1);
        (req as AuthenticatedRequest).user = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test',
        };
        next();
      };

      const loggingMiddleware: Middleware = async (req, res, next) => {
        execOrder.push(2);
        (req as AuthenticatedRequest).requestId = 'req-123';
        next();
      };

      const validationMiddleware: Middleware = async (req, res, next) => {
        execOrder.push(3);
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(
        authMiddleware,
        loggingMiddleware,
        validationMiddleware
      );

      await composed(req, res, mockNext);

      expect(execOrder).toEqual([1, 2, 3]);
      expect(req.user).toBeDefined();
      expect(req.requestId).toBe('req-123');
    });

    it('should combine conditional and method middleware', async () => {
      const middleware: Middleware = vi.fn(async (req, res, next) => {
        next();
      });

      // Only execute for authenticated POST requests
      const condition = (req: AuthenticatedRequest) => {
        return (req as AuthenticatedRequest).user !== undefined;
      };

      const authConditional = conditionalMiddleware(condition, middleware);
      const postOnly = methodMiddleware('POST', authConditional);

      // Authenticated POST - should execute
      const req1 = createMockRequest({
        method: 'POST',
      }) as AuthenticatedRequest;
      req1.user = { id: 'user-123', email: 'test@example.com', name: 'Test' };
      await postOnly(req1, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(1);

      // Unauthenticated POST - should not execute
      const req2 = createMockRequest({
        method: 'POST',
      }) as AuthenticatedRequest;
      await postOnly(req2, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(1); // Still 1

      // Authenticated GET - should not execute
      const req3 = createMockRequest({ method: 'GET' }) as AuthenticatedRequest;
      req3.user = { id: 'user-123', email: 'test@example.com', name: 'Test' };
      await postOnly(req3, createMockResponse(), mockNext);
      expect(middleware).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should use pipeline with conditional middleware', async () => {
      const execOrder: number[] = [];

      const req = createMockRequest({ method: 'POST' }) as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(async (req, res, next) => {
          execOrder.push(1);
          (req as AuthenticatedRequest).user = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test',
          };
          next();
        })
        .use(
          conditionalMiddleware(
            (req) => (req as AuthenticatedRequest).user !== undefined,
            async (req, res, next) => {
              execOrder.push(2);
              next();
            }
          )
        )
        .use(
          methodMiddleware('POST', async (req, res, next) => {
            execOrder.push(3);
            next();
          })
        );

      await pipeline.execute(req, res, mockNext);

      expect(execOrder).toEqual([1, 2, 3]);
    });

    it('should handle complex middleware pipeline with early termination', async () => {
      const execOrder: number[] = [];

      const req = createMockRequest({ method: 'GET' }) as AuthenticatedRequest;
      const res = createMockResponse();

      const pipeline = new MiddlewarePipeline()
        .use(async (req, res, next) => {
          execOrder.push(1);
          next();
        })
        .use(
          conditionalMiddleware(
            (req) => req.method === 'POST',
            async (_req, _res, _next) => {
              execOrder.push(2);
              // This would terminate if executed
            }
          )
        )
        .use(async (req, res, next) => {
          execOrder.push(3);
          next();
        });

      await pipeline.execute(req, res, mockNext);

      // Should skip middleware 2 (GET request, not POST)
      expect(execOrder).toEqual([1, 3]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle middleware that modifies response', async () => {
      const middleware: Middleware = async (req, res, next) => {
        res.setHeader('X-Custom', 'value');
        res.status(201);
        next();
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware);
      await composed(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-Custom',
        'value'
      );
      expect(vi.mocked(res.status)).toHaveBeenCalledWith(201);
    });

    it('should handle middleware that sends response early', async () => {
      const middleware: Middleware = async (_req, res, _next) => {
        res.status(404).json({ error: 'Not found' });
        // Does not call next()
      };

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(middleware);
      await composed(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle very long middleware chains', async () => {
      const middlewares: Middleware[] = [];
      const execOrder: number[] = [];

      for (let i = 0; i < 50; i++) {
        const index = i; // Capture value
        middlewares.push(async (_req, _res, next) => {
          execOrder.push(index);
          next();
        });
      }

      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const composed = composeMiddleware(...middlewares);
      await composed(req, res, mockNext);

      expect(execOrder).toHaveLength(50);
      expect(execOrder[0]).toBe(0);
      expect(execOrder[49]).toBe(49);
    });
  });
});
