/**
 * Request ID and logging middleware test suite
 * Tests ID generation, header management, and request/response logging
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestIdMiddleware, requestLogger } from '../requestId';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';
import type { AuthenticatedRequest } from '../../types/api';

describe('Request ID Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockNext = vi.fn();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('requestIdMiddleware', () => {
    it('should generate and attach request ID when not present', () => {
      const req = createMockRequest({
        headers: {}, // No x-request-id header
      }) as AuthenticatedRequest;
      delete (req.headers as Record<string, unknown>)['x-request-id'];
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(req.requestId).toBeDefined();
      expect(req.requestId).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should use existing request ID from headers', () => {
      const existingId = 'existing-request-id-123';
      const req = createMockRequest({
        headers: {
          'x-request-id': existingId,
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(req.requestId).toBe(existingId);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should set request ID in response headers', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.any(String)
      );
    });

    it('should set same ID in request and response', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const requestIdCall = setHeaderCalls.find(([header]) => header === 'X-Request-ID');
      const responseId = requestIdCall?.[1];

      expect(req.requestId).toBe(responseId);
    });

    it('should generate unique IDs for different requests', () => {
      const req1 = createMockRequest({ headers: {} }) as AuthenticatedRequest;
      delete (req1.headers as Record<string, unknown>)['x-request-id'];
      const req2 = createMockRequest({ headers: {} }) as AuthenticatedRequest;
      delete (req2.headers as Record<string, unknown>)['x-request-id'];
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req1, res1, mockNext);
      middleware(req2, res2, mockNext);

      expect(req1.requestId).toBeDefined();
      expect(req2.requestId).toBeDefined();
      expect(req1.requestId).not.toBe(req2.requestId);
    });

    it('should handle request ID with special characters', () => {
      const specialId = 'req-123_ABC-xyz-789';
      const req = createMockRequest({
        headers: {
          'x-request-id': specialId,
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(req.requestId).toBe(specialId);
    });

    it('should handle empty request ID header', () => {
      const req = createMockRequest({
        headers: {
          'x-request-id': '',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      // Empty string is falsy, so should generate new ID
      expect(req.requestId).toBeDefined();
      expect(req.requestId).not.toBe('');
    });

    it('should preserve existing request ID across middleware chain', () => {
      const req = createMockRequest({
        headers: {
          'x-request-id': 'chain-id-123',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware1 = requestIdMiddleware();
      const middleware2 = requestIdMiddleware();

      middleware1(req, res, mockNext);
      const firstId = req.requestId;

      middleware2(req, res, mockNext);
      const secondId = req.requestId;

      expect(firstId).toBe('chain-id-123');
      expect(secondId).toBe('chain-id-123');
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('requestLogger', () => {
    it('should log incoming request with basic info', () => {
      const req = createMockRequest({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          'user-agent': 'Test Agent',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      const [message, meta] = consoleLogSpy.mock.calls[0] ?? [];
      expect(message).toContain('[test-request-123]');
      expect(message).toContain('GET /api/tasks');
      expect(meta).toEqual(
        expect.objectContaining({
          userAgent: expect.any(String),
        })
      );
    });

    it('should log request with user ID when authenticated', () => {
      const req = createMockRequest({
        method: 'POST',
        url: '/api/tasks',
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      req.user = {
        id: 'user-456',
        email: 'test@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-456',
        })
      );
    });

    it('should log with unknown request ID if not present', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[unknown]'),
        expect.any(Object)
      );
    });

    it('should log response when finished', () => {
      const req = createMockRequest({
        method: 'GET',
        url: '/api/tasks',
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      // Simulate response finishing
      res.statusCode = 200;
      res.emit('finish');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-request-123]'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Response 200')
      );
    });

    it('should log response duration', () => {
      vi.useFakeTimers();

      const req = createMockRequest() as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      // Advance time by 150ms
      vi.advanceTimersByTime(150);

      // Simulate response finishing
      res.emit('finish');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('150ms')
      );

      vi.useRealTimers();
    });

    it('should log client IP when available', () => {
      const req = createMockRequest({
        headers: {
          'x-forwarded-for': '203.0.113.1',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: '203.0.113.1',
        })
      );
    });

    it('should extract first IP from x-forwarded-for chain', () => {
      const req = createMockRequest({
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: '203.0.113.1',
        })
      );
    });

    it('should use x-real-ip if x-forwarded-for not present', () => {
      const req = createMockRequest({
        headers: {
          'x-real-ip': '203.0.113.5',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: '203.0.113.5',
        })
      );
    });

    it('should use cf-connecting-ip for Cloudflare requests', () => {
      const req = createMockRequest({
        headers: {
          'cf-connecting-ip': '203.0.113.10',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: '203.0.113.10',
        })
      );
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const req = createMockRequest({
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'x-real-ip': '203.0.113.2',
          'cf-connecting-ip': '203.0.113.3',
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: '203.0.113.1', // Should use x-forwarded-for
        })
      );
    });

    it('should log user agent', () => {
      const userAgent = 'Mozilla/5.0 (Test Browser)';
      const req = createMockRequest({
        headers: {
          'user-agent': userAgent,
        },
      }) as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userAgent,
        })
      );
    });

    it('should log different status codes', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      req.requestId = 'test-request-123';
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      // Test 404
      res.statusCode = 404;
      res.emit('finish');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Response 404')
      );
    });

    it('should call next middleware', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should register finish listener only once', () => {
      const req = createMockRequest() as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestLogger();
      middleware(req, res, mockNext);

      // Check that res.once was called (EventEmitter method)
      expect(res.once).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should work with requestId and logger together', () => {
      const req = createMockRequest({
        method: 'POST',
        url: '/api/tasks',
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const idMiddleware = requestIdMiddleware();
      const logMiddleware = requestLogger();

      // Apply ID middleware first
      idMiddleware(req, res, mockNext);

      // Then logger middleware
      logMiddleware(req, res, mockNext);

      expect(req.requestId).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[${req.requestId}]`),
        expect.any(Object)
      );
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should preserve request ID through complete request lifecycle', () => {
      const req = createMockRequest({
        method: 'GET',
        url: '/api/tasks',
        headers: {
          'x-request-id': 'lifecycle-test-123',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const idMiddleware = requestIdMiddleware();
      const logMiddleware = requestLogger();

      // ID middleware
      idMiddleware(req, res, mockNext);
      expect(req.requestId).toBe('lifecycle-test-123');

      // Logger middleware
      logMiddleware(req, res, mockNext);

      // Simulate response
      res.statusCode = 200;
      res.emit('finish');

      // Check that both logs used same ID
      const logCalls = consoleLogSpy.mock.calls;
      expect(logCalls[0][0]).toContain('[lifecycle-test-123]');
      expect(logCalls[1][0]).toContain('[lifecycle-test-123]');
    });

    it('should handle complete authenticated request flow', () => {
      const req = createMockRequest({
        method: 'POST',
        url: '/api/tasks',
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Test Browser',
        },
      }) as AuthenticatedRequest;
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
      const res = createMockResponse();

      const idMiddleware = requestIdMiddleware();
      const logMiddleware = requestLogger();

      idMiddleware(req, res, mockNext);
      logMiddleware(req, res, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('POST /api/tasks'),
        expect.objectContaining({
          userId: 'user-123',
          ip: '203.0.113.1',
          userAgent: 'Test Browser',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle request with no headers', () => {
      const req = createMockRequest({
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const idMiddleware = requestIdMiddleware();
      const logMiddleware = requestLogger();

      expect(() => {
        idMiddleware(req, res, mockNext);
        logMiddleware(req, res, mockNext);
      }).not.toThrow();
    });

    it('should handle request with no URL', () => {
      const req = createMockRequest({
        url: undefined,
      }) as AuthenticatedRequest;
      req.requestId = 'test-123';
      const res = createMockResponse();

      const middleware = requestLogger();

      expect(() => {
        middleware(req, res, mockNext);
      }).not.toThrow();
    });

    it('should handle request with no method', () => {
      const req = createMockRequest({
        method: undefined,
      }) as AuthenticatedRequest;
      req.requestId = 'test-123';
      const res = createMockResponse();

      const middleware = requestLogger();

      expect(() => {
        middleware(req, res, mockNext);
      }).not.toThrow();
    });

    it('should handle very long request IDs', () => {
      const longId = 'a'.repeat(1000);
      const req = createMockRequest({
        headers: {
          'x-request-id': longId,
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(req.requestId).toBe(longId);
    });

    it('should handle request ID with newlines and special chars', () => {
      const specialId = 'req-123\n\r\t';
      const req = createMockRequest({
        headers: {
          'x-request-id': specialId,
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = requestIdMiddleware();
      middleware(req, res, mockNext);

      expect(req.requestId).toBe(specialId);
    });
  });
});
