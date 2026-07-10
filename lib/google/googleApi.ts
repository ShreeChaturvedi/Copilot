/**
 * Transport-agnostic implementations of the /api/google/* endpoints (plan
 * §3/§6): status, connect (auth URL + code exchange), calendars list,
 * link/import, pull sync, disconnect, plus the M3 push surface — webhook
 * notification handling and the daily channel-renewal cron.
 *
 * Both the serverless function (api/google/[...route].ts) and the dev-server
 * mirror (scripts/dev-server.ts) call these, so behavior stays identical.
 * Failures throw ApiError so the shared error middleware shapes responses.
 *
 * Google-touching functions accept an injectable client factory (defaulting
 * to the real fetch client) so the integration suite can drive the full
 * endpoint logic with FakeGoogleCalendarClient.
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { ApiError } from '../types/api.js';
import {
  decryptToken,
  encryptToken,
  TokenCryptoConfigError,
  TokenDecryptError,
} from './crypto.js';
import {
  accessTokenProviderFor,
  buildConnectAuthUrl,
  exchangeConnectCode,
  isGoogleSyncConfigured,
  isInvalidGrantError,
  resolveRedirectUri,
  revokeGoogleToken,
  RedirectUriNotAllowedError,
} from './googleAuth.js';
import {
  FetchGoogleCalendarClient,
  type GoogleCalendarClient,
} from './GoogleCalendarClient.js';
import { GoogleApiError, ReauthRequiredError } from './types.js';
import { googleSyncService, type SyncStats } from './GoogleSyncService.js';
import { combineDrainStats, drainUserOps, type DrainStats } from './outbox.js';
import {
  channelNeedsRenewal,
  ensureChannel,
  parseWebhookHeaders,
  validateChannelToken,
  webhookAddress,
  RENEWAL_WINDOW_MS,
  type EnsureChannelResult,
} from './channels.js';
import * as repo from './syncRepo.js';
import { query } from '../config/database.js';

/**
 * Builds the authenticated Calendar client for an account. The default is
 * the real fetch client; integration tests inject a Fake-backed factory.
 */
export type GoogleClientFactory = (
  account: repo.GoogleAccountRow
) => Promise<GoogleCalendarClient>;

export interface GoogleLinkStatus {
  id: string;
  googleCalendarId: string;
  appCalendarId: string;
  appCalendarName: string | null;
  syncEnabled: boolean;
  /** True once the initial full import completed (a sync token is stored). */
  hasSyncToken: boolean;
  lastFullSyncAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  needsReauth: boolean;
  syncEnabled: boolean;
  connectedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  links: GoogleLinkStatus[];
  /** Outbound (write-back) queue depth for the user. */
  pendingOutbound: number;
  /** Oldest persisted outbound-op error, or null when the queue is healthy. */
  outboundError: string | null;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  linked: boolean;
  appCalendarId: string | null;
}

function requireConfigured(): void {
  if (!isGoogleSyncConfigured()) {
    throw new ApiError(
      503,
      'GOOGLE_SYNC_NOT_CONFIGURED',
      'Google Calendar sync is not configured on this server'
    );
  }
}

/**
 * Build an authenticated Calendar client for a connected user. Fail-closed
 * decrypt marks the account needsReauth (plan §1).
 */
async function clientForAccount(
  account: repo.GoogleAccountRow
): Promise<GoogleCalendarClient> {
  let refreshToken: string;
  try {
    refreshToken = decryptToken(account.refreshTokenEnc);
  } catch (error) {
    if (error instanceof TokenDecryptError) {
      await repo.markAccountNeedsReauth(
        account.userId,
        'Stored token could not be decrypted'
      );
      throw new ApiError(
        409,
        'GOOGLE_REAUTH_REQUIRED',
        'Google connection needs to be re-authorized'
      );
    }
    if (error instanceof TokenCryptoConfigError) {
      throw new ApiError(503, 'GOOGLE_SYNC_NOT_CONFIGURED', error.message);
    }
    throw error;
  }
  return new FetchGoogleCalendarClient(accessTokenProviderFor(refreshToken));
}

async function requireAccount(userId: string): Promise<repo.GoogleAccountRow> {
  const account = await repo.getAccount(userId);
  if (!account) {
    throw new ApiError(
      404,
      'GOOGLE_NOT_CONNECTED',
      'No Google account is connected'
    );
  }
  return account;
}

