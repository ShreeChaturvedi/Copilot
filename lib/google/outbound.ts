/**
 * App-side write capture (plan §2, M2): EventService create/update/delete on
 * a Google-linked calendar enqueue google_sync_ops rows transactionally with
 * the local write. This module is intentionally light — database + pure
 * mapping only — so importing it from EventService costs nothing for users
 * without Google sync; the drain (which pulls in the OAuth stack) is loaded
 * lazily and fired-and-forgotten.
 *
 * Decision inputs are fetched in ONE query per write:
 *  - create: is the target calendar linked (link + account syncEnabled)?
 *  - update/delete: is the row Google-mapped, or its calendar linked?
 * Unlinked events take the exact pre-M2 code path (no transaction, no ops).
 */
import { query, type SqlClient } from '../config/database.js';
import { appEventToGoogle, type AppEventFields } from './mapping.js';
import { instanceExceptionsOf } from './merge.js';
import {
  deletePendingUpsertOps,
  enqueueDeleteOp,
  enqueueInsertOp,
  enqueuePatchOp,
  upsertTombstone,
} from './syncRepo.js';

/** Sync target for a to-be-created event (link lookup by calendar). */
export interface OutboundLinkTarget {
  googleCalendarId: string;
  timezone: string;
}

/** Sync target for an existing event row (mapping + link in one read). */
export interface OutboundTarget {
  userId: string;
  calendarId: string;
  googleEventId: string | null;
  googleCalendarId: string | null;
  googleEtag: string | null;
  linkGoogleCalendarId: string | null;
  timezone: string;
}

/** Event row shape the capture functions need (RETURNING * superset). */
export interface OutboundEventRow {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date | string;
  end: Date | string;
  allDay: boolean;
  recurrence: string | null;
  exceptions: string[] | null;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  googleEtag?: string | null;
  googleSyncSnapshot?: unknown;
}

/**
 * Link target for a calendar (enabled link + enabled account), or null.
 * Null means the caller must take the plain, hook-free write path.
 */
export async function getLinkTargetForCalendar(
  calendarId: string,
  userId: string,
  db?: SqlClient
): Promise<OutboundLinkTarget | null> {
  try {
    const res = await query<OutboundLinkTarget>(
      `SELECT l."googleCalendarId", COALESCE(p.timezone, 'UTC') AS timezone
       FROM google_calendar_links l
       JOIN google_accounts a ON a."userId" = l."userId" AND a."syncEnabled"
       LEFT JOIN user_profiles p ON p."userId" = l."userId"
       WHERE l."appCalendarId" = $1 AND l."userId" = $2 AND l."syncEnabled"`,
      [calendarId, userId],
      db
    );
    return res?.rows?.[0] ?? null;
  } catch {
    // Fail open to the plain path: an event write must never break because
    // the sync tables are unreachable (plan §8: never block CRUD on Google).
    return null;
  }
}

