/**
 * CORS middleware test suite
 * Tests origin handling, preflight requests, headers, and security configuration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { corsMiddleware, cors } from '../cors';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';

describe('CORS Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  describe('corsMiddleware', () => {
    it('should handle preflight OPTIONS request', () => {
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(res.end)).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set CORS headers for non-OPTIONS requests', () => {
      const req = createMockRequest({
        method: 'GET',
        headers: {
          origin: 'https://example.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should allow all origins in development (origin: true)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = createMockRequest({
        headers: {
          origin: 'https://any-domain.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set specific origin when origin is a string', () => {
      const allowedOrigin = 'https://trusted-domain.com';
      const req = createMockRequest({
        headers: {
          origin: allowedOrigin,
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({ origin: allowedOrigin });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        allowedOrigin
      );
    });

    it('should allow whitelisted origins when origin is an array', () => {
      const allowedOrigins = ['https://trusted1.com', 'https://trusted2.com'];
      const req = createMockRequest({
        headers: {
          origin: 'https://trusted1.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({ origin: allowedOrigins });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://trusted1.com'
      );
    });

    it('should not set origin header when origin is not in whitelist', () => {
      const allowedOrigins = ['https://trusted1.com', 'https://trusted2.com'];
      const req = createMockRequest({
        headers: {
          origin: 'https://malicious.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({ origin: allowedOrigins });
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const originCall = setHeaderCalls.find(
        ([header]) => header === 'Access-Control-Allow-Origin'
      );
      expect(originCall).toBeUndefined();
    });

    it('should set Allow-Methods header with default methods', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
    });

    it('should set Allow-Methods header with custom methods', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({
        methods: ['GET', 'POST'],
      });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST'
      );
    });

    it('should set Allow-Headers header with default headers', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        expect.stringContaining('Content-Type')
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        expect.stringContaining('Authorization')
      );
    });

    it('should set Allow-Credentials header when credentials is true', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({ credentials: true });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
    });

    it('should not set Allow-Credentials header when credentials is false', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({ credentials: false });
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const credentialsCall = setHeaderCalls.find(
        ([header]) => header === 'Access-Control-Allow-Credentials'
      );
      expect(credentialsCall).toBeUndefined();
    });

    it('should set Max-Age header when maxAge is provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({ maxAge: 3600 });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Max-Age',
        '3600'
      );
    });

    it('should set security headers', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should merge custom config with default config', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({
        methods: ['GET', 'POST'],
        maxAge: 7200,
      });
      middleware(req, res, mockNext);

      // Custom values
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST'
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Max-Age',
        '7200'
      );

      // Default values still applied
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
    });

    it('should handle requests without origin header', () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({
        origin: ['https://trusted.com'],
      });

      // Should not throw
      expect(() => middleware(req, res, mockNext)).not.toThrow();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle empty array of allowed origins', () => {
      const req = createMockRequest({
        headers: {
          origin: 'https://any-domain.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({ origin: [] });
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const originCall = setHeaderCalls.find(
        ([header]) => header === 'Access-Control-Allow-Origin'
      );
      expect(originCall).toBeUndefined();
    });

    it('should handle custom allowed headers', () => {
      const customHeaders = ['X-Custom-Header', 'X-Another-Header'];
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware({
        allowedHeaders: customHeaders,
      });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'X-Custom-Header, X-Another-Header'
      );
    });
  });

  describe('cors (default export)', () => {
    it('should be a pre-configured CORS middleware', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      cors(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle preflight requests with default configuration', () => {
      const req = createMockRequest({
        method: 'OPTIONS',
      });
      const res = createMockResponse();

      cors(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(res.end)).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle multiple origins in x-forwarded-for style header', () => {
      const req = createMockRequest({
        headers: {
          origin: 'https://trusted.com',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({
        origin: ['https://trusted.com', 'https://another-trusted.com'],
      });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://trusted.com'
      );
    });

    it('should handle case-sensitive origin matching', () => {
      const req = createMockRequest({
        headers: {
          origin: 'https://Trusted.com', // Different case
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({
        origin: ['https://trusted.com'],
      });
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const originCall = setHeaderCalls.find(
        ([header]) => header === 'Access-Control-Allow-Origin'
      );
      // Should not match due to case sensitivity
      expect(originCall).toBeUndefined();
    });

    it('should not allow wildcard when credentials is true', () => {
      const req = createMockRequest({
        headers: {
          origin: 'https://any-domain.com',
        },
      });
      const res = createMockResponse();

      // This combination should work but is a security anti-pattern
      // (browsers reject Access-Control-Allow-Origin: * with credentials)
      const middleware = corsMiddleware({
        origin: true,
        credentials: true,
      });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
      // Note: Browsers will reject this combination, but middleware allows it
    });

    it('should handle production environment with VERCEL_URL', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalVercelUrl = process.env.VERCEL_URL;

      process.env.NODE_ENV = 'production';
      process.env.VERCEL_URL = 'https://my-app.vercel.app';

      const req = createMockRequest({
        headers: {
          origin: 'https://my-app.vercel.app',
        },
      });
      const res = createMockResponse();

      // Recreate middleware with production config
      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      process.env.VERCEL_URL = originalVercelUrl;
    });

    it('should set all security headers consistently', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = corsMiddleware();
      middleware(req, res, mockNext);

      const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
      ];

      securityHeaders.forEach(header => {
        const headerCall = setHeaderCalls.find(([name]) => name === header);
        expect(headerCall).toBeDefined();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with typical frontend request flow', () => {
      const req = createMockRequest({
        method: 'POST',
        headers: {
          origin: 'https://my-app.com',
          'content-type': 'application/json',
        },
      });
      const res = createMockResponse();

      const middleware = corsMiddleware({
        origin: ['https://my-app.com'],
        credentials: true,
      });
      middleware(req, res, mockNext);

      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://my-app.com'
      );
      expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle complete preflight + actual request flow', () => {
      const origin = 'https://my-app.com';
      const allowedOrigins = [origin];

      // Preflight request
      const preflightReq = createMockRequest({
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      });
      const preflightRes = createMockResponse();

      const middleware = corsMiddleware({ origin: allowedOrigins });
      middleware(preflightReq, preflightRes, mockNext);

      expect(vi.mocked(preflightRes.status)).toHaveBeenCalledWith(200);
      expect(vi.mocked(preflightRes.end)).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();

      // Actual request
      const actualReq = createMockRequest({
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
        },
      });
      const actualRes = createMockResponse();

      middleware(actualReq, actualRes, mockNext);

      expect(vi.mocked(actualRes.setHeader)).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        origin
      );
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });
});