/** Map dead-grant failures to needsReauth + a stable API error. */
async function handleGoogleFailure(
  userId: string,
  error: unknown
): Promise<never> {
  if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
    await repo.markAccountNeedsReauth(
      userId,
      error instanceof Error ? error.message : String(error)
    );
    throw new ApiError(
      409,
      'GOOGLE_REAUTH_REQUIRED',
      'Google connection needs to be re-authorized'
    );
  }
  throw error;
}

/** Constant-time bearer comparison. False when the secret is unset. */
function bearerMatches(
  authorization: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const presented = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
}

/**
 * POST /api/google/sync cron mode: bearer must match GOOGLE_SYNC_CRON_SECRET
 * (the GitHub Actions reconciliation cron's credential).
 */
export function isCronRequest(authorization: string | undefined): boolean {
  return bearerMatches(authorization, process.env.GOOGLE_SYNC_CRON_SECRET);
}

/**
 * GET /api/google/cron/renew credential: Vercel attaches `Bearer $CRON_SECRET`
 * to cron invocations automatically. The GH-Actions reconciliation secret is
 * accepted too so the owner can trigger a renewal sweep manually.
 */
export function isRenewCronRequest(authorization: string | undefined): boolean {
  return (
    bearerMatches(authorization, process.env.CRON_SECRET) ||
    isCronRequest(authorization)
  );
}

// --- endpoint implementations -------------------------------------------------

export async function getStatus(userId: string): Promise<GoogleStatus> {
  const configured = isGoogleSyncConfigured();
  const account = await repo.getAccount(userId);
  if (!account) {
    return {
      configured,
      connected: false,
      email: null,
      needsReauth: false,
      syncEnabled: false,
      connectedAt: null,
      lastError: null,
      lastErrorAt: null,
      links: [],
      pendingOutbound: 0,
      outboundError: null,
    };
  }
  const outbox = await repo.getOutboxSummary(userId);
  const res = await query<GoogleLinkStatus>(
    `SELECT l.id, l."googleCalendarId", l."appCalendarId", c.name AS "appCalendarName",
            l."syncEnabled", (l."syncToken" IS NOT NULL) AS "hasSyncToken",
            l."lastFullSyncAt", l."lastSyncedAt",
            l."lastError", l."lastErrorAt"
     FROM google_calendar_links l
     LEFT JOIN calendars c ON c.id = l."appCalendarId"
     WHERE l."userId" = $1
     ORDER BY l."createdAt" ASC`,
    [userId]
  );
  return {
    configured,
    connected: true,
    email: account.email,
    needsReauth: account.needsReauth,
    syncEnabled: account.syncEnabled,
    connectedAt: account.connectedAt,
    lastError: account.lastError,
    lastErrorAt: account.lastErrorAt,
    links: res.rows,
    pendingOutbound: outbox.pending,
    outboundError: outbox.oldestError,
  };
}

/** GET /api/google/connect — consent URL for the incremental-auth dance. */
export function getConnectUrl(requestedRedirectUri?: string): {
  authUrl: string;
  redirectUri: string;
} {
  requireConfigured();
  let redirectUri: string;
  try {
    redirectUri = resolveRedirectUri(requestedRedirectUri);
  } catch (error) {
    if (error instanceof RedirectUriNotAllowedError) {
      throw new ApiError(400, 'REDIRECT_URI_NOT_ALLOWED', error.message);
    }
    throw error;
  }
  return { authUrl: buildConnectAuthUrl(redirectUri), redirectUri };
}

/**
 * POST /api/google/connect — exchange the consent code, store the encrypted
 * refresh token. Linking/import is a separate step (POST /api/google/link)
 * so the Settings panel can show the calendar list first.
 */
