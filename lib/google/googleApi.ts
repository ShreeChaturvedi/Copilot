/**
 * Transport-agnostic implementations of the /api/google/* endpoints (M1
 * subset of plan §3/§6): status, connect (auth URL + code exchange),
 * calendars list, link/import, pull sync, disconnect.
 *
 * Both the serverless function (api/google/[...route].ts) and the dev-server
 * mirror (scripts/dev-server.ts) call these, so behavior stays identical.
 * Failures throw ApiError so the shared error middleware shapes responses.
 */
import { timingSafeEqual } from 'node:crypto';
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
import * as repo from './syncRepo.js';
import { query } from '../config/database.js';

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

/**
 * Constant-time bearer comparison against GOOGLE_SYNC_CRON_SECRET (the
 * GitHub Actions reconciliation cron's credential).
 */
export function isCronRequest(authorization: string | undefined): boolean {
  const secret = process.env.GOOGLE_SYNC_CRON_SECRET;
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const presented = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
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
    };
  }
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
  googleCalendarId = 'primary'
): Promise<{ status: GoogleStatus; stats: SyncStats }> {
  requireConfigured();
  const account = await requireAccount(userId);
  const client = await clientForAccount(account);

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

  try {
    const stats = await googleSyncService.syncCalendar(client, link);
    return { status: await getStatus(userId), stats };
  } catch (error) {
    return handleGoogleFailure(userId, error);
  }
}

export interface UserSyncResult {
  userId: string;
  links: Array<{
    linkId: string;
    googleCalendarId: string;
    stats?: SyncStats;
    error?: string;
  }>;
}

/**
 * POST /api/google/sync (JWT mode) — pull-sync every enabled link of one
 * user. M2 will drain the google_sync_ops outbox here before pulling.
 */
export async function syncUser(userId: string): Promise<UserSyncResult> {
  requireConfigured();
  const account = await requireAccount(userId);
  if (account.needsReauth) {
    throw new ApiError(
      409,
      'GOOGLE_REAUTH_REQUIRED',
      'Google connection needs to be re-authorized'
    );
  }
  const client = await clientForAccount(account);
  const links = await repo.getLinksForUser(userId);
  const result: UserSyncResult = { userId, links: [] };

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
        break; // remaining links share the dead grant
      }
    }
  }
  return result;
}

/**
 * POST /api/google/sync (cron mode) — reconciliation across all users
 * (GitHub Actions 15-min pull). Self-budgets so a serverless timeout never
 * kills a run mid-user; the next tick continues (plan §8).
 */
export async function syncAllUsers(
  budgetMs = 45_000
): Promise<{ usersSynced: number; usersFailed: number; skipped: number }> {
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
      const result = await syncUser(userId);
      if (result.links.some((l) => l.error)) usersFailed++;
      else usersSynced++;
    } catch (error) {
      usersFailed++;
      console.error(`Cron sync failed for user ${userId}:`, error);
    }
  }
  return { usersSynced, usersFailed, skipped };
}

/**
 * POST /api/google/disconnect — revoke + forget the Google connection.
 * Imported events stay by default (mapping columns stripped); pass
 * removeImportedEvents to delete them. Push channels (M3) are stopped
 * best-effort when present.
 */
export async function disconnect(
  userId: string,
  removeImportedEvents = false
): Promise<{ removedEvents: number; unmappedEvents: number }> {
  const account = await requireAccount(userId);

  // Best-effort revoke; a fail-closed decrypt must not block disconnect.
  try {
    await revokeGoogleToken(decryptToken(account.refreshTokenEnc));
  } catch {
    // token unreadable; nothing to revoke
  }

  // M3 channels: stop any live ones so Google stops pinging.
  const links = await repo.getLinksForUser(userId);
  for (const link of links) {
    if (link.channelId && link.channelResourceId) {
      try {
        const client = await clientForAccount(account);
        await client.stopChannel(link.channelId, link.channelResourceId);
      } catch {
        // channel will expire on its own
      }
    }
  }

  let removedEvents = 0;
  let unmappedEvents = 0;
  if (removeImportedEvents) {
    removedEvents = await repo.deleteImportedEventsForUser(userId);
  }
  unmappedEvents = await repo.unmapEventsForUser(userId);
  await repo.deleteLinksForUser(userId);
  await repo.deleteAccount(userId);
  return { removedEvents, unmappedEvents };
}