/** Mapping/link state of an existing event row, or null when row missing. */
export async function getOutboundTarget(
  eventId: string,
  db?: SqlClient
): Promise<OutboundTarget | null> {
  try {
    const res = await query<OutboundTarget>(
      `SELECT e."userId", e."calendarId", e."googleEventId",
              e."googleCalendarId", e."googleEtag",
              l."googleCalendarId" AS "linkGoogleCalendarId",
              COALESCE(p.timezone, 'UTC') AS timezone
       FROM events e
       LEFT JOIN google_calendar_links l
         ON l."appCalendarId" = e."calendarId" AND l."syncEnabled"
        AND EXISTS (
          SELECT 1 FROM google_accounts a
          WHERE a."userId" = l."userId" AND a."syncEnabled"
        )
       LEFT JOIN user_profiles p ON p."userId" = e."userId"
       WHERE e.id = $1`,
      [eventId],
      db
    );
    return res?.rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/** True when a write to this row must go through the transactional hook. */
export function targetIsSynced(target: OutboundTarget | null): boolean {
  return !!target && !!(target.googleEventId || target.linkGoogleCalendarId);
}

function rowToAppFields(row: OutboundEventRow): AppEventFields {
  // Instance-derived exclusions (snapshot.instanceExceptions) exist on
  // Google as override/cancelled INSTANCES, not EXDATE lines: emitting an
  // EXDATE for one would cancel the override there, so they never enter an
  // outbound payload.
  const instance = instanceExceptionsOf(row.googleSyncSnapshot);
  const exceptions = (row.exceptions ?? []).filter(
    (e) => !instance.includes(e)
  );
  return {
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    start: row.start instanceof Date ? row.start : new Date(row.start),
    end: row.end instanceof Date ? row.end : new Date(row.end),
    allDay: !!row.allDay,
    recurrence: row.recurrence ?? null,
    exceptions,
  };
}

/** Enqueue the outbound insert for a freshly created row (same tx). */
export async function captureEventInsert(
  db: SqlClient,
  row: OutboundEventRow,
  target: OutboundLinkTarget
): Promise<void> {
  const payload = appEventToGoogle(rowToAppFields(row), target.timezone);
  await enqueueInsertOp(db, {
    userId: row.userId,
    eventId: row.id,
    googleCalendarId: target.googleCalendarId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

/**
 * Enqueue the outbound write for an updated row (same tx): a patch when the
 * row is already mapped, otherwise an insert (event moved onto — or created
 * on — a linked calendar before its first push). Coalesces per event.
 */
export async function captureEventUpdate(
  db: SqlClient,
  row: OutboundEventRow,
  target: OutboundTarget
): Promise<void> {
  const payload = appEventToGoogle(
    rowToAppFields(row),
    target.timezone
  ) as unknown as Record<string, unknown>;
  if (row.googleEventId) {
    await enqueuePatchOp(db, {
      userId: row.userId,
      eventId: row.id,
      googleCalendarId: row.googleCalendarId ?? target.linkGoogleCalendarId!,
      googleEventId: row.googleEventId,
      payload,
      ifMatchEtag: row.googleEtag ?? null,
    });
  } else if (target.linkGoogleCalendarId) {
    await enqueueInsertOp(db, {
      userId: row.userId,
      eventId: row.id,
      googleCalendarId: target.linkGoogleCalendarId,
      payload,
    });
  }
}

/**
 * Delete a synced row transactionally with its outbound bookkeeping: the row
 * dies, pending insert/patch ops are cancelled, and (when mapped) a tombstone
 * plus a delete op are written so the Google copy follows (plan §2). Returns
 * the number of event rows deleted.
 */
export async function captureEventDelete(
  db: SqlClient,
  eventId: string,
  target: OutboundTarget
): Promise<number> {
  const res = await query('DELETE FROM events WHERE id = $1', [eventId], db);
  await deletePendingUpsertOps(db, target.userId, eventId);
  if (target.googleEventId) {
    const googleCalendarId =
      target.googleCalendarId ?? target.linkGoogleCalendarId!;
    await upsertTombstone(db, {
      userId: target.userId,
      googleCalendarId,
      googleEventId: target.googleEventId,
    });
    await enqueueDeleteOp(db, {
      userId: target.userId,
      googleCalendarId,
      googleEventId: target.googleEventId,
      ifMatchEtag: target.googleEtag,
    });
  }
  return res.rowCount ?? 0;
}

/**
 * Fire-and-forget drain after a committed write. Lazy-imports the drain so
 * the OAuth/client stack never loads for unlinked writes; failures are
 * swallowed (the sync cycle is the durable retry layer). In tests without
 * GOOGLE_* env the drain exits before touching anything.
 */
export function scheduleOutboundDrain(userId: string): void {
  void import('./outbox.js')
    .then(({ drainAfterWrite }) => drainAfterWrite(userId))
    .catch((error) => {
      console.warn(
        'Google outbound drain failed (sync cycle will retry):',
        error instanceof Error ? error.message : error
      );
    });
}
