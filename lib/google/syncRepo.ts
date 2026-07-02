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
  start: Date;
  end: Date;
  allDay: boolean;
  recurrence: string | null;
  exceptions: string[];
  calendarId: string;
  googleEventId: string | null;
  googleEtag: string | null;
  updatedAt: Date;
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

function snapshotOf(fields: AppEventFields): string {
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
    `SELECT id, title, start, "end", "allDay", recurrence, exceptions,
            "calendarId", "googleEventId", "googleEtag", "updatedAt"
     FROM events WHERE "userId" = $1 AND "googleEventId" = $2`,
    [userId, googleEventId],
    client
  );
  return res.rows[0] ?? null;
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
     SET exceptions = array_append(exceptions, $3), "updatedAt" = NOW()
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
 * feed could actually have returned: recurring masters always, timed rows
 * only when they end inside the import window.
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
       AND (recurrence IS NOT NULL OR "end" >= $4)`,
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

export { withTransaction };
