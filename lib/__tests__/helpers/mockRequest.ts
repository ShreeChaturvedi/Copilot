/**
 * Mock Request and Response helpers for API integration tests
 * Provides proper EventEmitter implementation to fix middleware test failures
 */
import { vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EventEmitter } from 'events';

/**
 * Creates a mock VercelRequest with EventEmitter support
 */
export function createMockRequest(
  overrides: Partial<VercelRequest> = {}
): VercelRequest {
  const req = new EventEmitter() as any;

  // Default request properties
  Object.assign(req, {
    method: 'GET',
    url: '/api/test',
    headers: {
      'x-request-id': 'test-request-123',
      'content-type': 'application/json',
    },
    query: {},
    body: {},
    cookies: {},
    // Add any overrides
    ...overrides,
  });

  return req as VercelRequest;
}

/**
 * Creates a mock VercelResponse with EventEmitter support and chainable methods
 */
export function createMockResponse(): VercelResponse {
  const res = new EventEmitter() as any;

  // Mock response methods (chainable)
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.getHeader = vi.fn();
  res.removeHeader = vi.fn().mockReturnValue(res);
  res.write = vi.fn().mockReturnValue(true);
  res.writeHead = vi.fn().mockReturnValue(res);

  // Response state
  res.statusCode = 200;
  res.statusMessage = 'OK';
  res.headersSent = false;

  return res as VercelResponse;
}

/**
 * Creates a mock authenticated request with user context
 */
export function createMockAuthRequest(
  user: { id: string; email: string; name?: string },
  overrides: Partial<VercelRequest> = {}
): VercelRequest {
  return createMockRequest({
    user,
    headers: {
      'x-request-id': 'test-request-123',
      authorization: 'Bearer mock-jwt-token',
      'content-type': 'application/json',
    },
    ...overrides,
  });
}

/**
 * Mock user object for testing
 */
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

/**
 * Mock admin user object for testing
 */
export const mockAdminUser = {
  id: 'admin-123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
};

/**
 * Extracts response data from mock response json() calls
 */
export function getResponseData(mockResponse: VercelResponse) {
  const jsonCalls = vi.mocked(mockResponse.json).mock.calls;
  if (jsonCalls.length === 0) {
    return null;
  }
  return jsonCalls[jsonCalls.length - 1][0];
}

/**
 * Extracts response status from mock response
 */
export function getResponseStatus(mockResponse: VercelResponse): number {
  const statusCalls = vi.mocked(mockResponse.status).mock.calls;
  if (statusCalls.length === 0) {
    return mockResponse.statusCode || 200;
  }
  return statusCalls[statusCalls.length - 1][0];
}

/**
 * Asserts that response was successful (2xx status)
 */
export function assertSuccessResponse(mockResponse: VercelResponse) {
  const status = getResponseStatus(mockResponse);
  if (status < 200 || status >= 300) {
    const data = getResponseData(mockResponse);
    throw new Error(
      `Expected success response but got ${status}. Data: ${JSON.stringify(data, null, 2)}`
    );
  }
}

/**
 * Asserts that response was an error (4xx or 5xx status)
 */
export function assertErrorResponse(
  mockResponse: VercelResponse,
  expectedStatus?: number
) {
  const status = getResponseStatus(mockResponse);
  if (status < 400) {
    const data = getResponseData(mockResponse);
    throw new Error(
      `Expected error response but got ${status}. Data: ${JSON.stringify(data, null, 2)}`
    );
  }
  if (expectedStatus && status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus} but got ${status}`);
  }
}
