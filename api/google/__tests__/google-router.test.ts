/**
 * Router-level tests for the /api/google/* serverless function: path
 * matching, cron bearer detection (timing-safe), and cron-mode dispatch.
 * Endpoint behavior against the DB is covered by the GoogleSyncService
 * integration suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockRequest,
  createMockResponse,
} from '../../../lib/__tests__/helpers/mockRequest.js';
import handler from '../[...route].js';
import { isCronRequest } from '../../../lib/google/googleApi.js';

const CRON_SECRET = 'a'.repeat(64);

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  envBackup = {
    GOOGLE_SYNC_CRON_SECRET: process.env.GOOGLE_SYNC_CRON_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENC_KEY: process.env.GOOGLE_TOKEN_ENC_KEY,
  };
  process.env.GOOGLE_SYNC_CRON_SECRET = CRON_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_TOKEN_ENC_KEY;
});

afterEach(() => {
  for (const [k, v] of Object.entries(envBackup)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.clearAllMocks();
});

describe('isCronRequest', () => {
  it('accepts the exact cron bearer', () => {
    expect(isCronRequest(`Bearer ${CRON_SECRET}`)).toBe(true);
  });

  it('rejects wrong, missing, and malformed values', () => {
    expect(isCronRequest(`Bearer ${'b'.repeat(64)}`)).toBe(false);
    expect(isCronRequest(`Bearer ${CRON_SECRET.slice(0, 63)}`)).toBe(false);
    expect(isCronRequest(CRON_SECRET)).toBe(false); // no Bearer prefix
    expect(isCronRequest(undefined)).toBe(false);
  });

  it('rejects everything when the secret is unset', () => {
    delete process.env.GOOGLE_SYNC_CRON_SECRET;
    expect(isCronRequest(`Bearer ${CRON_SECRET}`)).toBe(false);
  });
});

describe('/api/google router', () => {
  it('404s unknown routes and nested paths', async () => {
    for (const url of [
      '/api/google/nope',
      '/api/google',
      '/api/google/status/extra',
    ]) {
      const req = createMockRequest({ url, method: 'GET' });
      const res = createMockResponse();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });

  it('405s a GET to /api/google/sync', async () => {
    const req = createMockRequest({ url: '/api/google/sync', method: 'GET' });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('cron-mode sync responds 503 when Google sync is not configured', async () => {
    // Valid cron bearer reaches syncAllUsers, which fails closed on missing
    // GOOGLE_CLIENT_ID/SECRET/ENC_KEY before touching the database.
    const req = createMockRequest({
      url: '/api/google/sync',
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(body.error.code).toBe('GOOGLE_SYNC_NOT_CONFIGURED');
  });

  it('routes with and without the /api prefix', async () => {
    const req = createMockRequest({ url: '/google/sync', method: 'GET' });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405); // matched the sync route
  });
});
