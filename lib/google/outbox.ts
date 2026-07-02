/**
 * Outbox drain: pushes pending google_sync_ops to Google (plan §2, M2).
 *
 * Ops are claimed with a short nextAttemptAt bump (no row locks held across
 * network calls), executed oldest-first per calendar, and removed with a
 * guarded delete so a coalesce that refreshed the op mid-flight wins.
 *
 * Error policy per op:
 *  - 412 (EtagMismatch): Google changed concurrently. Drop the op; the next
 *    inbound pull runs the three-way merge, which re-enqueues the app-side
 *    fields only if they win (plan §2/§5). Delete-op 412 keeps the tombstone
 *    so the pull's edit-vs-delete rules decide.
 *  - 404/410 on patch: the event is gone on Google. Drop the op; the pull's
 *    cancelled item resolves edit-vs-delete (app-newer edits re-insert).
 *  - 404/410 on delete: already gone — success. Tombstone cleared.
 *  - 401/invalid_grant: mark needsReauth, abort the drain (rethrown).
 *  - 403/429 rate limits: backoff the op, abort the drain (retry next cycle).
 *  - 5xx / network: backoff the op, continue with the next one.
 *  - other 4xx (bad payload): unretryable — drop the op, log loudly.
 */
import {
  EtagMismatchError,
  GoogleApiError,
  RateLimitedError,
  ReauthRequiredError,
} from './types.js';
import type { GoogleCalendarClient } from './GoogleCalendarClient.js';
import type { GCalEvent, GCalEventInput } from './types.js';
import { FetchGoogleCalendarClient } from './GoogleCalendarClient.js';
import {
  accessTokenProviderFor,
  isGoogleSyncConfigured,
  isInvalidGrantError,
} from './googleAuth.js';
import { decryptToken } from './crypto.js';
import { pool } from '../config/database.js';
import * as repo from './syncRepo.js';
import type { SyncOpRow } from './syncRepo.js';

export interface DrainStats {
  /** Ops that were due when the drain started. */
  due: number;
  /** Successful Google writes (insert/patch/delete, incl. already-gone). */
  succeeded: number;
  /** 412s dropped for the next pull's merge to resolve. */
  conflicts: number;
  /** Ops dropped as moot (row gone, 404 on patch, unretryable payload). */
  dropped: number;
  /** Ops left in the outbox with a backoff (retryable failures). */
  retried: number;
}

export function emptyDrainStats(): DrainStats {
  return { due: 0, succeeded: 0, conflicts: 0, dropped: 0, retried: 0 };
}

export function combineDrainStats(
  a: DrainStats | undefined,
  b: DrainStats
): DrainStats {
  if (!a) return b;
  return {
    due: a.due + b.due,
    succeeded: a.succeeded + b.succeeded,
    conflicts: a.conflicts + b.conflicts,
    dropped: a.dropped + b.dropped,
    retried: a.retried + b.retried,
  };
}

type OpOutcome = 'succeeded' | 'conflict' | 'dropped' | 'retried' | 'skipped';

function isGoneError(error: unknown): boolean {
  // 404 not found, and 410 "Resource has been deleted" (Google returns 410
  // when deleting an already-cancelled event; the client maps any 410 to
  // SyncTokenGoneError, so check the status on the base class).
  return (
    error instanceof GoogleApiError &&
    (error.status === 404 || error.status === 410)
  );
}

/**
 * Drain every due op of one user, oldest-first per calendar. Throws
 * ReauthRequiredError (after marking the account) when the grant is dead;
 * everything else is absorbed into per-op retry state.
 */
export async function drainUserOps(
  client: GoogleCalendarClient,
  userId: string
): Promise<DrainStats> {
  const stats = emptyDrainStats();
  const dueIds = await repo.listDueOpIds(userId);
  stats.due = dueIds.length;

  for (const opId of dueIds) {
    const op = await repo.claimOp(opId);
    if (!op) continue; // another drain claimed it

    let outcome: OpOutcome;
    let rateLimited = false;
    try {
      outcome = await executeOp(client, op);
    } catch (error) {
      outcome = await handleOpError(userId, op, error);
      rateLimited = error instanceof RateLimitedError;
    }
    if (outcome === 'conflict') stats.conflicts++;
    else if (outcome !== 'skipped') stats[outcome]++;
    if (rateLimited) break; // stop hammering; the next cycle continues
  }
  return stats;
}

async function executeOp(
  client: GoogleCalendarClient,
  op: SyncOpRow
): Promise<OpOutcome> {
  switch (op.op) {
    case 'insert':
      return executeInsert(client, op);
    case 'patch':
      return executePatch(client, op);
    case 'delete':
      return executeDelete(client, op);
    default:
      console.error(`Unknown google_sync_ops op kind: ${op.op}`);
      await repo.deleteClaimedOp(pool, op);
      return 'dropped';
  }
}