export async function connect(
  userId: string,
  code: string,
  requestedRedirectUri?: string
): Promise<GoogleStatus> {
  requireConfigured();
  if (!code || typeof code !== 'string') {
    throw new ApiError(
      400,
      'MISSING_AUTH_CODE',
      'Authorization code is required'
    );
  }
  let redirectUri: string;
  try {
    redirectUri = resolveRedirectUri(requestedRedirectUri);
  } catch (error) {
    if (error instanceof RedirectUriNotAllowedError) {
      throw new ApiError(400, 'REDIRECT_URI_NOT_ALLOWED', error.message);
    }
    throw error;
  }

  let exchange;
  try {
    exchange = await exchangeConnectCode(code, redirectUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'GOOGLE_CALENDAR_SCOPE_NOT_GRANTED') {
      throw new ApiError(
        400,
        'GOOGLE_CALENDAR_SCOPE_NOT_GRANTED',
        'The calendar permission was not granted; please approve calendar access'
      );
    }
    if (message === 'GOOGLE_NO_REFRESH_TOKEN') {
      throw new ApiError(
        400,
        'GOOGLE_NO_REFRESH_TOKEN',
        'Google did not return a refresh token; retry the connection'
      );
    }
    console.error('Google connect code exchange failed:', error);
    throw new ApiError(
      400,
      'GOOGLE_OAUTH_FAILED',
      'Failed to exchange the Google authorization code'
    );
  }

  await repo.upsertAccount({
    userId,
    googleUserId: exchange.googleUserId,
    email: exchange.email,
    refreshTokenEnc: encryptToken(exchange.refreshToken),
    scopes: exchange.scopes,
  });
  return getStatus(userId);
}

/**
 * GET /api/google/calendars — calendars available for linking. M1 runs with
 * only the calendar.events scope, which does NOT cover calendarList.list
 * (plan §6): when that call is denied, fall back to the primary calendar
 * resolved via calendars.get('primary') / the account email. M4 adds the
 * calendarlist.readonly scope and the full list lights up automatically.
 */
export async function listCalendars(
  userId: string
): Promise<GoogleCalendarEntry[]> {
  requireConfigured();
  const account = await requireAccount(userId);
  const client = await clientForAccount(account);
  const links = await repo.getLinksForUser(userId);
  const linkByCal = new Map(links.map((l) => [l.googleCalendarId, l]));

  const toEntry = (
    id: string,
    summary: string | undefined,
    primary: boolean
  ): GoogleCalendarEntry => ({
    id,
    summary: summary ?? id,
    primary,
    linked: linkByCal.has(id),
    appCalendarId: linkByCal.get(id)?.appCalendarId ?? null,
  });

  try {
    const entries = await client.listCalendars();
    if (entries.length > 0) {
      return entries
        .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
        .map((e) => toEntry(e.id, e.summary, !!e.primary));
    }
  } catch (error) {
    if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
      await handleGoogleFailure(userId, error);
    }
    if (!(error instanceof GoogleApiError && error.status === 403)) {
      throw error;
    }
    // 403: calendarList scope not granted (expected in M1) -> primary only.
  }

  const primaryId = await resolvePrimaryCalendarId(client, account);
  return [toEntry(primaryId, account.email ?? 'Primary calendar', true)];
}

/** Resolve 'primary' to the real calendar id (plan §1). */
async function resolvePrimaryCalendarId(
  client: GoogleCalendarClient,
  account: repo.GoogleAccountRow
): Promise<string> {
  try {
    const cal = await client.getCalendar('primary');
    return cal.id;
  } catch (error) {
    if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
      await handleGoogleFailure(account.userId, error);
    }
    // calendars.get may be denied under the narrow scope; the primary
    // calendar id of a Google account is its email.
    if (account.email) return account.email;
    throw error;
  }
}

/**
 * POST /api/google/link — link a Google calendar (default: primary) to a new
 * app calendar and run the initial full import. Idempotent: re-linking an
 * already-linked calendar just re-syncs it.
 */
export async function linkCalendar(
  userId: string,
  googleCalendarId = 'primary',
  clientFor: GoogleClientFactory = clientForAccount
): Promise<{ status: GoogleStatus; stats: SyncStats }> {
  requireConfigured();
  const account = await requireAccount(userId);
  const client = await clientFor(account);

  // Never store the 'primary' alias (plan §1).
  const realId =
    googleCalendarId === 'primary'
      ? await resolvePrimaryCalendarId(client, account)
      : googleCalendarId;

  let link = await repo.getLinkByGoogleCalendarId(userId, realId);
  if (!link) {
    let summary = realId;
    try {
      summary = (await client.getCalendar(realId)).summary ?? realId;
    } catch {
      // narrow scope may deny calendars.get; the id (email) is a fine name
    }
    const appCalendarId = await repo.createImportCalendar(userId, summary);
    link = await repo.createLink({
      userId,
      googleCalendarId: realId,
      appCalendarId,
    });
  }

  let stats: SyncStats;
  try {
    stats = await googleSyncService.syncCalendar(client, link);
  } catch (error) {
    return handleGoogleFailure(userId, error);
  }

  // M3: register the push channel. Best-effort — a watch failure must never
  // fail the link/import; the 15-min pull reconciliation still converges and
  // the renewal cron retries the watch daily.
  const address = webhookAddress();
  if (address) {
    try {
      await ensureChannel(client, link, address);
    } catch (error) {
      console.warn(
        `events.watch failed for link ${link.id} (non-fatal):`,
        error
      );
    }
  }

  return { status: await getStatus(userId), stats };
}

