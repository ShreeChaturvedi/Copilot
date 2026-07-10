/**
 * Direct-SQL repository for the Google sync engine (plan §3).
 *
 * Deliberately bypasses EventService/CalendarService: engine writes must not
 * run app-side validation (isValidRRule rejects legitimate Google rules),
 * must set mapping columns atomically, and must not trip the M2 outbound
 * hooks (no echo loop).
 */
import type { PoolClient } from 'pg';
import { query, withTransaction, type SqlClient } from '../config/database.js';
import type { AppEventFields } from './mapping.js';

export interface GoogleAccountRow {
  userId: string;
  googleUserId: string;
  email: string | null;
  refreshTokenEnc: string;
  scopes: string;
  syncEnabled: boolean;
  needsReauth: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;
  connectedAt: Date;
  updatedAt: Date;
}

export interface CalendarLinkRow {
  id: string;
  userId: string;
  googleCalendarId: string;
  appCalendarId: string;
  syncToken: string | null;
  syncEnabled: boolean;
  lastFullSyncAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  channelId: string | null;
  channelResourceId: string | null;
  channelExpiration: Date | null;
  channelToken: string | null;
}

export interface MappedEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  recurrence: string | null;
  exceptions: string[];
  calendarId: string;
  googleEventId: string | null;
  googleEtag: string | null;
  googleUpdatedAt: Date | null;
  googleSyncSnapshot: Record<string, unknown> | null;
  updatedAt: Date;
}

export interface TombstoneRow {
  id: string;
  userId: string;
  googleCalendarId: string;
  googleEventId: string;
  deletedAt: Date;
}

export interface SyncOpRow {
  id: string;
  userId: string;
  op: 'insert' | 'patch' | 'delete';
  eventId: string | null;
  googleCalendarId: string;
  googleEventId: string | null;
  payload: Record<string, unknown> | null;
  ifMatchEtag: string | null;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
}

const LINK_COLUMNS = `id, "userId", "googleCalendarId", "appCalendarId", "syncToken",
  "syncEnabled", "lastFullSyncAt", "lastSyncedAt", "lastError", "lastErrorAt",
  "channelId", "channelResourceId", "channelExpiration", "channelToken"`;

// --- google_accounts ---------------------------------------------------------

export async function getAccount(
  userId: string
): Promise<GoogleAccountRow | null> {
  const res = await query<GoogleAccountRow>(
    'SELECT * FROM google_accounts WHERE "userId" = $1',
    [userId]
  );
  return res.rows[0] ?? null;
}

export async function upsertAccount(input: {
  userId: string;
  googleUserId: string;
  email: string | null;
  refreshTokenEnc: string;
  scopes: string;
}): Promise<void> {
  await query(
    `INSERT INTO google_accounts
       ("userId", "googleUserId", email, "refreshTokenEnc", scopes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("userId") DO UPDATE SET
       "googleUserId" = EXCLUDED."googleUserId",
       email = EXCLUDED.email,
       "refreshTokenEnc" = EXCLUDED."refreshTokenEnc",
       scopes = EXCLUDED.scopes,
       "needsReauth" = false,
       "lastError" = NULL,
       "lastErrorAt" = NULL,
       "updatedAt" = NOW()`,
    [
      input.userId,
      input.googleUserId,
      input.email,
      input.refreshTokenEnc,
      input.scopes,
    ]
  );
}

export async function markAccountNeedsReauth(
  userId: string,
  error: string
): Promise<void> {
  await query(
    `UPDATE google_accounts SET "needsReauth" = true, "lastError" = $2,
       "lastErrorAt" = NOW(), "updatedAt" = NOW()
     WHERE "userId" = $1`,
    [userId, error.slice(0, 500)]
  );
}

export async function deleteAccount(userId: string): Promise<void> {
  await query('DELETE FROM google_accounts WHERE "userId" = $1', [userId]);
}

// --- google_calendar_links ---------------------------------------------------