async function executeInsert(
  client: GoogleCalendarClient,
  op: SyncOpRow
): Promise<OpOutcome> {
  if (!op.eventId || !op.payload) {
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  const row = await repo.getEventCore(op.eventId);
  if (!row) {
    // Deleted locally before the insert ran: nothing exists on Google.
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  if (row.googleEventId) {
    // Row got mapped while this op sat in the queue (e.g. an edit coalesced
    // into a claimed insert). Deliver the payload as a patch so the edit is
    // not lost.
    const g = await client.patchEvent(
      op.googleCalendarId,
      row.googleEventId,
      op.payload as Partial<GCalEventInput>,
      row.googleEtag ?? undefined
    );
    await finishUpsert(op, () =>
      repo.markEventPatched(pool, {
        eventId: op.eventId!,
        etag: g.etag,
        googleUpdatedAt: updatedOf(g),
      })
    );
    return 'succeeded';
  }

  const g = await client.insertEvent(
    op.googleCalendarId,
    op.payload as GCalEventInput
  );
  const marked = await repo.markEventInserted(pool, {
    eventId: op.eventId,
    googleEventId: g.id,
    googleCalendarId: op.googleCalendarId,
    etag: g.etag,
    googleUpdatedAt: updatedOf(g),
  });
  if (!marked) {
    // Row vanished between the API call and the bookkeeping write: the app
    // deleted it. Compensate so Google does not keep an orphan.
    await repo.upsertTombstone(pool, {
      userId: op.userId,
      googleCalendarId: op.googleCalendarId,
      googleEventId: g.id,
    });
    await repo.enqueueDeleteOp(pool, {
      userId: op.userId,
      googleCalendarId: op.googleCalendarId,
      googleEventId: g.id,
      ifMatchEtag: g.etag,
    });
  }
  await repo.deleteClaimedOp(pool, op);
  return 'succeeded';
}

async function executePatch(
  client: GoogleCalendarClient,
  op: SyncOpRow
): Promise<OpOutcome> {
  if (!op.eventId || !op.googleEventId || !op.payload) {
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  const row = await repo.getEventCore(op.eventId);
  if (!row) {
    // Row deleted locally since; the delete hook enqueued the Google delete.
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  try {
    const g = await client.patchEvent(
      op.googleCalendarId,
      op.googleEventId,
      op.payload as Partial<GCalEventInput>,
      op.ifMatchEtag ?? undefined
    );
    await finishUpsert(op, () =>
      repo.markEventPatched(pool, {
        eventId: op.eventId!,
        etag: g.etag,
        googleUpdatedAt: updatedOf(g),
      })
    );
    return 'succeeded';
  } catch (error) {
    if (error instanceof EtagMismatchError) {
      // Concurrent Google change: drop and let the next pull's three-way
      // merge decide; app-winning fields get re-enqueued there (plan §2).
      await repo.deleteClaimedOp(pool, op);
      return 'conflict';
    }
    if (isGoneError(error)) {
      // Deleted on Google while we edited: the pull's cancelled item runs
      // the edit-vs-delete rules (may re-insert the app's version as new).
      await repo.deleteClaimedOp(pool, op);
      return 'dropped';
    }
    throw error;
  }
}

async function executeDelete(
  client: GoogleCalendarClient,
  op: SyncOpRow
): Promise<OpOutcome> {
  if (!op.googleEventId) {
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  try {
    await client.deleteEvent(
      op.googleCalendarId,
      op.googleEventId,
      op.ifMatchEtag ?? undefined
    );
  } catch (error) {
    if (error instanceof EtagMismatchError) {
      // Google edited the event after our local delete. Keep the tombstone:
      // the pull compares Google `updated` vs the tombstone's deletedAt and
      // either resurrects locally or re-enqueues this delete with the fresh
      // etag (plan §5).
      await repo.deleteClaimedOp(pool, op);
      return 'conflict';
    }
    if (!isGoneError(error)) throw error;
    // 404/410: already gone on Google — same as success.
  }
  await repo.withTransaction(async (tx) => {
    await repo.deleteClaimedOp(tx, op);
    await repo.deleteTombstone(tx, op.userId, op.googleEventId!);
  });
  return 'succeeded';
}

/** Bookkeeping + guarded op removal in one transaction (event -> op order). */
async function finishUpsert(
  op: SyncOpRow,
  mark: () => Promise<boolean>
): Promise<void> {
  await mark();
  await repo.deleteClaimedOp(pool, op);
}

function updatedOf(g: GCalEvent): Date | null {
  return g.updated ? new Date(g.updated) : null;
}

async function handleOpError(
  userId: string,
  op: SyncOpRow,
  error: unknown
): Promise<OpOutcome> {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
    await repo.recordOpFailure(op, message);
    await repo.markAccountNeedsReauth(userId, message);
    throw error;
  }
  if (error instanceof RateLimitedError) {
    await repo.recordOpFailure(op, message);
    return 'retried';
  }
  if (
    error instanceof GoogleApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 404 &&
    error.status !== 410 &&
    error.status !== 412
  ) {
    // Unretryable request problem (e.g. 400 bad payload): retrying cannot
    // help; drop it so the outbox never wedges.
    console.error(
      `Dropping unretryable google_sync_op ${op.id} (${op.op}): ${message}`
    );
    await repo.deleteClaimedOp(pool, op);
    return 'dropped';
  }
  // 5xx / network / unexpected: durable backoff, keep going.
  await repo.recordOpFailure(op, message);
  return 'retried';
}

/**
 * Best-effort drain right after an app write (called fire-and-forget from
 * the EventService hooks). Silently no-ops when sync is not configured, the
 * user has no healthy Google connection, or the token cannot be decrypted.
 */
export async function drainAfterWrite(
  userId: string
): Promise<DrainStats | null> {
  if (!isGoogleSyncConfigured()) return null;
  const account = await repo.getAccount(userId);
  if (!account || !account.syncEnabled || account.needsReauth) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptToken(account.refreshTokenEnc);
  } catch {
    await repo.markAccountNeedsReauth(
      userId,
      'Stored token could not be decrypted'
    );
    return null;
  }
  const client = new FetchGoogleCalendarClient(
    accessTokenProviderFor(refreshToken)
  );
  try {
    return await drainUserOps(client, userId);
  } catch (error) {
    if (error instanceof ReauthRequiredError || isInvalidGrantError(error)) {
      return null; // account already flagged by drainUserOps
    }
    throw error;
  }
}