export interface UserSyncResult {
  userId: string;
  links: Array<{
    linkId: string;
    googleCalendarId: string;
    stats?: SyncStats;
    error?: string;
  }>;
  /** Outbox drain totals for the cycle (M2). */
  outbound?: DrainStats;
  outboundError?: string;
}

/**
 * POST /api/google/sync (JWT mode) — one full sync cycle for a user (M2):
 * drain the outbox (oldest-first), pull every enabled link, then drain once
 * more so ops enqueued by the pull's merges propagate in the same cycle.
 */
export async function syncUser(
  userId: string,
  clientFor: GoogleClientFactory = clientForAccount
): Promise<UserSyncResult> {
  requireConfigured();
  const account = await requireAccount(userId);
  if (account.needsReauth) {
    throw new ApiError(
      409,
      'GOOGLE_REAUTH_REQUIRED',
      'Google connection needs to be re-authorized'
    );
  }
  const client = await clientFor(account);
  const links = await repo.getLinksForUser(userId);
  const result: UserSyncResult = { userId, links: [] };

  const drain = async (): Promise<void> => {
    try {
      result.outbound = combineDrainStats(
        result.outbound,
        await drainUserOps(client, userId)
      );
    } catch (error) {
      // drainUserOps only throws on a dead grant (account already flagged)
      // or an unexpected internal error; both end the cycle.
      if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
        return handleGoogleFailure(userId, error);
      }
      result.outboundError =
        error instanceof Error ? error.message : String(error);
    }
  };

  await drain();

  for (const link of links) {
    if (!link.syncEnabled) continue;
    try {
      const stats = await googleSyncService.syncCalendar(client, link);
      result.links.push({
        linkId: link.id,
        googleCalendarId: link.googleCalendarId,
        stats,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.links.push({
        linkId: link.id,
        googleCalendarId: link.googleCalendarId,
        error: message,
      });
      if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
        await repo.markAccountNeedsReauth(userId, message);
        return result; // remaining links (and drain) share the dead grant
      }
    }
  }

  await drain();
  return result;
}

/**
 * POST /api/google/sync (cron mode) — reconciliation across all users
 * (GitHub Actions 15-min pull). Self-budgets so a serverless timeout never
 * kills a run mid-user; the next tick continues (plan §8). Ends with the
 * channel-renewal sweep (plan §3 safety net for the daily Vercel cron), so
 * even a dead/expired channel is re-established within one 15-min tick.
 */
export async function syncAllUsers(
  budgetMs = 45_000,
  clientFor: GoogleClientFactory = clientForAccount
): Promise<{
  usersSynced: number;
  usersFailed: number;
  skipped: number;
  channels?: ChannelRenewStats;
}> {
  requireConfigured();
  const startedAt = Date.now();
  const links = await repo.listSyncableLinks();
  const userIds = [...new Set(links.map((l) => l.userId))];

  let usersSynced = 0;
  let usersFailed = 0;
  let skipped = 0;
  for (const userId of userIds) {
    if (Date.now() - startedAt > budgetMs) {
      skipped++;
      continue;
    }
    try {
      const result = await syncUser(userId, clientFor);
      if (result.links.some((l) => l.error)) usersFailed++;
      else usersSynced++;
    } catch (error) {
      usersFailed++;
      console.error(`Cron sync failed for user ${userId}:`, error);
    }
  }

  // Renewal sweep (no drain: syncUser already drained per user above).
  let channels: ChannelRenewStats | undefined;
  try {
    channels = await renewChannels(
      {
        drainOps: false,
        budgetMs: Math.max(budgetMs - (Date.now() - startedAt), 5_000),
      },
      clientFor
    );
  } catch (error) {
    console.error('Channel renewal sweep failed (non-fatal):', error);
  }
  return { usersSynced, usersFailed, skipped, channels };
}

