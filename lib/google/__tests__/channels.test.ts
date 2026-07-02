/**
 * Unit tests for the push-channel helpers (plan §3, M3): webhook address
 * resolution, X-Goog-* header parsing, channel-token validation, and the
 * 48h renewal-window math. No network, no database.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  channelNeedsRenewal,
  parseWebhookHeaders,
  validateChannelToken,
  webhookAddress,
  RENEWAL_WINDOW_MS,
  CHANNEL_TTL_SECONDS,
} from '../channels.js';

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  envBackup = {
    GOOGLE_WEBHOOK_URL: process.env.GOOGLE_WEBHOOK_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  };
  delete process.env.GOOGLE_WEBHOOK_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  for (const [k, v] of Object.entries(envBackup)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('webhookAddress', () => {
  it('prefers the explicit GOOGLE_WEBHOOK_URL', () => {
    process.env.GOOGLE_WEBHOOK_URL = 'https://example.test/api/google/webhook';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'ignored.vercel.app';
    expect(webhookAddress()).toBe('https://example.test/api/google/webhook');
  });

  it('derives from the Vercel production domain', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'taskflow.vercel.app';
    expect(webhookAddress()).toBe(
      'https://taskflow.vercel.app/api/google/webhook'
    );
  });

  it('returns null when no public URL is known (pull-only mode)', () => {
    expect(webhookAddress()).toBeNull();
  });
});

describe('parseWebhookHeaders', () => {
  const base = {
    'x-goog-channel-id': 'chan-1',
    'x-goog-resource-id': 'res-1',
    'x-goog-resource-state': 'exists',
    'x-goog-channel-token': 'secret-token',
    'x-goog-message-number': '17',
  };

  it('parses a full notification header set', () => {
    expect(parseWebhookHeaders(base)).toEqual({
      channelId: 'chan-1',
      resourceId: 'res-1',
      state: 'exists',
      token: 'secret-token',
      messageNumber: 17,
    });
  });

  it('returns null when the channel id is missing', () => {
    const headers = { ...base } as Record<string, string>;
    delete headers['x-goog-channel-id'];
    expect(parseWebhookHeaders(headers)).toBeNull();
  });

  it('returns null when the resource id is missing', () => {
    const headers = { ...base } as Record<string, string>;
    delete headers['x-goog-resource-id'];
    expect(parseWebhookHeaders(headers)).toBeNull();
  });

  it('tolerates absent optional headers and bad message numbers', () => {
    expect(
      parseWebhookHeaders({
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-message-number': 'NaN-ish',
      })
    ).toEqual({
      channelId: 'chan-1',
      resourceId: 'res-1',
      state: null,
      token: null,
      messageNumber: null,
    });
  });

  it('takes the first value of array headers', () => {
    expect(
      parseWebhookHeaders({
        'x-goog-channel-id': ['chan-1', 'chan-2'],
        'x-goog-resource-id': ['res-1'],
      })?.channelId
    ).toBe('chan-1');
  });
});

describe('validateChannelToken', () => {
  it('accepts the exact stored token', () => {
    expect(validateChannelToken('tok-abc', 'tok-abc')).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(validateChannelToken('tok-abd', 'tok-abc')).toBe(false);
    expect(validateChannelToken('tok-abc-longer', 'tok-abc')).toBe(false);
  });

  it('fails closed when either side is missing', () => {
    expect(validateChannelToken(undefined, 'tok-abc')).toBe(false);
    expect(validateChannelToken(null, 'tok-abc')).toBe(false);
    expect(validateChannelToken('', 'tok-abc')).toBe(false);
    expect(validateChannelToken('tok-abc', null)).toBe(false);
    expect(validateChannelToken('tok-abc', '')).toBe(false);
    expect(validateChannelToken(null, null)).toBe(false);
  });
});

describe('channelNeedsRenewal (48h window math)', () => {
  const now = new Date('2026-07-02T12:00:00Z');
  const live = {
    channelId: 'chan-1',
    channelResourceId: 'res-1',
  };

  it('renews when no channel exists at all', () => {
    expect(
      channelNeedsRenewal(
        { channelId: null, channelResourceId: null, channelExpiration: null },
        now
      )
    ).toBe(true);
  });

  it('renews when the resource id is missing (channels.stop would fail)', () => {
    expect(
      channelNeedsRenewal(
        {
          channelId: 'chan-1',
          channelResourceId: null,
          channelExpiration: new Date(now.getTime() + 7 * 86_400_000),
        },
        now
      )
    ).toBe(true);
  });

  it('renews when the expiration is unknown', () => {
    expect(channelNeedsRenewal({ ...live, channelExpiration: null }, now)).toBe(
      true
    );
  });

  it('renews an already-expired channel', () => {
    expect(
      channelNeedsRenewal(
        { ...live, channelExpiration: new Date(now.getTime() - 1000) },
        now
      )
    ).toBe(true);
  });

  it('renews exactly at the 48h boundary (inclusive)', () => {
    expect(
      channelNeedsRenewal(
        {
          ...live,
          channelExpiration: new Date(now.getTime() + RENEWAL_WINDOW_MS),
        },
        now
      )
    ).toBe(true);
  });

  it('keeps a channel expiring just beyond the window', () => {
    expect(
      channelNeedsRenewal(
        {
          ...live,
          channelExpiration: new Date(now.getTime() + RENEWAL_WINDOW_MS + 1),
        },
        now
      )
    ).toBe(false);
  });

  it('keeps a fresh 7-day channel', () => {
    expect(
      channelNeedsRenewal(
        {
          ...live,
          channelExpiration: new Date(
            now.getTime() + CHANNEL_TTL_SECONDS * 1000
          ),
        },
        now
      )
    ).toBe(false);
  });
});