export async function getLinksForUser(
  userId: string
): Promise<CalendarLinkRow[]> {
  const res = await query<CalendarLinkRow>(
    `SELECT ${LINK_COLUMNS} FROM google_calendar_links
     WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
    [userId]
  );
  return res.rows;
}

export async function getLinkByGoogleCalendarId(
  userId: string,
  googleCalendarId: string
): Promise<CalendarLinkRow | null> {
  const res = await query<CalendarLinkRow>(
    `SELECT ${LINK_COLUMNS} FROM google_calendar_links
     WHERE "userId" = $1 AND "googleCalendarId" = $2`,
    [userId, googleCalendarId]
  );
  return res.rows[0] ?? null;
}

/** Every enabled link of every non-reauth account (cron mode). */
export async function listSyncableLinks(): Promise<CalendarLinkRow[]> {
  const res = await query<CalendarLinkRow>(
    `SELECT l.id, l."userId", l."googleCalendarId", l."appCalendarId",
            l."syncToken", l."syncEnabled", l."lastFullSyncAt", l."lastSyncedAt",
            l."lastError", l."lastErrorAt", l."channelId", l."channelResourceId",
            l."channelExpiration", l."channelToken"
     FROM google_calendar_links l
     JOIN google_accounts a ON a."userId" = l."userId"
     WHERE l."syncEnabled" AND a."syncEnabled" AND NOT a."needsReauth"
     ORDER BY l."lastSyncedAt" ASC NULLS FIRST`,
    []
  );
  return res.rows;
}

export async function createLink(input: {
  userId: string;
  googleCalendarId: string;
  appCalendarId: string;
}): Promise<CalendarLinkRow> {
  const res = await query<CalendarLinkRow>(
    `INSERT INTO google_calendar_links ("userId", "googleCalendarId", "appCalendarId")
     VALUES ($1, $2, $3)
     RETURNING ${LINK_COLUMNS}`,
    [input.userId, input.googleCalendarId, input.appCalendarId]
  );
  return res.rows[0];
}

export async function updateLinkSyncState(
  linkId: string,
  state: {
    syncToken?: string | null;
    lastFullSyncAt?: Date;
    lastSyncedAt?: Date;
    lastError?: string | null;
  }
): Promise<void> {
  const sets: string[] = ['"updatedAt" = NOW()'];
  const params: unknown[] = [linkId];
  if ('syncToken' in state) {
    params.push(state.syncToken);
    sets.push(`"syncToken" = $${params.length}`);
  }
  if (state.lastFullSyncAt) {
    params.push(state.lastFullSyncAt.toISOString());
    sets.push(`"lastFullSyncAt" = $${params.length}`);
  }
  if (state.lastSyncedAt) {
    params.push(state.lastSyncedAt.toISOString());
    sets.push(`"lastSyncedAt" = $${params.length}`);
  }
  if ('lastError' in state) {
    params.push(state.lastError ? state.lastError.slice(0, 500) : null);
    sets.push(`"lastError" = $${params.length}`);
    sets.push(
      state.lastError ? '"lastErrorAt" = NOW()' : '"lastErrorAt" = NULL'
    );
  }
  await query(
    `UPDATE google_calendar_links SET ${sets.join(', ')} WHERE id = $1`,
    params
  );
}

export async function deleteLinksForUser(userId: string): Promise<void> {
  await query('DELETE FROM google_calendar_links WHERE "userId" = $1', [
    userId,
  ]);
}

/**
 * Surface a permanently-dropped outbound op on its link so the existing
 * "Last sync issue" Alert fires (finding: unretryable drops were console-only,
 * leaving the two calendars silently diverged). No-ops when the link is gone.
 */
export async function recordOutboundDropOnLink(
  userId: string,
  googleCalendarId: string,
  error: string
): Promise<void> {
  await query(
    `UPDATE google_calendar_links
     SET "lastError" = $3, "lastErrorAt" = NOW(), "updatedAt" = NOW()
     WHERE "userId" = $1 AND "googleCalendarId" = $2`,
    [userId, googleCalendarId, error.slice(0, 500)]
  );
}

// --- push channels (M3) --------------------------------------------------------

/** Webhook lookup: the notification's X-Goog-Channel-ID -> link. */
export async function getLinkByChannelId(
  channelId: string
): Promise<CalendarLinkRow | null> {
  const res = await query<CalendarLinkRow>(
    `SELECT ${LINK_COLUMNS} FROM google_calendar_links WHERE "channelId" = $1`,
    [channelId]
  );
  return res.rows[0] ?? null;
}

/** Persist (or clear, with null) a link's watch-channel state atomically. */
export async function setLinkChannel(
  linkId: string,
  channel: {
    channelId: string;
    channelResourceId: string;
    channelExpiration: Date;
    channelToken: string;
  } | null
): Promise<void> {
  await query(
    `UPDATE google_calendar_links SET
       "channelId" = $2, "channelResourceId" = $3, "channelExpiration" = $4,
       "channelToken" = $5, "updatedAt" = NOW()
     WHERE id = $1`,
    [
      linkId,
      channel?.channelId ?? null,
      channel?.channelResourceId ?? null,
      channel?.channelExpiration?.toISOString() ?? null,
      channel?.channelToken ?? null,
    ]
  );
}

/**
 * Enabled links of healthy accounts whose channel is missing or expires at or
 * before `cutoff` (the renewal sweep's now + 48h window).
 */
export async function listLinksDueForChannelRenewal(
  cutoff: Date
): Promise<CalendarLinkRow[]> {
  const res = await query<CalendarLinkRow>(
    `SELECT l.id, l."userId", l."googleCalendarId", l."appCalendarId",
            l."syncToken", l."syncEnabled", l."lastFullSyncAt", l."lastSyncedAt",
            l."lastError", l."lastErrorAt", l."channelId", l."channelResourceId",
            l."channelExpiration", l."channelToken"
     FROM google_calendar_links l
     JOIN google_accounts a ON a."userId" = l."userId"
     WHERE l."syncEnabled" AND a."syncEnabled" AND NOT a."needsReauth"
       AND (l."channelId" IS NULL OR l."channelResourceId" IS NULL
            OR l."channelExpiration" IS NULL OR l."channelExpiration" <= $1)
     ORDER BY l."userId" ASC, l."createdAt" ASC`,
    [cutoff.toISOString()]
  );
  return res.rows;
}

/** Users with a due outbox op (the renewal cron's opportunistic drain). */
export async function listUserIdsWithDueOps(): Promise<string[]> {
  const res = await query<{ userId: string }>(
    `SELECT DISTINCT "userId" FROM google_sync_ops WHERE "nextAttemptAt" <= NOW()`,
    []
  );
  return res.rows.map((r) => r.userId);
}

// --- app calendars -------------------------------------------------------------

/**
 * Create the import-target app calendar (plan §3: named after the Google
 * calendar summary, color #4285F4, plain SQL). Retries with a numeric suffix
 * on the UNIQUE(userId, name) constraint.
 */
export async function createImportCalendar(
  userId: string,
  name: string
): Promise<string> {
  const base = name.trim() || 'Google Calendar';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base} (${attempt + 1})`;
    try {
      const res = await query<{ id: string }>(
        `INSERT INTO calendars (name, color, description, "userId")
         VALUES ($1, '#4285F4', 'Synced from Google Calendar', $2)
         RETURNING id`,
        [candidate, userId]
      );
      return res.rows[0].id;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== '23505') throw error; // not a unique violation
    }
  }
  throw new Error('Could not allocate a calendar name for the Google import');
}