/**
 * POST /api/google/disconnect — revoke + forget the Google connection.
 * Imported events stay by default (mapping columns stripped); pass
 * removeImportedEvents to delete them. Push channels (M3) are stopped
 * best-effort when present.
 */
export async function disconnect(
  userId: string,
  removeImportedEvents = false,
  clientFor: GoogleClientFactory = clientForAccount
): Promise<{ removedEvents: number; unmappedEvents: number }> {
  const account = await requireAccount(userId);

  // Best-effort revoke; a fail-closed decrypt must not block disconnect.
  try {
    await revokeGoogleToken(decryptToken(account.refreshTokenEnc));
  } catch {
    // token unreadable; nothing to revoke
  }

  // M3 channels: stop any live ones so Google stops pinging. Channel columns
  // die with the link rows below. Best-effort — an unstoppable channel
  // expires within 7 days and its pings no longer match any stored channel.
  const links = await repo.getLinksForUser(userId);
  const watched = links.filter((l) => l.channelId && l.channelResourceId);
  if (watched.length > 0) {
    try {
      const client = await clientFor(account);
      for (const link of watched) {
        try {
          await client.stopChannel(link.channelId!, link.channelResourceId!);
        } catch {
          // channel will expire on its own
        }
      }
    } catch {
      // no usable client (e.g. token undecryptable); channels will expire
    }
  }

  let removedEvents = 0;
  let unmappedEvents = 0;
  if (removeImportedEvents) {
    removedEvents = await repo.deleteImportedEventsForUser(userId);
  }
  unmappedEvents = await repo.unmapEventsForUser(userId);
  await repo.deleteLinksForUser(userId);
  // Clean cutover: outbox ops and tombstones FK-cascade on users, not on the
  // google_account, so a disconnect must clear them explicitly. Otherwise a
  // reconnect + re-link replays stale ops (deleting kept Google events,
  // duplicating unmapped inserts) and stale tombstones skew edit-vs-delete.
  await repo.deleteOutboxForUser(userId);
  await repo.deleteTombstonesForUser(userId);
  await repo.deleteAccount(userId);
  return { removedEvents, unmappedEvents };
}

export interface WebhookResult {
  outcome: 'ignored' | 'acknowledged' | 'synced' | 'sync_failed';
  /** Why an 'ignored' notification was dropped (ops visibility only). */
  reason?: string;
  linkId?: string;
  stats?: SyncStats;
}

/**
 * POST /api/google/webhook (public — Google sends no auth; plan §3).
 *
 * Notifications have an empty body; everything is in X-Goog-* headers. The
 * channel id resolves the link, the per-channel token (minted at watch time)
 * authenticates the sender, and the ping itself carries no event data — any
 * non-'sync' state just triggers an incremental pull of that link.
 *
 * Error contract: only a malformed request (missing channel/resource id, so
 * demonstrably not from Google) throws (400). Everything else — unknown or
 * expired channels, token mismatches, sync failures — resolves to a 200-able
 * result: a non-2xx would make Google retry, which cannot help, and the
 * 15-min reconciliation cron is the durable convergence path. The sync runs
 * inline (an incremental pull is typically one events.list call) so a slow
 * serverless freeze-after-response cannot kill it mid-write.
 */
