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
import {
  isCronRequest,
  isRenewCronRequest,
} from '../../../lib/google/googleApi.js';

const CRON_SECRET = 'a'.repeat(64);
const VERCEL_CRON_SECRET = 'v'.repeat(64);

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  envBackup = {
    GOOGLE_SYNC_CRON_SECRET: process.env.GOOGLE_SYNC_CRON_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENC_KEY: process.env.GOOGLE_TOKEN_ENC_KEY,
  };
  process.env.GOOGLE_SYNC_CRON_SECRET = CRON_SECRET;
  process.env.CRON_SECRET = VERCEL_CRON_SECRET;
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

describe('isRenewCronRequest', () => {
  it('accepts the Vercel CRON_SECRET bearer', () => {
    expect(isRenewCronRequest(`Bearer ${VERCEL_CRON_SECRET}`)).toBe(true);
  });

  it('also accepts the GH-Actions reconciliation secret (manual runs)', () => {
    expect(isRenewCronRequest(`Bearer ${CRON_SECRET}`)).toBe(true);
  });

  it('rejects wrong and missing bearers', () => {
    expect(isRenewCronRequest(`Bearer ${'x'.repeat(64)}`)).toBe(false);
    expect(isRenewCronRequest(undefined)).toBe(false);
  });

  it('rejects everything when both secrets are unset', () => {
    delete process.env.CRON_SECRET;
    delete process.env.GOOGLE_SYNC_CRON_SECRET;
    expect(isRenewCronRequest(`Bearer ${VERCEL_CRON_SECRET}`)).toBe(false);
  });
});

describe('/api/google router', () => {
  it('404s unknown routes and nested paths', async () => {
    for (const url of [
      '/api/google/nope',
      '/api/google',
      '/api/google/status/extra',
      '/api/google/cron/renew/extra',
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

describe('POST /api/google/webhook (transport contract)', () => {
  it('405s non-POST methods', async () => {
    const req = createMockRequest({
      url: '/api/google/webhook',
      method: 'GET',
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('400s a POST without the X-Goog channel/resource ids', async () => {
    // No X-Goog-Channel-ID/X-Goog-Resource-ID -> demonstrably not from
    // Google; the only non-2xx the webhook ever returns.
    const req = createMockRequest({
      url: '/api/google/webhook',
      method: 'POST',
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(body.error.code).toBe('INVALID_WEBHOOK');
  });

  it('answers 200/ignored when sync is not configured (never retries)', async () => {
    const req = createMockRequest({
      url: '/api/google/webhook',
      method: 'POST',
      headers: {
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
      },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(body.success).toBe(true);
    expect(body.data.outcome).toBe('ignored');
  });
});

describe('GET /api/google/cron/renew (transport contract)', () => {
  it('405s non-GET methods', async () => {
    const req = createMockRequest({
      url: '/api/google/cron/renew',
      method: 'POST',
      headers: { authorization: `Bearer ${VERCEL_CRON_SECRET}` },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('401s without a valid cron bearer', async () => {
    for (const headers of [
      {},
      { authorization: `Bearer ${'x'.repeat(64)}` },
      { authorization: VERCEL_CRON_SECRET }, // no Bearer prefix
    ]) {
      const req = createMockRequest({
        url: '/api/google/cron/renew',
        method: 'GET',
        headers,
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  it('503s a valid cron request when Google sync is not configured', async () => {
    const req = createMockRequest({
      url: '/api/google/cron/renew',
      method: 'GET',
      headers: { authorization: `Bearer ${VERCEL_CRON_SECRET}` },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(body.error.code).toBe('GOOGLE_SYNC_NOT_CONFIGURED');
  });
});