// --- events (mapping-aware writes) ----------------------------------------------

export function snapshotOf(fields: AppEventFields): string {
  return JSON.stringify({
    title: fields.title,
    description: fields.description,
    location: fields.location,
    start: fields.start.toISOString(),
    end: fields.end.toISOString(),
    allDay: fields.allDay,
    recurrence: fields.recurrence,
    exceptions: fields.exceptions,
  });
}

export async function getEventByGoogleId(
  userId: string,
  googleEventId: string,
  client?: SqlClient
): Promise<MappedEventRow | null> {
  const res = await query<MappedEventRow>(
    `SELECT id, title, description, location, start, "end", "allDay",
            recurrence, exceptions, "calendarId", "googleEventId",
            "googleEtag", "googleUpdatedAt", "googleSyncSnapshot", "updatedAt"
     FROM events WHERE "userId" = $1 AND "googleEventId" = $2`,
    [userId, googleEventId],
    client
  );
  return res.rows[0] ?? null;
}

/** User's IANA timezone for outbound payloads (user_profiles, default UTC). */
export async function getUserTimezone(userId: string): Promise<string> {
  const res = await query<{ timezone: string | null }>(
    'SELECT timezone FROM user_profiles WHERE "userId" = $1',
    [userId]
  );
  return res.rows[0]?.timezone || 'UTC';
}

/**
 * Insert-or-update an app event from a mapped Google payload. Existing local
 * exceptions are UNIONed with the incoming ones so instance-derived and
 * app-local exceptions survive master re-upserts (M2 does real merging).
 * Returns 'inserted' | 'updated'.
 */