export async function handleWebhook(
  headers: IncomingHttpHeaders,
  clientFor: GoogleClientFactory = clientForAccount
): Promise<WebhookResult> {
  const parsed = parseWebhookHeaders(headers);
  if (!parsed) {
    throw new ApiError(
      400,
      'INVALID_WEBHOOK',
      'Missing X-Goog-Channel-ID / X-Goog-Resource-ID headers'
    );
  }
  if (!isGoogleSyncConfigured()) {
    return { outcome: 'ignored', reason: 'not_configured' };
  }

  const link = await repo.getLinkByChannelId(parsed.channelId);
  if (!link) return { outcome: 'ignored', reason: 'unknown_channel' };
  if (!validateChannelToken(parsed.token, link.channelToken)) {
    console.warn(
      `Webhook token mismatch for channel ${parsed.channelId} (link ${link.id})`
    );
    return { outcome: 'ignored', reason: 'token_mismatch' };
  }
  if (link.channelResourceId && parsed.resourceId !== link.channelResourceId) {
    return { outcome: 'ignored', reason: 'resource_mismatch' };
  }
  if (link.channelExpiration && link.channelExpiration.getTime() < Date.now()) {
    return { outcome: 'ignored', reason: 'channel_expired' };
  }

  // First ping after watch ('sync' state, message number 1): ack only.
  if (parsed.state === 'sync') {
    return { outcome: 'acknowledged', linkId: link.id };
  }
  if (!link.syncEnabled) {
    return { outcome: 'ignored', reason: 'link_disabled', linkId: link.id };
  }
  const account = await repo.getAccount(link.userId);
  if (!account || !account.syncEnabled || account.needsReauth) {
    return {
      outcome: 'ignored',
      reason: 'account_unavailable',
      linkId: link.id,
    };
  }

  try {
    const client = await clientFor(account);
    const stats = await googleSyncService.syncCalendar(client, link);
    return { outcome: 'synced', linkId: link.id, stats };
  } catch (error) {
    // syncCalendar already recorded lastError on the link; flag dead grants
    // so the Settings panel shows the reauth banner.
    try {
      await handleGoogleFailure(link.userId, error);
    } catch {
      // mapped/rethrown — the transport still answers 200 to Google
    }
    console.error(`Webhook sync failed for link ${link.id}:`, error);
    return { outcome: 'sync_failed', linkId: link.id };
  }
}

export interface ChannelRenewStats {
  /** Resolved webhook address; null disables watch entirely. */
  address: string | null;
  /** Links whose channel was missing or expiring within 48h. */
  due: number;
  created: number;
  renewed: number;
  failed: number;
  skipped: number;
  /** Opportunistic outbox drain totals (GET /api/google/cron/renew only). */
  outbound?: DrainStats;
}

/**
 * GET /api/google/cron/renew (daily Vercel cron; plan §3) — re-watch every
 * channel expiring within 48h (watch new, then stop old) and, by default,
 * opportunistically drain overdue outbox ops. Also invoked (drain off) as
 * the renewal sweep at the end of every reconciliation run.
 */
export async function renewChannels(
  opts: { drainOps?: boolean; budgetMs?: number } = {},
  clientFor: GoogleClientFactory = clientForAccount
): Promise<ChannelRenewStats> {
  requireConfigured();
  const budgetMs = opts.budgetMs ?? 45_000;
  const startedAt = Date.now();
  const address = webhookAddress();
  const stats: ChannelRenewStats = {
    address,
    due: 0,
    created: 0,
    renewed: 0,
    failed: 0,
    skipped: 0,
  };
  if (!address) return stats; // no public URL -> pull-only mode

  const due = await repo.listLinksDueForChannelRenewal(
    new Date(Date.now() + RENEWAL_WINDOW_MS)
  );
  stats.due = due.length;

  const clients = new Map<string, GoogleCalendarClient>();
  const deadUsers = new Set<string>();
  for (const link of due) {
    if (deadUsers.has(link.userId) || Date.now() - startedAt > budgetMs) {
      stats.skipped++;
      continue;
    }
    try {
      let client = clients.get(link.userId);
      if (!client) {
        const account = await repo.getAccount(link.userId);
        if (!account || !account.syncEnabled || account.needsReauth) {
          stats.skipped++;
          continue;
        }
        client = await clientFor(account);
        clients.set(link.userId, client);
      }
      const result: EnsureChannelResult = await ensureChannel(
        client,
        link,
        address
      );
      if (result === 'created') stats.created++;
      else if (result === 'renewed') stats.renewed++;
    } catch (error) {
      stats.failed++;
      console.error(`Channel renewal failed for link ${link.id}:`, error);
      if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
        await repo.markAccountNeedsReauth(
          link.userId,
          error instanceof Error ? error.message : String(error)
        );
        deadUsers.add(link.userId);
      }
    }
  }

  if (opts.drainOps !== false) {
    for (const userId of await repo.listUserIdsWithDueOps()) {
      if (Date.now() - startedAt > budgetMs) break;
      try {
        const account = await repo.getAccount(userId);
        if (!account || !account.syncEnabled || account.needsReauth) continue;
        const client = clients.get(userId) ?? (await clientFor(account));
        stats.outbound = combineDrainStats(
          stats.outbound,
          await drainUserOps(client, userId)
        );
      } catch (error) {
        console.error(`Renewal-cron drain failed for user ${userId}:`, error);
      }
    }
  }
  return stats;
}

// Re-exported so the router/tests reason about the renewal window in one place.
export { channelNeedsRenewal, webhookAddress };
