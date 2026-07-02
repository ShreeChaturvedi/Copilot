/**
 * L3 — routing, 401/404/405, OPTIONS/CORS and middleware-pipeline contracts of
 * the REAL catch-all dispatcher (api/[...route].ts) and handler factories.
 *
 * Two pinned bugs live here:
 *   #63 requireAuth routes never answer 401 (request hangs, error dropped)
 *   #65 OPTIONS preflight returns 405 (CORS middleware unreachable)
 * Flip those pins when the fixes land.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  closeAppPools,
  resetRateLimitStore,
  type TestServer,
} from './adapter.js';
import {
  makeClient,
  registerUser,
  signAccessToken,
  dbAvailable,
  cleanupPool,
  cleanupTestData,
} from './helpers.js';

interface Envelope<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; timestamp: string };
}

describe.skipIf(!dbAvailable)('L3 routing / auth-pipeline contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  describe('GET /api/health', () => {
    it('200 with status/timestamp/environment/version (direct res.json shape, apiHandler.ts:172-184)', async () => {
      const r = await req<
        Envelope<{
          status: string;
          timestamp: string;
          environment: string;
          version: string;
        }>
      >('GET', '/api/health');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data?.status).toBe('ok');
      expect(new Date(r.body.data!.timestamp).getTime()).not.toBeNaN();
      expect(r.body.data?.environment).toBe('production');
    });
  });

  describe('unknown routes (catch-all NOT_FOUND contract)', () => {
    it.each([
      '/api/nope',
      '/api/tasks/abc/def/ghi',
      '/api/auth',
      '/api/google/unknown',
      '/api/google/status/extra',
    ])('%s -> 404 NOT_FOUND "Endpoint not found"', async (path) => {
      const r = await req<Envelope>('GET', path);
      expect(r.status).toBe(404);
      expect(r.body.success).toBe(false);
      expect(r.body.error?.code).toBe('NOT_FOUND');
      expect(r.body.error?.message).toBe('Endpoint not found');
      expect(r.body.error?.timestamp).toEqual(expect.any(String));
    });
  });

  describe('static-over-dynamic route precedence (matchRoute, api/[...route].ts:143-170)', () => {
    it('GET /api/tasks/stats dispatches to the stats handler, not tasks/[id]', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope>('GET', '/api/tasks/stats', {
        token: u.accessToken,
      });
      // Discriminator: the stats handler (createMethodHandler, never
      // authenticated, issue #64) answers 401 UNAUTHORIZED. tasks/[id] would
      // have answered 404 NOT_FOUND ("Task not found") for id="stats". So a
      // 401 here proves the static route won.
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('dynamic [id] segment is injected into req.query (unknown id -> 404 Task not found)', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope>('GET', '/api/tasks/no-such-task-id', {
        token: u.accessToken,
      });
      expect(r.status).toBe(404);
      expect(r.body.error?.code).toBe('NOT_FOUND');
      expect(r.body.error?.message).toBe('Task not found');
    });
  });

  describe('OPTIONS / CORS (pins issue #65)', () => {
    it('OPTIONS on a routed path returns 405, NOT the CORS preflight 200 (method dispatch precedes corsMiddleware)', async () => {
      const r = await req<Envelope>('OPTIONS', '/api/tasks', {
        headers: {
          Origin: 'https://l3.example.test',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });
      // corsMiddleware's OPTIONS branch (lib/middleware/cors.ts:40-44) would
      // send 200 + CORS headers, but createCrudHandler looks up routes[method]
      // first and OPTIONS is never registered. Issue #65; flip to 200 when
      // preflight handling lands.
      expect(r.status).toBe(405);
      expect(r.body.error?.code).toBe('METHOD_NOT_ALLOWED');
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('normal responses DO carry CORS + security headers for an allow-listed Origin (FRONTEND_URL)', async () => {
      const r = await req<Envelope>('GET', '/api/health', {
        headers: { Origin: 'https://l3.example.test' },
      });
      expect(r.status).toBe(200);
      // Production allow-list is [VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL,
      // FRONTEND_URL] (lib/middleware/cors.ts:10-18); the config sets
      // FRONTEND_URL=https://l3.example.test.
      expect(r.headers.get('access-control-allow-origin')).toBe(
        'https://l3.example.test'
      );
      expect(r.headers.get('access-control-allow-credentials')).toBe('true');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
    });

    it('an Origin outside the allow-list gets no Access-Control-Allow-Origin header', async () => {
      const r = await req<Envelope>('GET', '/api/health', {
        headers: { Origin: 'https://evil.example.com' },
      });
      expect(r.status).toBe(200);
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('requireAuth token failures (pins issue #63: request hangs, no 401)', () => {
    // The real contract the frontend needs is a 401 (its refresh flow keys off
    // failed requests). Today authenticateJWT's UnauthorizedError is dropped by
    // the middleware chain (middlewares call next() without awaiting), the
    // response is never written, and the request hangs until client timeout.
    // These pins assert the hang so the suite notices when #63 is fixed:
    // replace them with status-401 assertions then.
    const expectHang = async (path: string, token?: string) => {
      await expect(
        fetch(server.baseUrl + path, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(1500),
        })
      ).rejects.toThrow(/timeout|abort/i);
    };

    it('GET /api/tasks without a token: NO response at all (issue #63)', async () => {
      await expectHang('/api/tasks');
    });

    it('GET /api/auth/me with an EXPIRED access token: NO response at all (issue #63)', async () => {
      const u = await registerUser(req);
      const expired = signAccessToken(
        { userId: u.userId, email: u.email },
        '-10s'
      );
      await expectHang('/api/auth/me', expired);
    });

    it('GET /api/events with a garbage token: NO response at all (issue #63)', async () => {
      await expectHang('/api/events', 'not-a-jwt');
    });

    it('a refresh token is REJECTED as an access token (type check works when the signature is valid)', async () => {
      // Wrong-type tokens still go through verifyToken successfully and then
      // throw UnauthorizedError('Invalid token type') — which is ALSO dropped
      // (#63). Pin the hang.
      const u = await registerUser(req);
      await expectHang('/api/auth/me', u.refreshToken);
    });
  });

  describe('405 method contract on routed handlers', () => {
    it('DELETE /api/health -> 405 METHOD_NOT_ALLOWED envelope', async () => {
      const r = await req<Envelope>('DELETE', '/api/health');
      expect(r.status).toBe(405);
      expect(r.body.success).toBe(false);
      expect(r.body.error?.code).toBe('METHOD_NOT_ALLOWED');
      expect(r.body.error?.message).toBe('Method not allowed');
    });
  });
});
