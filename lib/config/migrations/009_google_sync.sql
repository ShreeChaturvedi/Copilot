-- 009_google_sync.sql
-- Google Calendar two-way sync: token storage, per-calendar sync state,
-- event mapping, tombstones, and an outbox for deferred outbound writes.
-- Complete schema for all sync milestones (M1 pull sync, M2 outbound writes,
-- M3 push channels) so this is the only sync migration.
-- Idempotent in the house style (see 001): ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE IF NOT EXISTS, camelCase quoted columns, text ids via
-- gen_random_uuid()::text, bare timestamp treated as UTC.

-- One linked Google account per user (PK = userId).
CREATE TABLE IF NOT EXISTS google_accounts (
  "userId"          text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  "googleUserId"    text NOT NULL,
  email             text,
  -- AES-256-GCM ciphertext: base64(iv).base64(authTag).base64(ct), key from
  -- env GOOGLE_TOKEN_ENC_KEY. Never store the plaintext refresh token.
  "refreshTokenEnc" text NOT NULL,
  scopes            text NOT NULL DEFAULT '',
  "syncEnabled"     boolean NOT NULL DEFAULT true,
  "needsReauth"     boolean NOT NULL DEFAULT false,   -- set on invalid_grant
  "lastError"       text,
  "lastErrorAt"     timestamp,
  "connectedAt"     timestamp NOT NULL DEFAULT NOW(),
  "updatedAt"       timestamp NOT NULL DEFAULT NOW()
);

-- One row per (user, Google calendar). Architecture-ready for selectable
-- calendars: primary-only in M1 means exactly one row per user.
CREATE TABLE IF NOT EXISTS google_calendar_links (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The real calendar id (e.g. 'shreebatsachaturvedi@gmail.com'), never the
  -- alias 'primary' (resolve once at connect time via calendars.get('primary')
  -- or the id claim, so webhook resource ids and event.organizer match).
  "googleCalendarId"  text NOT NULL,
  "appCalendarId"     text NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  "syncToken"         text,                     -- nextSyncToken; NULL => full sync needed
  "syncEnabled"       boolean NOT NULL DEFAULT true,
  "lastFullSyncAt"    timestamp,
  "lastSyncedAt"      timestamp,
  "lastError"         text,
  "lastErrorAt"       timestamp,
  -- push channel lifecycle (events.watch)
  "channelId"         text,                     -- uuid we mint per watch
  "channelResourceId" text,                     -- X-Goog-Resource-ID from watch response; needed for channels.stop
  "channelExpiration" timestamp,                -- from watch response (ms epoch -> timestamp)
  "channelToken"      text,                     -- per-channel secret echoed back in X-Goog-Channel-Token
  "createdAt"         timestamp NOT NULL DEFAULT NOW(),
  "updatedAt"         timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "googleCalendarId"),
  UNIQUE ("appCalendarId")
);
CREATE INDEX IF NOT EXISTS "google_calendar_links_userId_idx" ON google_calendar_links("userId");
CREATE INDEX IF NOT EXISTS "google_calendar_links_channelId_idx" ON google_calendar_links("channelId");
CREATE INDEX IF NOT EXISTS "google_calendar_links_channelExpiration_idx" ON google_calendar_links("channelExpiration");

-- Event mapping lives ON the events row (per owner spec). origin records
-- provenance; echo suppression uses googleEtag/googleUpdatedAt, not origin.
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleEventId"      text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleCalendarId"   text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleEtag"         text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleUpdatedAt"    timestamp;   -- Google `updated` at last sync
ALTER TABLE events ADD COLUMN IF NOT EXISTS "lastSyncedAt"       timestamp;
ALTER TABLE events ADD COLUMN IF NOT EXISTS origin               text NOT NULL DEFAULT 'app';  -- 'app' | 'google'
-- Canonical synced-field snapshot at last successful sync; enables per-field
-- three-way merge (M2). JSON of {title,description,location,start,end,
-- allDay,recurrence,exceptions}.
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleSyncSnapshot" jsonb;

-- Dedupe key for imports and webhook upserts.
CREATE UNIQUE INDEX IF NOT EXISTS "events_userId_googleEventId_uniq"
  ON events("userId", "googleEventId") WHERE "googleEventId" IS NOT NULL;

-- Tombstones: remember app-side deletions of Google-mapped events so (a) the
-- outbound delete can retry after the row is gone, and (b) inbound sync can
-- resolve edit-vs-delete conflicts by timestamp (M2).
CREATE TABLE IF NOT EXISTS google_event_tombstones (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "googleCalendarId" text NOT NULL,
  "googleEventId"    text NOT NULL,
  "deletedAt"        timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "googleEventId")
);

-- Outbox: outbound Google writes are recorded here first, drained inline
-- (best-effort, same request) and by the 15-min reconciliation cron
-- (at-least-once with retry/backoff state). Payload is the full mapped Google
-- event body so a retry needs no re-read of a possibly-changed app row.
CREATE TABLE IF NOT EXISTS google_sync_ops (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  op                 text NOT NULL,        -- 'insert' | 'patch' | 'delete'
  "eventId"          text,                 -- app event id (nullable: delete op survives row deletion)
  "googleCalendarId" text NOT NULL,
  "googleEventId"    text,                 -- null for insert until Google assigns one
  payload            jsonb,                -- mapped Google event body (null for delete)
  "ifMatchEtag"      text,                 -- etag captured at enqueue time (LWW guard)
  attempts           integer NOT NULL DEFAULT 0,
  "nextAttemptAt"    timestamp NOT NULL DEFAULT NOW(),
  "lastError"        text,
  "createdAt"        timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "google_sync_ops_due_idx" ON google_sync_ops("nextAttemptAt");
CREATE INDEX IF NOT EXISTS "google_sync_ops_userId_idx" ON google_sync_ops("userId");
