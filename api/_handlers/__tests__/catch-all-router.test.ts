/**
 * Unit tests for the consolidated catch-all API router (api/[...route].ts).
 *
 * These exercise the routing layer itself (path parsing, param injection,
 * static-over-dynamic precedence, and the NOT_FOUND fallback) without touching
 * the database: matchRoute/parseUrl are pure, the 404 path invokes no handler,
 * and the one end-to-end dispatch targets /api/health (DB-free).
 */
import { describe, it, expect } from 'vitest';
import router, { matchRoute, parseUrl } from '../../[...route].js';
import {
  createMockRequest,
  createMockResponse,
  getResponseData,
  getResponseStatus,
} from '../../../lib/__tests__/helpers/index.js';

describe('catch-all API router', () => {
  describe('parseUrl', () => {
    it('decodes path segments', () => {
      const { segments } = parseUrl('/api/tasks/abc%20def');
      expect(segments).toEqual(['api', 'tasks', 'abc def']);
    });

    it('parses query strings, keeping repeated keys as arrays', () => {
      const { segments, query } = parseUrl(
        '/api/events/conflicts?start=2026-01-01&end=2026-01-02&tag=a&tag=b'
      );
      expect(segments).toEqual(['api', 'events', 'conflicts']);
      expect(query).toEqual({
        start: '2026-01-01',
        end: '2026-01-02',
        tag: ['a', 'b'],
      });
    });
  });

  describe('matchRoute', () => {
    it('injects a dynamic [id] param (tasks/[id])', () => {
      const match = matchRoute(['tasks', 'abc']);
      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ id: 'abc' });
    });

    it('prefers a static segment over the dynamic [id] route', () => {
      // /api/tasks/stats must hit tasks/stats.ts, NOT tasks/[id].ts with id=stats
      const match = matchRoute(['tasks', 'stats']);
      expect(match).not.toBeNull();
      expect(match?.params).toEqual({});
    });

    it('matches a nested static route (auth/google/callback)', () => {
      const match = matchRoute(['auth', 'google', 'callback']);
      expect(match).not.toBeNull();
      expect(match?.params).toEqual({});
    });

    it('returns null for an unknown route', () => {
      expect(matchRoute(['does', 'not', 'exist'])).toBeNull();
      expect(matchRoute([])).toBeNull();
    });
  });

  describe('dispatch (default export)', () => {
    it('returns the app NOT_FOUND error shape for an unknown route', async () => {
      const req = createMockRequest({ method: 'GET', url: '/api/nope/nope' });
      const res = createMockResponse();

      await router(req, res);

      expect(getResponseStatus(res)).toBe(404);
      const body = getResponseData(res) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Endpoint not found');
    });

    it('dispatches a matched route and passes query params through (health)', async () => {
      const req = createMockRequest({
        method: 'GET',
        url: '/api/health?foo=bar',
      });
      const res = createMockResponse();

      await router(req, res);

      // req.query is rebuilt from the URL (the catch-all "route" param is dropped)
      expect(req.query).toEqual({ foo: 'bar' });
      expect(getResponseStatus(res)).toBe(200);
      const body = getResponseData(res) as {
        success: boolean;
        data: { status: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
    });
  });
});