export async function upsertEventFromGoogle(
  tx: PoolClient,
  input: {
    userId: string;
    appCalendarId: string;
    googleCalendarId: string;
    googleEventId: string;
    etag: string;
    googleUpdatedAt: Date | null;
    fields: AppEventFields;
  }
): Promise<'inserted' | 'updated'> {
  const { fields } = input;
  // Dates are passed as UTC ISO strings: node-postgres would otherwise
  // serialize Date params in the machine's local zone, which a
  // timestamp-without-tz column silently strips (reads parse as UTC).
  const res = await query<{ inserted: boolean }>(
    `INSERT INTO events (
       title, description, start, "end", "allDay", location, recurrence,
       exceptions, "userId", "calendarId", origin,
       "googleEventId", "googleCalendarId", "googleEtag", "googleUpdatedAt",
       "lastSyncedAt", "googleSyncSnapshot"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'google',
               $11, $12, $13, $14, NOW(), $15::jsonb)
     ON CONFLICT ("userId", "googleEventId") WHERE "googleEventId" IS NOT NULL
     DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       start = EXCLUDED.start,
       "end" = EXCLUDED."end",
       "allDay" = EXCLUDED."allDay",
       location = EXCLUDED.location,
       recurrence = EXCLUDED.recurrence,
       exceptions = (
         SELECT ARRAY(
           SELECT DISTINCT e FROM unnest(events.exceptions || EXCLUDED.exceptions) AS e
           ORDER BY e
         )
       ),
       "calendarId" = EXCLUDED."calendarId",
       "googleCalendarId" = EXCLUDED."googleCalendarId",
       "googleEtag" = EXCLUDED."googleEtag",
       "googleUpdatedAt" = EXCLUDED."googleUpdatedAt",
       "lastSyncedAt" = NOW(),
       "googleSyncSnapshot" = EXCLUDED."googleSyncSnapshot",
       "updatedAt" = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [
      fields.title,
      fields.description,
      fields.start.toISOString(),
      fields.end.toISOString(),
      fields.allDay,
      fields.location,
      fields.recurrence,
      fields.exceptions,
      input.userId,
      input.appCalendarId,
      input.googleEventId,
      input.googleCalendarId,
      input.etag,
      input.googleUpdatedAt?.toISOString() ?? null,
      snapshotOf(fields),
    ],
    tx
  );
  return res.rows[0].inserted ? 'inserted' : 'updated';
}

/** Delete the app row mapped to a Google event id. Returns rows deleted. */
export async function deleteEventByGoogleId(
  tx: PoolClient,
  userId: string,
  googleEventId: string
): Promise<number> {
  const res = await query(
    'DELETE FROM events WHERE "userId" = $1 AND "googleEventId" = $2',
    [userId, googleEventId],
    tx
  );
  return res.rowCount ?? 0;
}

/**
 * Add an occurrence-start ISO to a recurring master's exceptions (dedup) by
 * the master's Google event id. No-ops when the master is not mapped locally.
 * The exclusion is also recorded under the snapshot's `instanceExceptions`
 * key: it is INSTANCE-derived (Google models it as an override/cancelled
 * instance, not an EXDATE), so the merge must not read it as an app-side
 * addition and no outbound EXDATE may ever be written for it — an EXDATE on
 * an overridden instance cancels the override on Google.
 * Returns true when the exception was added.
 */
export async function addExceptionToMaster(
  tx: PoolClient,
  userId: string,
  masterGoogleEventId: string,
  occurrenceIso: string
): Promise<boolean> {
  const res = await query(
    `UPDATE events
     SET exceptions = array_append(exceptions, $3),
         "googleSyncSnapshot" = CASE
           WHEN "googleSyncSnapshot" IS NULL THEN NULL
           ELSE jsonb_set(
             "googleSyncSnapshot", '{instanceExceptions}',
             COALESCE("googleSyncSnapshot"->'instanceExceptions', '[]'::jsonb)
               || to_jsonb($3::text))
         END,
         "updatedAt" = NOW()
     WHERE "userId" = $1 AND "googleEventId" = $2
       AND NOT ($3 = ANY(exceptions))`,
    [userId, masterGoogleEventId, occurrenceIso],
    tx
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Full-resync deletion sweep (plan §3, 410 handling): drop mapped rows of
 * this link that the fresh full feed no longer contains. Guarded to rows the
 * feed could actually have returned:
 *  - timed rows only when they end inside the import window;
 *  - open-ended recurring masters (no COUNT/UNTIL) always — Google returns
 *    them regardless of age, so absence means genuine deletion;
 *  - FINITE recurring masters (COUNT/UNTIL) only when their start is inside
 *    the window. A finite series whose last occurrence predates timeMin=now-1y
 *    is NOT returned by Google yet still exists there; sweeping it on every
 *    410/token-loss would silently drop legitimate old series that never
 *    return (they stay outside the import window on the next full sync too).
 */
export async function deleteMappedEventsNotSeen(
  tx: PoolClient,
  userId: string,
  googleCalendarId: string,
  seenGoogleEventIds: string[],
  windowStart: Date
): Promise<number> {
  const res = await query(
    `DELETE FROM events
     WHERE "userId" = $1 AND "googleCalendarId" = $2
       AND "googleEventId" IS NOT NULL
       AND NOT ("googleEventId" = ANY($3::text[]))
       AND (
         "end" >= $4
         OR (recurrence IS NOT NULL
             AND (recurrence !~* '(COUNT|UNTIL)=' OR start >= $4))
       )`,
    [userId, googleCalendarId, seenGoogleEventIds, windowStart.toISOString()],
    tx
  );
  return res.rowCount ?? 0;
}

/** Strip Google mapping columns, keeping the events (disconnect default). */
export async function unmapEventsForUser(userId: string): Promise<number> {
  const res = await query(
    `UPDATE events SET "googleEventId" = NULL, "googleCalendarId" = NULL,
       "googleEtag" = NULL, "googleUpdatedAt" = NULL, "lastSyncedAt" = NULL,
       "googleSyncSnapshot" = NULL
     WHERE "userId" = $1 AND "googleEventId" IS NOT NULL`,
    [userId]
  );
  return res.rowCount ?? 0;
}

/** Delete every imported (origin='google') event (disconnect + remove). */
export async function deleteImportedEventsForUser(
  userId: string
): Promise<number> {
  const res = await query(
    `DELETE FROM events WHERE "userId" = $1 AND origin = 'google'`,
    [userId]
  );
  return res.rowCount ?? 0;
}

/**
 * Write the outcome of a three-way merge onto an existing row: content fields
 * exactly as merged (exceptions are NOT unioned — the merge already decided),
 * plus inbound bookkeeping (etag/updated/snapshot = the merged state).
 */
export async function applyMergedEvent(
  tx: PoolClient,
  input: {
    eventId: string;
    /** Merged synced fields; exceptions = the EXDATE-backed set only. */
    fields: AppEventFields;
    etag: string;
    googleUpdatedAt: Date | null;
    /** Instance-derived exclusions to preserve (see addExceptionToMaster). */
    instanceExceptions?: string[];
  }
): Promise<void> {
  const { fields } = input;
  const instance = [...new Set(input.instanceExceptions ?? [])].sort();
  const rowExceptions = [
    ...new Set([...fields.exceptions, ...instance]),
  ].sort();
  const snapshot = JSON.parse(snapshotOf(fields)) as Record<string, unknown>;
  snapshot.instanceExceptions = instance;
  await query(
    `UPDATE events SET
       title = $2, description = $3, location = $4, start = $5, "end" = $6,
       "allDay" = $7, recurrence = $8, exceptions = $9,
       "googleEtag" = $10, "googleUpdatedAt" = $11, "lastSyncedAt" = NOW(),
       "googleSyncSnapshot" = $12::jsonb, "updatedAt" = NOW()
     WHERE id = $1`,
    [
      input.eventId,
      fields.title,
      fields.description,
      fields.location,
      fields.start.toISOString(),
      fields.end.toISOString(),
      fields.allDay,
      fields.recurrence,
      rowExceptions,
      input.etag,
      input.googleUpdatedAt?.toISOString() ?? null,
      JSON.stringify(snapshot),
    ],
    tx
  );
}

/**
 * Strip a row's Google mapping so it can be re-inserted as a NEW Google event
 * (edit-vs-delete: the app's edit outlived Google's cancellation; cancelled
 * ids are not revivable).
 */
export async function clearEventMapping(
  tx: PoolClient,
  eventId: string
): Promise<void> {
  await query(
    `UPDATE events SET "googleEventId" = NULL, "googleCalendarId" = NULL,
       "googleEtag" = NULL, "googleUpdatedAt" = NULL, "lastSyncedAt" = NULL,
       "googleSyncSnapshot" = NULL
     WHERE id = $1`,
    [eventId],
    tx
  );
}

/**
 * Record a successful outbound insert on the app row. The snapshot is built
 * from the row's OWN current columns (not the Google response): the base must
 * equal what the app believes was synced, so Google-side canonicalization
 * (e.g. RRULE reordering) later reads as an inbound change, never as a
 * phantom app edit. Returns false when the row no longer exists (deleted
 * locally mid-flight) — the caller must then enqueue a compensating delete.
 */
export async function markEventInserted(
  db: SqlClient,
  input: {
    eventId: string;
    googleEventId: string;
    googleCalendarId: string;
    etag: string;
    googleUpdatedAt: Date | null;
  }
): Promise<boolean> {
  const res = await query(
    `UPDATE events SET
       "googleEventId" = $2, "googleCalendarId" = $3, "googleEtag" = $4,
       "googleUpdatedAt" = $5, "lastSyncedAt" = NOW(),
       "googleSyncSnapshot" = ${ROW_SNAPSHOT_SQL}
     WHERE id = $1`,
    [
      input.eventId,
      input.googleEventId,
      input.googleCalendarId,
      input.etag,
      input.googleUpdatedAt?.toISOString() ?? null,
    ],
    db
  );
  return (res.rowCount ?? 0) > 0;
}

/** Record a successful outbound patch (same snapshot-from-row semantics). */
export async function markEventPatched(
  db: SqlClient,
  input: { eventId: string; etag: string; googleUpdatedAt: Date | null }
): Promise<boolean> {
  const res = await query(
    `UPDATE events SET
       "googleEtag" = $2, "googleUpdatedAt" = $3, "lastSyncedAt" = NOW(),
       "googleSyncSnapshot" = ${ROW_SNAPSHOT_SQL}
     WHERE id = $1`,
    [input.eventId, input.etag, input.googleUpdatedAt?.toISOString() ?? null],
    db
  );
  return (res.rowCount ?? 0) > 0;
}

// `to_char` with the literal ISO shape Date.toISOString() emits, so snapshot
// comparisons in the merge are exact string matches. The snapshot's
// `exceptions` are the EXDATE-backed set (row exceptions MINUS the
// instance-derived ones, which are preserved under `instanceExceptions`).
const ROW_SNAPSHOT_SQL = `jsonb_build_object(
  'title', title, 'description', description, 'location', location,
  'start', to_char(start, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'end', to_char("end", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'allDay', "allDay", 'recurrence', recurrence,
  'exceptions', (
    SELECT COALESCE(jsonb_agg(e ORDER BY e), '[]'::jsonb)
    FROM unnest(exceptions) AS e
    WHERE NOT COALESCE("googleSyncSnapshot"->'instanceExceptions', '[]'::jsonb) ? e
  ),
  'instanceExceptions',
    COALESCE("googleSyncSnapshot"->'instanceExceptions', '[]'::jsonb))`;

/** Minimal existence/mapping probe used by the outbox drain. */
export async function getEventCore(
  eventId: string,
  db?: SqlClient
): Promise<{
  id: string;
  userId: string;
  googleEventId: string | null;
  googleEtag: string | null;
} | null> {
  const res = await query<{
    id: string;
    userId: string;
    googleEventId: string | null;
    googleEtag: string | null;
  }>(
    'SELECT id, "userId", "googleEventId", "googleEtag" FROM events WHERE id = $1',
    [eventId],
    db
  );
  return res.rows[0] ?? null;
}

// --- google_event_tombstones -----------------------------------------------------

export async function upsertTombstone(
  db: SqlClient,
  input: { userId: string; googleCalendarId: string; googleEventId: string }
): Promise<void> {
  await query(
    `INSERT INTO google_event_tombstones ("userId", "googleCalendarId", "googleEventId")
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId", "googleEventId")
     DO UPDATE SET "deletedAt" = NOW(), "googleCalendarId" = EXCLUDED."googleCalendarId"`,
    [input.userId, input.googleCalendarId, input.googleEventId],
    db
  );
}

export async function getTombstone(
  userId: string,
  googleEventId: string,
  db?: SqlClient
): Promise<TombstoneRow | null> {
  const res = await query<TombstoneRow>(
    `SELECT id, "userId", "googleCalendarId", "googleEventId", "deletedAt"
     FROM google_event_tombstones WHERE "userId" = $1 AND "googleEventId" = $2`,
    [userId, googleEventId],
    db
  );
  return res.rows[0] ?? null;
}

export async function deleteTombstone(
  db: SqlClient,
  userId: string,
  googleEventId: string
): Promise<void> {
  await query(
    'DELETE FROM google_event_tombstones WHERE "userId" = $1 AND "googleEventId" = $2',
    [userId, googleEventId],
    db
  );
}

/**
 * Delete every tombstone for a user (disconnect cutover). Tombstones
 * FK-cascade on users, not google_accounts, so they survive a disconnect and
 * would skew edit-vs-delete resolution on a later reconnect.
 */
export async function deleteTombstonesForUser(userId: string): Promise<void> {
  await query('DELETE FROM google_event_tombstones WHERE "userId" = $1', [
    userId,
  ]);
}

// --- google_sync_ops (outbox) ------------------------------------------------------
//
// Enqueues COALESCE per event: a still-pending op of the same kind is updated
// in place (fresh payload/etag, made due immediately) instead of stacking a
// second op. The drain claims ops by bumping nextAttemptAt, so a coalesce
// that lands mid-flight resets nextAttemptAt and the drain's guarded delete
// (WHERE nextAttemptAt = claimed value) leaves the refreshed op for the next
// round — a concurrent edit can never be silently dropped.

const OP_COLUMNS = `id, "userId", op, "eventId", "googleCalendarId", "googleEventId",
  payload, "ifMatchEtag", attempts, "nextAttemptAt", "lastError", "createdAt"`;

export async function enqueueInsertOp(
  db: SqlClient,
  input: {
    userId: string;
    eventId: string;
    googleCalendarId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const updated = await query(
    `UPDATE google_sync_ops
     SET payload = $3::jsonb, "nextAttemptAt" = NOW(), "lastError" = NULL
     WHERE "userId" = $1 AND "eventId" = $2 AND op = 'insert'`,
    [input.userId, input.eventId, JSON.stringify(input.payload)],
    db
  );
  if ((updated.rowCount ?? 0) > 0) return;
  await query(
    `INSERT INTO google_sync_ops ("userId", op, "eventId", "googleCalendarId", payload)
     VALUES ($1, 'insert', $2, $3, $4::jsonb)`,
    [
      input.userId,
      input.eventId,
      input.googleCalendarId,
      JSON.stringify(input.payload),
    ],
    db
  );
}

export async function enqueuePatchOp(
  db: SqlClient,
  input: {
    userId: string;
    eventId: string;
    googleCalendarId: string;
    googleEventId: string;
    payload: Record<string, unknown>;
    ifMatchEtag: string | null;
  }
): Promise<void> {
  const updated = await query(
    `UPDATE google_sync_ops
     SET payload = $3::jsonb, "ifMatchEtag" = $4, "googleEventId" = $5,
         "nextAttemptAt" = NOW(), "lastError" = NULL
     WHERE "userId" = $1 AND "eventId" = $2 AND op = 'patch'`,
    [
      input.userId,
      input.eventId,
      JSON.stringify(input.payload),
      input.ifMatchEtag,
      input.googleEventId,
    ],
    db
  );
  if ((updated.rowCount ?? 0) > 0) return;
  await query(
    `INSERT INTO google_sync_ops
       ("userId", op, "eventId", "googleCalendarId", "googleEventId", payload, "ifMatchEtag")
     VALUES ($1, 'patch', $2, $3, $4, $5::jsonb, $6)`,
    [
      input.userId,
      input.eventId,
      input.googleCalendarId,
      input.googleEventId,
      JSON.stringify(input.payload),
      input.ifMatchEtag,
    ],
    db
  );
}

export async function enqueueDeleteOp(
  db: SqlClient,
  input: {
    userId: string;
    googleCalendarId: string;
    googleEventId: string;
    ifMatchEtag: string | null;
  }
): Promise<void> {
  const updated = await query(
    `UPDATE google_sync_ops
     SET "ifMatchEtag" = $3, "nextAttemptAt" = NOW(), "lastError" = NULL
     WHERE "userId" = $1 AND "googleEventId" = $2 AND op = 'delete'`,
    [input.userId, input.googleEventId, input.ifMatchEtag],
    db
  );
  if ((updated.rowCount ?? 0) > 0) return;
  await query(
    `INSERT INTO google_sync_ops
       ("userId", op, "googleCalendarId", "googleEventId", "ifMatchEtag")
     VALUES ($1, 'delete', $2, $3, $4)`,
    [
      input.userId,
      input.googleCalendarId,
      input.googleEventId,
      input.ifMatchEtag,
    ],
    db
  );
}

/** Drop pending insert/patch ops for an app event (row deleted or merged). */
export async function deletePendingUpsertOps(
  db: SqlClient,
  userId: string,
  eventId: string
): Promise<number> {
  const res = await query(
    `DELETE FROM google_sync_ops
     WHERE "userId" = $1 AND "eventId" = $2 AND op IN ('insert', 'patch')`,
    [userId, eventId],
    db
  );
  return res.rowCount ?? 0;
}

/** Drop pending delete ops for a Google event (Google's side won, or done). */
export async function deletePendingDeleteOps(
  db: SqlClient,
  userId: string,
  googleEventId: string
): Promise<number> {
  const res = await query(
    `DELETE FROM google_sync_ops
     WHERE "userId" = $1 AND "googleEventId" = $2 AND op = 'delete'`,
    [userId, googleEventId],
    db
  );
  return res.rowCount ?? 0;
}

/** Due op ids for one user, oldest-first per calendar (plan §2 drain order). */
export async function listDueOpIds(userId: string): Promise<string[]> {
  const res = await query<{ id: string }>(
    `SELECT id FROM google_sync_ops
     WHERE "userId" = $1 AND "nextAttemptAt" <= NOW()
     ORDER BY "googleCalendarId" ASC, "createdAt" ASC, id ASC`,
    [userId]
  );
  return res.rows.map((r) => r.id);
}

/**
 * Claim a due op: bump attempts and push nextAttemptAt 2 minutes out so no
 * concurrent drain grabs it while the Google call is in flight (no row lock
 * held across the network call). Returns null when already claimed/undue.
 */
export async function claimOp(opId: string): Promise<SyncOpRow | null> {
  // date_trunc to milliseconds: the claim value round-trips through a JS
  // Date (ms precision), and deleteClaimedOp matches it exactly.
  const res = await query<SyncOpRow>(
    `UPDATE google_sync_ops
     SET attempts = attempts + 1,
         "nextAttemptAt" = date_trunc('milliseconds', NOW() + interval '120 seconds')
     WHERE id = $1 AND "nextAttemptAt" <= NOW()
     RETURNING ${OP_COLUMNS}`,
    [opId]
  );
  return res.rows[0] ?? null;
}

/**
 * Remove a completed/dropped op — guarded on the claim's nextAttemptAt so an
 * op that was coalesce-refreshed mid-flight survives with its new payload.
 * Returns false when the op was refreshed (kept).
 */
export async function deleteClaimedOp(
  db: SqlClient,
  op: SyncOpRow
): Promise<boolean> {
  const res = await query(
    'DELETE FROM google_sync_ops WHERE id = $1 AND "nextAttemptAt" = $2',
    [op.id, op.nextAttemptAt.toISOString()],
    db
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Record a retryable failure: exponential backoff on the attempts counter,
 * min(2^attempts minutes, 1 hour) per plan §8 (the in-request client backoff
 * is latency smoothing; this is the durable layer).
 */
export async function recordOpFailure(
  op: SyncOpRow,
  error: string
): Promise<void> {
  await query(
    `UPDATE google_sync_ops
     SET "nextAttemptAt" = NOW() +
           LEAST(interval '1 minute' * power(2, attempts), interval '1 hour'),
         "lastError" = $2
     WHERE id = $1`,
    [op.id, error.slice(0, 500)]
  );
}

/** Pending-op count for a user (tests + status surfacing). */
export async function countPendingOps(userId: string): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::bigint AS count FROM google_sync_ops WHERE "userId" = $1',
    [userId]
  );
  return Number(res.rows[0]?.count ?? 0);
}

/**
 * Outbox health for the status endpoint: total pending ops, how many are
 * carrying a persisted lastError, and the oldest such error message. Lets the
 * Settings panel surface queued/stuck outbound writes instead of a green
 * "Connected" while a local edit silently fails to reach Google.
 */
export async function getOutboxSummary(userId: string): Promise<{
  pending: number;
  failing: number;
  oldestError: string | null;
}> {
  const res = await query<{
    pending: string;
    failing: string;
    oldest_error: string | null;
  }>(
    `SELECT COUNT(*)::bigint AS pending,
            COUNT(*) FILTER (WHERE "lastError" IS NOT NULL)::bigint AS failing,
            (SELECT "lastError" FROM google_sync_ops
             WHERE "userId" = $1 AND "lastError" IS NOT NULL
             ORDER BY "createdAt" ASC LIMIT 1) AS oldest_error
     FROM google_sync_ops WHERE "userId" = $1`,
    [userId]
  );
  const row = res.rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    failing: Number(row?.failing ?? 0),
    oldestError: row?.oldest_error ?? null,
  };
}

/** Delete every outbox op for a user (disconnect cutover). Ops FK-cascade on
 * users, not google_accounts, so they survive a disconnect and would replay
 * against Google on a later reconnect (deleting kept events / duplicating). */
export async function deleteOutboxForUser(userId: string): Promise<void> {
  await query('DELETE FROM google_sync_ops WHERE "userId" = $1', [userId]);
}

export { withTransaction };
