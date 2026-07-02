/**
 * Push-channel lifecycle for Google Calendar events.watch (plan §3, M3).
 *
 * Channels are per calendar link: a uuid channel id plus a random per-channel
 * secret (echoed back by Google in X-Goog-Channel-Token) are minted at watch
 * time and persisted on google_calendar_links. Calendar channels live at most
 * 7 days and are NOT auto-renewed, so the daily renewal cron (and the 15-min
 * reconciliation sweep as a safety net) re-watches anything expiring within
 * 48h — new channel first, then channels.stop on the old one, so there is no
 * notification gap.
 *
 * Webhook notifications carry no event data: everything is in headers and
 * the body is empty. The handler validates the channel token and triggers an
 * incremental sync of the affected link (see googleApi.handleWebhook).
 */
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { GoogleCalendarClient } from './GoogleCalendarClient.js';
import * as repo from './syncRepo.js';
import type { CalendarLinkRow } from './syncRepo.js';

/** Calendar API channel TTL: 604800s (7 days) is both the default and max. */
export const CHANNEL_TTL_SECONDS = 604_800;

/** Channels expiring within this window get re-watched (plan §3). */
export const RENEWAL_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Public HTTPS address Google pushes to. Explicit GOOGLE_WEBHOOK_URL wins;
 * on Vercel the production domain is derived. Null (e.g. local dev without a
 * tunnel) disables watch — pull sync still converges.
 */
export function webhookAddress(): string | null {
  const explicit = process.env.GOOGLE_WEBHOOK_URL;
  if (explicit) return explicit;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (host) return `https://${host}/api/google/webhook`;
  return null;
}

/** Parsed X-Goog-* notification headers (the POST body is always empty). */
export interface WebhookHeaders {
  channelId: string;
  resourceId: string;
  /** 'sync' (first ping after watch) | 'exists' | 'not_exists'. */
  state: string | null;
  token: string | null;
  messageNumber: number | null;
}

function headerValue(
  headers: IncomingHttpHeaders,
  name: string
): string | null {
  const value = headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Extract the channel headers of a push notification. Returns null when the
 * required ids are missing — such a request cannot have come from Google.
 */
export function parseWebhookHeaders(
  headers: IncomingHttpHeaders
): WebhookHeaders | null {
  const channelId = headerValue(headers, 'x-goog-channel-id');
  const resourceId = headerValue(headers, 'x-goog-resource-id');
  if (!channelId || !resourceId) return null;
  const rawNumber = headerValue(headers, 'x-goog-message-number');
  const messageNumber = rawNumber === null ? NaN : Number(rawNumber);
  return {
    channelId,
    resourceId,
    state: headerValue(headers, 'x-goog-resource-state'),
    token: headerValue(headers, 'x-goog-channel-token'),
    messageNumber: Number.isFinite(messageNumber) ? messageNumber : null,
  };
}

/**
 * Constant-time comparison of the presented X-Goog-Channel-Token against the
 * per-channel secret stored at watch time. Fails closed when either is unset.
 */
export function validateChannelToken(
  presented: string | null | undefined,
  stored: string | null | undefined
): boolean {
  if (!presented || !stored) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the link has no live channel or it expires within 48h. */
export function channelNeedsRenewal(
  link: Pick<
    CalendarLinkRow,
    'channelId' | 'channelResourceId' | 'channelExpiration'
  >,
  now: Date = new Date()
): boolean {
  if (!link.channelId || !link.channelResourceId) return true;
  if (!link.channelExpiration) return true;
  return link.channelExpiration.getTime() <= now.getTime() + RENEWAL_WINDOW_MS;
}

export type EnsureChannelResult = 'kept' | 'created' | 'renewed';

/**
 * Make sure the link has a channel with more than 48h of life left. Renewal
 * order per plan §3: watch the NEW channel first, persist it, then stop the
 * old one — no notification gap; pings from an unstoppable old channel no
 * longer match the stored channelId and are ignored by the webhook.
 *
 * Throws when events.watch fails; callers treat that as non-fatal (the
 * 15-min pull reconciliation converges without channels).
 */
export async function ensureChannel(
  client: GoogleCalendarClient,
  link: CalendarLinkRow,
  address: string,
  now: Date = new Date()
): Promise<EnsureChannelResult> {
  if (!channelNeedsRenewal(link, now)) return 'kept';

  const channelId = randomUUID();
  const channelToken = randomBytes(32).toString('base64url');
  const response = await client.watchEvents(link.googleCalendarId, {
    id: channelId,
    type: 'web_hook',
    address,
    token: channelToken,
    params: { ttl: String(CHANNEL_TTL_SECONDS) },
  });

  const expirationMs = Number(response.expiration);
  await repo.setLinkChannel(link.id, {
    channelId: response.id || channelId,
    channelResourceId: response.resourceId,
    channelExpiration: Number.isFinite(expirationMs)
      ? new Date(expirationMs)
      : new Date(now.getTime() + CHANNEL_TTL_SECONDS * 1000),
    channelToken,
  });

  const hadChannel = !!(link.channelId && link.channelResourceId);
  if (hadChannel) {
    try {
      await client.stopChannel(link.channelId!, link.channelResourceId!);
    } catch (error) {
      // Best-effort: an unstoppable old channel expires on its own within 7
      // days and its pings are ignored (channelId no longer matches).
      console.warn(
        `channels.stop failed for old channel ${link.channelId} (non-fatal):`,
        error
      );
    }
  }
  return hadChannel ? 'renewed' : 'created';
}
