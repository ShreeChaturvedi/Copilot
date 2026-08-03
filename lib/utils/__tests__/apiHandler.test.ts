/**
 * apiHandler pipeline tests — auth order + rate-limit keying (issue #89).
 *
 * Authenticated routes must rate-limit AFTER authenticateJWT so the default
 * keyGenerator keys on req.user.id. Public routes stay IP-keyed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpMethod } from '../../types/api.js';
import type { AuthenticatedRequest } from '../../types/api.js';
import {
  createMockRequest,
  createMockResponse,
} from '../../__tests__/helpers/index.js';

const rateLimitObservations: Array<{ userId?: string; ip?: string }> = [];

vi.mock('../../middleware/auth.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../middleware/auth.js')>();
  return {
    ...actual,
    // Keep the default dev user out so keying is deterministic in tests.
    devAuth:
      () => (_req: AuthenticatedRequest, _res: unknown, next: () => void) =>
        next(),
    authenticateJWT: () => {
      return async (
        req: AuthenticatedRequest,
        _res: unknown,
        next: () => void
      ) => {
        const header = req.headers.authorization;
        if (typeof header !== 'string' || !header.startsWith('Bearer user:')) {
          const { UnauthorizedError } = await import('../../types/api.js');
          throw new UnauthorizedError(
            'Missing or invalid authorization header'
          );
        }
        const id = header.slice('Bearer user:'.length);
        req.user = {
          id,
          email: `${id}@example.com`,
          name: id,
        };
        return next();
      };
    },
  };
});

vi.mock('../../middleware/rateLimit.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../middleware/rateLimit.js')>();

  function observingLimit(max: number) {
    return actual.rateLimit({
      max,
      windowMs: 60_000,
      keyGenerator: (req) => {
        const key =
          req.user?.id || 'ip:' + (req.headers['x-real-ip'] || 'anon');
        rateLimitObservations.push({
          userId: req.user?.id,
          ip:
            typeof req.headers['x-real-ip'] === 'string'
              ? req.headers['x-real-ip']
              : undefined,
        });
        return key;
      },
    });
  }

  return {
    ...actual,
    rateLimitPresets: {
      auth: observingLimit(5),
      api: observingLimit(3),
      read: observingLimit(3),
      write: observingLimit(3),
      upload: observingLimit(3),
    },
  };
});

vi.mock('../../middleware/errorHandler.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../middleware/errorHandler.js')>();
  return {
    ...actual,
    // Surface thrown auth errors as status codes via the real sendError path
    // when possible; for unit tests keep the handler unwrapped so 429s from
    // rateLimit (which write the response directly) stay visible.
    asyncHandler: (handler: (req: unknown, res: unknown) => unknown) => {
      return async (req: unknown, res: unknown) => {
        try {
          return await handler(req, res);
        } catch (err) {
          return actual.sendError(
            res as never,
            err as import('../../types/api.js').ApiError
          );
        }
      };
    },
  };
});

const { createApiHandler, createMethodHandler } = await import(
  '../apiHandler.js'
);
const { resetRateLimitStore } = await import('../../middleware/rateLimit.js');

function reqWith(
  overrides: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): AuthenticatedRequest {
  return createMockRequest({
    method: overrides.method ?? 'GET',
    headers: {
      'x-request-id': 'test-request',
      'x-real-ip': '203.0.113.10',
      ...(overrides.headers ?? {}),
    },
  }) as AuthenticatedRequest;
}

describe('createApiHandler rate-limit order (issue #89)', () => {
  beforeEach(() => {
    resetRateLimitStore();
    rateLimitObservations.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStore();
  });

  it('runs rate limit after auth so observations see req.user.id', async () => {
    const handler = createApiHandler(
      {
        [HttpMethod.GET]: {
          method: HttpMethod.GET,
          requireAuth: true,
          handler: async (_req, res) => {
            res.status(200).json({ ok: true });
          },
        },
      },
      { rateLimit: 'api' }
    );

    const res = createMockResponse();
    await handler(
      reqWith({
        headers: {
          authorization: 'Bearer user:alice',
          'x-real-ip': '203.0.113.10',
        },
      }),
      res
    );

    expect(rateLimitObservations).toEqual([
      { userId: 'alice', ip: '203.0.113.10' },
    ]);
    expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
  });

  it('gives shared-NAT users separate budgets on requireAuth routes', async () => {
    const handler = createApiHandler(
      {
        [HttpMethod.GET]: {
          method: HttpMethod.GET,
          requireAuth: true,
          handler: async (_req, res) => {
            res.status(200).json({ ok: true });
          },
        },
      },
      { rateLimit: 'api' } // mocked preset max=3
    );

    const burn = async (userId: string) => {
      const res = createMockResponse();
      await handler(
        reqWith({
          headers: {
            authorization: `Bearer user:${userId}`,
            'x-real-ip': '203.0.113.10',
          },
        }),
        res
      );
      return res;
    };

    // alice: 3 allowed, 4th → 429
    expect(vi.mocked((await burn('alice')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('alice')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('alice')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('alice')).status)).toHaveBeenCalledWith(429);

    // bob shares the IP but has a fresh user-keyed bucket
    expect(vi.mocked((await burn('bob')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('bob')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('bob')).status)).toHaveBeenCalledWith(200);
    expect(vi.mocked((await burn('bob')).status)).toHaveBeenCalledWith(429);
  });

  it('keys public routes by IP (no user on the rate-limit observation)', async () => {
    const handler = createApiHandler(
      {
        [HttpMethod.GET]: {
          method: HttpMethod.GET,
          requireAuth: false,
          handler: async (_req, res) => {
            res.status(200).json({ ok: true });
          },
        },
      },
      { rateLimit: 'api' }
    );

    const res = createMockResponse();
    await handler(reqWith({ headers: { 'x-real-ip': '198.51.100.1' } }), res);

    expect(rateLimitObservations).toEqual([
      { userId: undefined, ip: '198.51.100.1' },
    ]);
    expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
  });

  it('rate-limits public routes by shared IP', async () => {
    const handler = createApiHandler(
      {
        [HttpMethod.GET]: {
          method: HttpMethod.GET,
          requireAuth: false,
          handler: async (_req, res) => {
            res.status(200).json({ ok: true });
          },
        },
      },
      { rateLimit: 'api' } // max=3
    );

    const burn = async (ip: string) => {
      const res = createMockResponse();
      await handler(reqWith({ headers: { 'x-real-ip': ip } }), res);
      return res;
    };

    expect(vi.mocked((await burn('203.0.113.50')).status)).toHaveBeenCalledWith(
      200
    );
    expect(vi.mocked((await burn('203.0.113.50')).status)).toHaveBeenCalledWith(
      200
    );
    expect(vi.mocked((await burn('203.0.113.50')).status)).toHaveBeenCalledWith(
      200
    );
    expect(vi.mocked((await burn('203.0.113.50')).status)).toHaveBeenCalledWith(
      429
    );

    // Different IP still allowed
    expect(vi.mocked((await burn('203.0.113.51')).status)).toHaveBeenCalledWith(
      200
    );
  });
});

describe('createMethodHandler rate-limit order (issue #89)', () => {
  beforeEach(() => {
    resetRateLimitStore();
    rateLimitObservations.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStore();
  });

  it('observes user id on requireAuth method handlers', async () => {
    const handler = createMethodHandler(
      {
        [HttpMethod.GET]: async (_req, res) => {
          res.status(200).json({ ok: true });
        },
      },
      { requireAuth: true, rateLimit: 'api' }
    );

    const res = createMockResponse();
    await handler(
      reqWith({
        headers: {
          authorization: 'Bearer user:carol',
          'x-real-ip': '203.0.113.99',
        },
      }),
      res
    );

    expect(rateLimitObservations).toEqual([
      { userId: 'carol', ip: '203.0.113.99' },
    ]);
    expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
  });

  it('does not attach a user on public method handlers', async () => {
    const handler = createMethodHandler(
      {
        [HttpMethod.GET]: async (_req, res) => {
          res.status(200).json({ ok: true });
        },
      },
      { requireAuth: false, rateLimit: 'api' }
    );

    const res = createMockResponse();
    await handler(reqWith({ headers: { 'x-real-ip': '203.0.113.7' } }), res);

    expect(rateLimitObservations).toEqual([
      { userId: undefined, ip: '203.0.113.7' },
    ]);
    expect(vi.mocked(res.status)).toHaveBeenCalledWith(200);
  });
});
