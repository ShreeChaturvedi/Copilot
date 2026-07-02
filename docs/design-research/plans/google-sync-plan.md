# Implementation plan — Issue #27: full two-way Google Calendar sync

Repo: /home/shree/dev/taskflow-calendar, branch `finish-polish-deploy` (HEAD 3d6b329). Written 2026-07-01.
Decisions locked by owner: full two-way sync, last-write-wins (per-field where feasible), primary calendar first with selectable-calendars-ready architecture, Vercel Hobby deploy on a `*.vercel.app` domain, Google push channels + GitHub Actions 15-min pull reconciliation + daily Vercel cron for channel renewal, Google Cloud console driven by a browser agent on `shreebatsachaturvedi@gmail.com`.

All Google API facts below were verified 2026-07-01 against live official docs (URLs cited inline). Repo facts verified against the working tree (file:line refs).

---

## 0. Verified current state (triage claims re-checked)

| Triage claim                                                                                                                                                | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GoogleOAuthService is auth-only, scopes `userinfo.email`+`userinfo.profile`, `access_type: 'offline'` + `prompt: 'consent'`                                 | Confirmed — `packages/backend/src/services/GoogleOAuthService.ts:52-61`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Google refresh_token received but discarded                                                                                                                 | Confirmed — `getToken(code)` at `GoogleOAuthService.ts:70`, `findOrCreateUser` stores only the app JWT refresh token (`:255-259`); `revokeTokens()` is a placeholder (`:277-286`)                                                                                                                                                                                                                                                                                                                                                              |
| No `googleapis` dep; `google-auth-library` ^10.2.1 present                                                                                                  | Confirmed — `packages/backend/package.json:20`; root package.json has neither                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Only Google column is `users."googleId"`                                                                                                                    | Confirmed — `lib/config/migrations/001_initial_schema.sql:17`. `events` has no external-id/etag columns (`001:63-84`, `003` adds `color` + `exceptions text[]`)                                                                                                                                                                                                                                                                                                                                                                                |
| Redirect-URI footgun: consent URL built client-side with `window.location.origin`, exchange uses env `GOOGLE_REDIRECT_URI`; POST body `redirectUri` ignored | Confirmed — `src/services/api/auth.ts:428-439`, `src/pages/GoogleCallback.tsx:34-36`, `GoogleOAuthService.ts:34-36`, `api/auth/google/index.ts:70` (reads only `code`)                                                                                                                                                                                                                                                                                                                                                                         |
| No sync code, no crons, no Integrations UI                                                                                                                  | Confirmed — zero non-auth hits for `syncToken                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | calendar/v3                                                                                               | googleapis`; `vercel.json`has no`crons`; `src/components/settings/` has no Integrations panel (`SettingsDialog.tsx:17-23` sections: general/profile/preferences/security/help/calendar) |
| Events recurring model                                                                                                                                      | Confirmed — one master row: `recurrence` text (single `RRULE:` string), `exceptions text[]` of occurrence-start ISO strings (UTC instants). Server expands virtually at read time (`lib/services/EventService.ts:274-343`), composite instance ids `${masterId}::${iso}`. Frontend "this event" edit = add ISO to master `exceptions` + create an unlinked one-off (`src/components/dialogs/EventCreationDialog.tsx:1043-1072`); "this and following" = clamp master `UNTIL` + new master (`:1073-1106`); "all" = update master (`:1107-1128`) |
| Timestamps                                                                                                                                                  | `timestamp without time zone`, parsed as UTC (`lib/config/database.ts:11-15`). `events.updatedAt` is set on every update (`EventService.ts:535-536`) — usable for LWW                                                                                                                                                                                                                                                                                                                                                                          |
| 39 serverless functions under `api/`                                                                                                                        | Confirmed (`find api -name '_.ts' -not -path '_**tests**\*'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | wc -l` = 39). New Google endpoints must be consolidated into ONE catch-all function to avoid growing this |

Pre-existing bug found during recon (file as a GitHub issue per the standing rule; do not fix inside this project): `EventService.isValidRRule` (`lib/services/EventService.ts:839-867`) whitelists only `FREQ,INTERVAL,COUNT,UNTIL,BYDAY,BYMONTH,BYMONTHDAY` — but the frontend generates `BYSETPOS` for "nth weekday" monthly/yearly rules (`src/utils/recurrence.ts:65,77`), so creating such an event fails server validation. Relevant here because inbound Google recurrences will also contain keywords outside that whitelist (e.g. `BYSETPOS`, `WKST`) — the sync engine must NOT write through `EventService.create/update` validation (see §3).

---

## 1. DB migration: `lib/config/migrations/009_google_sync.sql`

One migration, idempotent in the house style (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, camelCase quoted columns, text ids via `gen_random_uuid()::text`, bare `timestamp` treated as UTC).

```sql
-- 009_google_sync.sql
-- Google Calendar two-way sync: token storage, per-calendar sync state,
-- event mapping, tombstones, and an outbox for deferred outbound writes.

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
-- three-way merge (see §5). JSON of {title,description,location,start,end,
-- allDay,recurrence,exceptions}.
ALTER TABLE events ADD COLUMN IF NOT EXISTS "googleSyncSnapshot" jsonb;

-- Dedupe key for imports and webhook upserts.
CREATE UNIQUE INDEX IF NOT EXISTS "events_userId_googleEventId_uniq"
  ON events("userId", "googleEventId") WHERE "googleEventId" IS NOT NULL;

-- Tombstones: remember app-side deletions of Google-mapped events so (a) the
-- outbound delete can retry after the row is gone, and (b) inbound sync can
-- resolve edit-vs-delete conflicts by timestamp (§5).
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
```

Notes:

- `UNIQUE ("appCalendarId")` keeps the M1 model simple (an app calendar mirrors at most one Google calendar). Selectable calendars later = more link rows, no schema change.
- Encryption helper: new `lib/google/crypto.ts` using node `crypto.createCipheriv('aes-256-gcm', key, iv)` with a random 12-byte IV per encryption; key = 32 bytes from `GOOGLE_TOKEN_ENC_KEY` (hex, generated with `openssl rand -hex 32`). Format `b64(iv).b64(tag).b64(ct)`. Decrypt fails closed → mark `needsReauth`.
- Capturing the refresh token: modify `GoogleOAuthService.handleCallback` (`packages/backend/src/services/GoogleOAuthService.ts:67-84`) to return `tokens.refresh_token`/`scope` alongside the user, and upsert into `google_accounts` when the granted scope set includes the calendar scope. The plain login flow (email/profile only) does not create a `google_accounts` row.

## 2. Outbound sync (Taskflow → Google)

**Hook points** — in `lib/services/EventService.ts` (the single write path used by both `api/events/*` and `scripts/dev-server.ts`):

- `create()` (`EventService.ts:133-174`), `update()` (`:477-545`), `delete()` (inherited `BaseService.delete`, `lib/services/BaseService.ts:294-306` — override in EventService so the hook can capture `googleEventId` before the row dies).
- After the DB write commits: if the event's `calendarId` has an enabled `google_calendar_links` row and the user's `google_accounts.syncEnabled`, call `GoogleSyncService.enqueueOutbound(op, event)` which (1) inserts a `google_sync_ops` row, (2) immediately attempts to drain that one op inline (await, ~1 API call, well within function limits), (3) on failure leaves the op for the reconciliation cron. UX stays fast; delivery is at-least-once.
- Re-entrancy guard: the sync engine's inbound writes go through its own repository (`lib/google/syncRepo.ts`, direct SQL) — they never pass through `EventService`, so no echo loop via hooks. A `ServiceContext.skipGoogleSync` flag is added as a belt-and-braces escape hatch.
- `delete()` override also writes the `google_event_tombstones` row in the same transaction (`withTransaction`, `lib/config/database.ts:98-119`).

**API mapping** (pure functions in new `lib/google/mapping.ts`, unit-test heavy):

- `title↔summary`, `description↔description`, `location↔location`. App `notes` and `color` stay app-only (Google has no free-notes field; Google `colorId` is an 11-value palette, not hex — skip until a later polish milestone).
- Timed events: app UTC `Date` ↔ `start.dateTime` RFC3339 + `start.timeZone`. Outbound uses the user's `user_profiles.timezone` (exists, defaults `'UTC'` — `packages/backend/src/services/UserService.ts:46,92`); **timeZone is required by Google for recurring events** (Events:insert reference). Inbound converts `dateTime` to a UTC instant.
- All-day: app `allDay=true` + timestamps ↔ Google `start.date`/`end.date` (`yyyy-mm-dd`). Google's `end.date` is **exclusive**; the app stores an **inclusive** end at 23:59:59.999 of the last day (`src/components/dialogs/EventCreationDialog.tsx:462-466`). Outbound: `end.date = date(app.end) + 1 day`; inbound: `app.end = (end.date − 1 day) @ 23:59:59.999 UTC`, `app.start = start.date @ 00:00:00 UTC`. Round-trip test mandatory.
- `status`: outbound always `confirmed`; inbound `cancelled` = delete (see §3/§5).

**Recurring events** (the fiddly part; model confirmed in §0):

- Outbound master: `recurrence: ["RRULE:<body>", "EXDATE:<utc-instants>"]` — the app's single `RRULE:` string maps 1:1 (Google takes RFC5545 lines; **DTSTART/DTEND lines are not allowed** in `recurrence` — start/end fields carry them; Events resource reference). App `exceptions[]` (occurrence-start ISO strings, UTC) map to one `EXDATE` line in UTC basic format: `EXDATE:20260701T140000Z,20260708T140000Z`. Because the app expands occurrences from a UTC dtstart (`EventService.generateOccurrences`, `rrulestr(..., {dtstart})` on the UTC timestamp), emit EXDATE values as the UTC instants the app itself computed — matching what Google excludes when `start.timeZone` is honored requires the occurrence instants to agree; see divergence note below.
- Outbound "this event" edits need no special handling: the app already represents them as (master.exceptions += ISO) + a new standalone event — both flow through the normal hooks and arrive on Google as an EXDATE plus an independent event. Visually identical to a Google "modified instance".
- Write-back always targets masters (server-side expansion means composite `::` ids never reach the service layer as writes; issue #8/`aa80d58` precedent).
- Inbound master (`singleEvents=false` — see §3): take the `RRULE:` line into `events.recurrence`. Fold `EXDATE` lines into `exceptions[]` (convert to UTC instants). If the recurrence contains `RDATE`/`EXRULE` (rare), store the full multi-line string in `recurrence` — server expansion already handles it (`rrulestr` parses multi-line sets into `RRuleSet`; `EventService.ts:16,311-323` already types `RRule | RRuleSet`) — but the UI's `parseRRule` (`src/utils/recurrence.ts:103-174`) only understands a leading `RRULE:`; the recurrence editor should show "custom rule (edit on Google)" for those. MVP: sync them read-only rather than mangling.
- Inbound modified instance (`recurringEventId` + `originalStartTime`): map to the app's native pattern — add `originalStartTime` (as UTC ISO) to the master's `exceptions[]`, upsert a standalone app event mapped to that instance's own Google event id. Inbound cancelled instance (`status='cancelled'` + `recurringEventId`; only `id`/`recurringEventId`/`originalStartTime` guaranteed populated — Events resource reference): add to master `exceptions[]` only.
- **Known divergence (document, don't solve in v1):** Google expands recurrences in the event's wall-clock `timeZone` (DST-aware); the app expands from fixed UTC instants. A weekly 9am event crosses DST offset by one hour between the two views. Mitigation deferred: per-event timezone column later. State this in the Integrations UI help text.

**Echo suppression:**

- Every successful outbound write stores the response's `etag` → `events.googleEtag`, `updated` → `events.googleUpdatedAt`, refreshes `googleSyncSnapshot` and `lastSyncedAt`.
- Inbound change processing skips any Google event whose `etag` equals the stored `events.googleEtag` — that is our own write coming back. (Server issues a new ETag on every successful patch — performance guide.)
- Outbound patches send `If-Match: <googleEtag>` (performance guide: "you must provide the current ETag value in the If-Match HTTP header"). On `412 Precondition Failed`, Google changed concurrently → drop the op and let the next inbound pull merge (LWW decides, §5); re-enqueue outbound only if the app side wins the merge.

## 3. Inbound sync (Google → Taskflow)

All inbound paths converge on one engine: `GoogleSyncService.syncCalendar(link)` in new `lib/google/GoogleSyncService.ts`.

**Initial full import** (runs at connect time, and after any 410):

- `events.list(calendarId, {singleEvents: false, maxResults: 2500, timeMin: <now − 1y>, pageToken…})`, page until `nextPageToken` absent; **`nextSyncToken` appears only on the last page** (sync guide). Persist it on `google_calendar_links.syncToken`.
- `singleEvents=false` is mandatory: it is the only mode returning masters with `recurrence[]` (events.list reference); `true` would pre-expand and destroy the RRULEs. The parameter set (including `timeMin` choice) must stay identical across the full sync — and note `timeMin`/`timeMax` are **forbidden together with `syncToken`** (events.list reference lists `iCalUID, orderBy, privateExtendedProperty, q, sharedExtendedProperty, timeMin, timeMax, updatedMin`), so incremental requests send only `syncToken` + `singleEvents=false` + `maxResults`. Consequence: after the first full sync, changes to pre-window events also arrive — fine, upsert handles them.
- Upsert order per page: masters/one-offs first, then instance exceptions (they reference masters). Unmapped Google events → INSERT app event (`origin='google'`, mapping columns set). Already-mapped → merge per §5.
- Import target: the app calendar linked at connect time — default: create a new app calendar named after the Google calendar (`summary`), color `#4285F4`, via plain SQL in `syncRepo` (CalendarService.create semantics for default-calendar handling are not wanted here).

**Incremental sync:**

- `events.list({syncToken, singleEvents: false, maxResults: 2500})`, page through, process changed items (deleted arrive as `status='cancelled'`), persist the new `nextSyncToken` only after the whole batch commits.
- **410 GONE** → per the docs, "clear its storage and perform a full synchronization without any syncToken" (events.list reference). Implementation: null out `syncToken`, run full import — the "wipe" is logical: full import re-upserts by `googleEventId`; events present locally but absent from the fresh full feed and not created since the last sync get deleted (guard: only rows with `origin='google'` or a non-null `googleEventId`).
- Writes go through `lib/google/syncRepo.ts` (direct SQL, transactional) — NOT `EventService` — because (a) `isValidRRule` would reject legitimate Google rules (§0 bug), (b) `ensureUserExists` and validation are wrong for engine writes, (c) we must set mapping columns atomically.

**Push channels (`events.watch`)** — verified against Google's live push docs 2026-07-01:

- **No domain verification is required.** Google's API Console help states "Domain verification in the API Console is no longer required to make push notifications work with your domains" (support.google.com/googleapi/answer/7072069). The only receiving-URL requirements are HTTPS with a valid CA-signed certificate — which every `*.vercel.app` deployment has. **M3 needs no custom domain.**
- **Create:** `POST /calendars/{calendarId}/events/watch` with body `{id: <uuid we mint>, type: 'web_hook', address: 'https://<prod>.vercel.app/api/google/webhook', token: <random per-channel secret>, params: {ttl: '604800'}}` (`id`, `type`, `address` required; `token`/`expiration`/`params.ttl` optional). The response returns `resourceId` and `expiration` (ms epoch). Persist `channelId`, `channelResourceId`, `channelExpiration`, `channelToken` on `google_calendar_links` — **channels.stop requires BOTH the channel id and the resourceId**.
- **TTL / renewal:** Calendar channel TTL defaults to 604800s (7 days), and there is no auto-renewal — re-watch before expiry. Renewal strategy: the daily Vercel cron (`/api/google/cron/renew`) re-watches any channel expiring within 48h — create the NEW channel first, then `channels.stop` the old one (no notification gap), update the link row atomically. The 15-min reconciliation endpoint runs the same sweep as a safety net (covers Hobby-cron timing slop and missed days).
- **Webhook handler** (`POST /api/google/webhook`, public — Google sends no auth): notifications have an **empty body**; everything is in headers (`X-Goog-Channel-ID`, `X-Goog-Resource-ID`, `X-Goog-Resource-State`, `X-Goog-Message-Number`, `X-Goog-Resource-URI`, and when set `X-Goog-Channel-Token`/`X-Goog-Channel-Expiration`). Look up the link by `X-Goog-Channel-ID`, constant-time-compare `X-Goog-Channel-Token` against the stored `channelToken`; unknown/stale channel → respond 200 and ignore (non-2xx makes Google retry). `X-Goog-Resource-State: sync` (message number 1, sent right after channel creation) → ack only. Any other state → the ping carries no event data by design: run `GoogleSyncService.syncCalendar(link)` (incremental `events.list` with the stored `syncToken`; 410 → full resync) inline, then return 200. Always answer fast; on internal failure still return 200 and let the 15-min cron converge.
- **Disconnect:** `POST /channels/stop` with the stored `{id, resourceId}` pair before deleting the link.

**Endpoints** (ONE new serverless function to respect the 39-function pressure — `api/google/[...route].ts` with an internal router, mirroring the `createCrudHandler` middleware conventions):

- `GET  /api/google/status` (JWT) — connection + per-link sync state for the Settings panel.
- `POST /api/google/connect` (JWT) — body `{code, redirectUri}`: exchanges the incremental-auth code (calendar scope), stores encrypted refresh token, creates the primary-calendar link, kicks the initial full import.
- `POST /api/google/disconnect` (JWT) — stop channel, revoke Google token (`https://oauth2.googleapis.com/revoke`), delete `google_accounts` row + links; keep imported events (strip mapping columns) — offer "remove imported events" as a checkbox param.
- `POST /api/google/sync` (JWT for manual "Sync now"; `Authorization: Bearer $GOOGLE_SYNC_CRON_SECRET` for the GH Actions cron) — drains due `google_sync_ops`, then incremental-syncs every enabled link (cron mode: all users; JWT mode: caller only).
- `POST /api/google/webhook` (public, no JWT — Google sends no auth; validated via the per-channel `channelToken`, see push-channels block above).
- `GET  /api/google/cron/renew` (Vercel cron; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the env var is set) — renew channels expiring within 48h; also opportunistically drain overdue ops.
- Dev parity (project rule): mirror `GET/POST /api/google/*` in `scripts/dev-server.ts` next to the existing Google auth mirrors (`scripts/dev-server.ts:1020-1104`).

**GitHub Actions reconciliation** — new `.github/workflows/google-sync-reconcile.yml` (repo is public → scheduled workflows are free; GH cron is best-effort and may lag minutes):

```yaml
name: Google sync reconciliation
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch: {}
concurrency:
  group: google-sync-reconcile
  cancel-in-progress: false
jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync endpoint
        run: |
          curl -sS -X POST "${{ vars.PROD_URL }}/api/google/sync" \
            -H "Authorization: Bearer ${{ secrets.GOOGLE_SYNC_CRON_SECRET }}" \
            --fail-with-body --max-time 290
```

(`vars.PROD_URL` = `https://<project>.vercel.app`. Scheduled workflows on public repos are disabled after 60 days without repo activity — acceptable; a push re-enables.)

## 4. `GoogleCalendarClient` (no `googleapis` dependency)

New `lib/google/GoogleCalendarClient.ts`: a thin typed interface + `fetch`-based implementation against `https://www.googleapis.com/calendar/v3` (`google-auth-library`'s `OAuth2Client` already in the tree handles refresh-token → access-token exchange; skip the heavyweight `googleapis` package).

```ts
export interface GoogleCalendarClient {
  listEvents(calId: string, params: ListParams): Promise<EventsPage>; // syncToken/pageToken aware
  getCalendar(calId: string): Promise<GCalCalendar>; // resolve 'primary' -> real id
  insertEvent(calId: string, body: GCalEventInput): Promise<GCalEvent>;
  patchEvent(
    calId: string,
    eventId: string,
    body: Partial<GCalEventInput>,
    ifMatchEtag?: string
  ): Promise<GCalEvent>;
  deleteEvent(
    calId: string,
    eventId: string,
    ifMatchEtag?: string
  ): Promise<void>;
  watchEvents(calId: string, channel: WatchRequest): Promise<WatchResponse>;
  stopChannel(channelId: string, resourceId: string): Promise<void>;
}
```

Typed error mapping: 401 `invalid_grant`/`invalid_credentials` → `ReauthRequiredError` (sets `google_accounts.needsReauth`); 403/429 `rateLimitExceeded`/`userRateLimitExceeded` → `RateLimitedError`; 410 → `SyncTokenGoneError`; 412 → `EtagMismatchError`.

## 5. Conflict policy: last-write-wins with per-field three-way merge

`googleSyncSnapshot` (the synced-field values at last successful sync) makes "per-field where feasible" cheap:

For each inbound changed Google event that maps to an app row, per synced field {title, description, location, start, end, allDay, recurrence, exceptions}:

1. `app == base && google == base` → no-op.
2. `app == base && google != base` → take Google's value.
3. `app != base && google == base` → keep app's value; after merge, enqueue outbound patch carrying it.
4. `app != base && google != base` (true conflict) → **LWW on the whole field**: compare `events."updatedAt"` (UTC) vs Google `updated` (RFC3339, "last modification time of the main event data" — Events resource reference; note reminder-only edits don't bump it, which is fine since we don't sync reminders).
   After the merge: write the merged row (via syncRepo), set `googleEtag`/`googleUpdatedAt` from the inbound payload, refresh `googleSyncSnapshot`; if any app-side field survived (case 3/4-app-wins), enqueue one outbound patch with `If-Match` of the NEW etag.

**Edit vs delete (simultaneous):** timestamps decide, delete is never silently resurrected without cause:

- Google deleted (`status='cancelled'`), app edited since last sync: compare Google `updated` (the cancellation time) vs app `updatedAt`. Google newer → delete app row (+ tombstone not needed, mapping dies with row). App newer → app wins: re-insert to Google as a NEW event (cancelled ids are not reliably revivable), remap to the new `googleEventId`.
- App deleted, Google edited since: inbound update arrives for a `googleEventId` matching a `google_event_tombstones` row. Google `updated` > `deletedAt` → Google wins: recreate the app event from the payload, clear the tombstone. Else app wins: enqueue outbound `delete`, keep tombstone until it succeeds.
- Both deleted: inbound `cancelled` + tombstone → clear tombstone, drop any pending outbound delete op. Done.

## 6. API surface + UI

**Consent scopes (minimal set):**

- Login flow stays `openid email profile` (unchanged).
- Calendar connect uses **`https://www.googleapis.com/auth/calendar.events`** only ("View and edit events on all your calendars") — it covers events.list/insert/patch/delete/watch on the primary calendar addressed as `primary`/its real id, which is all M1–M3 need. It does NOT cover `calendarList.list`; the later "selectable calendars" milestone adds the granular **`calendar.calendarlist.readonly`** scope via incremental auth (verify that granular scope's availability at implementation time; fallback `calendar.readonly`). Both are "sensitive" scopes — fine in Testing mode, no verification review (§7).
- **Incremental auth for existing Google-login users:** the Settings "Connect Google Calendar" button starts a second OAuth dance with `scope=calendar.events`, `include_granted_scopes=true`, `access_type=offline`, `prompt=consent`, and `state=calendar_connect` (signed nonce). `src/pages/GoogleCallback.tsx` branches on `state`: `calendar_connect` → POST `/api/google/connect` (user already logged in; attaches to their account) instead of the login POST. Email/password users connect the same way — `google_accounts` is keyed by `userId`, not by login method; if their Google email differs from the app email, that's fine (we key on the authenticated app session, and store `googleUserId` for sanity checks).
- Fix the redirect-URI footgun while here: `POST /api/auth/google` and `/api/google/connect` accept `redirectUri` from the body, validate it against an allowlist (`http://localhost:5180/auth/google/callback`, `https://<prod>.vercel.app/auth/google/callback`), and pass it to `getToken({code, redirect_uri})` — removes the hard env coupling (`GOOGLE_REDIRECT_URI` stays as the default).

**Settings Integrations panel:**

- `src/components/settings/IntegrationsSettings.tsx` — new section; register in `SettingsDialog.tsx` (`SettingsSection` union + `renderContent`, `src/components/settings/SettingsDialog.tsx:17-23,46-63`) and `SettingsNav.tsx` navItems (icon: `Link2` or `CalendarClock` from lucide).
- States: Not connected (Connect button → auth URL) / Connected (Google email, linked calendar name, last-synced relative time, "Sync now" button, pause toggle → `syncEnabled`, Disconnect with confirm dialog + "also remove imported events" checkbox) / Needs re-auth (banner + Reconnect button, driven by `needsReauth`) / Error (last `lastError` + timestamp, non-blocking).
- Calendar selection UI ships later (M4) but the status payload already returns `links[]` so the panel is list-shaped from day one.
- New API client `src/services/api/google.ts` (status/connect/disconnect/sync), React Query hooks in `src/hooks/useGoogleSync.ts`; invalidate `events` queries after a manual sync completes.
- Imported events render normally (no read-only lock — two-way sync makes them editable by design). Optional origin badge in `EventDisplayDialog` ("Synced with Google Calendar").

## 7. Google Cloud console runbook (browser agent, account `shreebatsachaturvedi@gmail.com`)

1. console.cloud.google.com → project picker → **New project** → name `taskflow-calendar` → Create → select it.
2. **Enable API:** ☰ → APIs & Services → Library → search "Google Calendar API" → Enable.
3. **OAuth consent (Google Auth Platform):** ☰ → APIs & Services → OAuth consent screen. If the new "Google Auth Platform / Branding" UI appears: Get started → App name `Taskflow Calendar`, support email = the dev account → Audience: **External** → contact email → agree → Create. Keep **Publishing status: Testing** (sensitive scopes work for listed test users without Google's verification review; tokens for Testing apps expire after 7 days ONLY when the scope set includes certain restricted scopes or the app uses the OOB flow — calendar scopes on a Testing app get normal refresh tokens, but Google caps Testing-mode refresh-token lifetime at 7 days for external apps: **plan for this — see caveat below**).
4. **Test users:** Audience (or "Test users" tab) → Add users → `shreebatsachaturvedi@gmail.com` (and any other account whose calendar will sync).
5. **Scopes:** Data access → Add or remove scopes → filter "Google Calendar API" → check `.../auth/calendar.events` (and later `.../auth/calendar.calendarlist.readonly`) → Update → Save.
6. **OAuth client:** APIs & Services → Credentials → Create credentials → OAuth client ID → type **Web application** → name `taskflow-web` →
   - Authorized JavaScript origins: `http://localhost:5180`, `https://<project>.vercel.app`
   - Authorized redirect URIs: `http://localhost:5180/auth/google/callback`, `https://<project>.vercel.app/auth/google/callback`
     → Create → copy **Client ID** and **Client secret** (owner pastes the secret; agent never records it in a committed file).
7. **[M3] Webhook domain verification: NOT NEEDED.** Google no longer requires API Console domain verification for push notifications (support.google.com/googleapi/answer/7072069); the `*.vercel.app` HTTPS URL works as-is — no console clicks for this step. Defensive fallback only if `events.watch` ever rejects the URL (a `webhookUrlUnauthorized`-class error): verify `https://<project>.vercel.app` as a URL-prefix property in Search Console via the HTML-file method (drop the file in `public/` so Vite serves it at the site root, redeploy, Verify), then add the domain under Cloud Console → APIs & Services → Domain verification.

**Testing-mode refresh-token caveat:** Google expires refresh tokens of External apps in **Testing** status after 7 days (OAuth platform behavior, not Calendar-specific). Two options: (a) accept weekly re-consent during development, the `needsReauth` UX already handles it; (b) click **Publish app** (In production) — with only sensitive (not restricted) scopes this shows an "unverified app" interstitial but does not require completing verification for a personal-use app. Recommend (b) at M1 ship. Verify the interstitial behavior live at setup time.

**Env vars:**

| Var                       | Local (.env)                                 | Vercel (prod)                         | Notes                                                                           |
| ------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`        | yes                                          | yes                                   | from step 6                                                                     |
| `GOOGLE_CLIENT_SECRET`    | yes                                          | yes                                   | owner pastes                                                                    |
| `GOOGLE_REDIRECT_URI`     | `http://localhost:5180/auth/google/callback` | `https://<prod>/auth/google/callback` | default only, once body `redirectUri` fix lands                                 |
| `VITE_GOOGLE_CLIENT_ID`   | yes                                          | yes (**build-time**)                  | baked into bundle                                                               |
| `GOOGLE_TOKEN_ENC_KEY`    | yes                                          | yes                                   | `openssl rand -hex 32`; rotating it invalidates stored tokens → users reconnect |
| `GOOGLE_SYNC_CRON_SECRET` | yes                                          | yes + GH repo secret                  | `openssl rand -hex 32`; GH Actions bearer                                       |
| `CRON_SECRET`             | no                                           | yes                                   | Vercel auto-attaches to cron invocations                                        |

`vercel.json` additions: `"crons": [{"path": "/api/google/cron/renew", "schedule": "0 6 * * *"}]` (Hobby: max 2 cron jobs, once-daily granularity, timing not exact — fine for renewal). Also requires the `#25` SPA-fallback rewrite so `/auth/google/callback` survives hard navigation.

## 8. Rate limits, backoff, failure UX

Verified quotas (usage-limits guide, developers.google.com/workspace/calendar/api/guides/quota): **10,000 req/min/project, 600 req/min/user/project**; the historical 1M/day is now a _billing threshold_, not the operative cap. One user's full import of even 10k events is ~4–8 list calls — quota is a non-issue at this scale; the real constraints are serverless duration and burst writes.

- **Backoff wrapper** in `GoogleCalendarClient`: on 403/429 `rateLimitExceeded`/`userRateLimitExceeded` (errors guide: "functionally similar... responded to in the same way, by using exponential backoff") and 5xx: truncated exponential backoff `min(2^n s + jitter(<=1s), 32s)`, max 4 in-request retries (docs prescribe no count; serverless duration bounds ours). Honor `Retry-After` when present. Exhausted → the op stays in `google_sync_ops` with `nextAttemptAt = now + 2^attempts * 1min` (cap 1h) — the cron is the durable retry layer, in-request retries are just latency smoothing.
- **Batching:** process inbound pages transactionally per page (2500 max/page — events.list reference) so a mid-run function timeout never loses a syncToken advance it didn't earn (token persists only after the final page).
- **Function duration:** set `"maxDuration": 60` for `api/google/**` in `vercel.json` functions block (Hobby allows up to 60s; verify at deploy). The reconciliation endpoint self-budgets: stops starting new users' syncs after ~45s and lets the next tick continue.
- **Failure UX:** per-link `lastError/lastErrorAt` surfaced in Integrations panel (non-blocking, with "Sync now" retry); `needsReauth` banner on `invalid_grant` (revoked consent, expired Testing-mode token); manual sync surfaces a sonner toast on failure; webhook and cron paths fail silent to Google (always 200 fast) but record errors. Never block event CRUD on Google failures — outbox absorbs them.

## 9. Test strategy

- **Unit (no network):** `lib/google/mapping.ts` — RRULE round-trips (weekly/monthly BYSETPOS/UNTIL/COUNT), EXDATE↔exceptions, all-day ±1-day end conversion, dateTime↔UTC with timeZone, modified/cancelled instance folding; `crypto.ts` encrypt/decrypt/tamper; merge algorithm truth table (all 4 per-field cases + edit-vs-delete matrix) as pure-function tests.
- **Fake client:** `lib/google/FakeGoogleCalendarClient.ts` — in-memory calendar honoring the contract: assigns ids/etags, bumps etag+`updated` on writes, `If-Match` → 412 on stale etag, syncToken stream with change journal, 410 on demand, `status='cancelled'` on delete, paging. Used by `GoogleSyncService` integration tests against real Postgres (piggyback the existing `backend-db` CI job pattern, `.github/workflows/ci.yml` — postgres:16 service + `npm run db:migrate`). Scenarios: full import, incremental add/edit/delete, echo suppression (own write comes back → no-op), LWW both directions, edit-vs-delete both directions, 410 resync, outbox retry after injected 429.
- **Contract tests:** checked-in JSON fixtures captured from the real API (one recurring master with EXDATE, one modified instance, one cancelled instance, one all-day, one syncToken page sequence) — mapping tests run against real payload shapes, and the Fake is validated to emit the same shapes.
- **Live-only (manual/browser-agent checklist per milestone):** OAuth consent + incremental auth grant, Testing-mode token behavior, webhook delivery end-to-end (needs deployed prod URL), channel expiry/renewal, real quota/backoff behavior, cross-DST recurring divergence spot-check.

## 10. Phased delivery (each independently shippable)

- **M0 — prerequisite:** #25 deploy (Neon + Vercel + SPA fallback rewrite). Nothing in M2+ is end-to-end testable without a public URL; M1 is testable locally with real Google creds. _Owner:_ console runbook steps 1–6. ~0.5 day incl. smoke test.
- **M1 — Connect + import + pull sync (inbound-only):** migration 009 (full schema, including outbox/tombstones — costs nothing extra now, saves rework); crypto helper; refresh-token capture; `GoogleCalendarClient` + Fake; mapping; full import + incremental pull; `/api/google/{status,connect,disconnect,sync}`; Integrations panel; GH Actions 15-min workflow; dev-server mirrors. Verify: connect in Settings → Google events appear; create event in Google → appears within 15 min (or "Sync now"). **~1.5–2 agent-days.**
- **M2 — Outbound + conflicts (true two-way):** EventService hooks + delete override; outbox drain inline+cron; If-Match writes; echo suppression; three-way merge + LWW + edit-vs-delete rules; recurring write-back incl. exceptions→EXDATE. Verify: app create/edit/delete reflect in Google within seconds; conflicting edits resolve by newest; no ping-pong loops (assert stable etags over 3 sync rounds). **~2 agent-days.**
- **M3 — Push channels + renewal (near-real-time inbound):** webhook endpoint + channel token validation; watch at connect; daily Vercel renewal cron + renewal sweep in reconciliation endpoint; channels.stop on disconnect. No owner console work (domain verification not required, §7 step 7). Verify: Google edit → app updated in seconds; kill channel → 15-min cron still converges. **~1–1.5 agent-days.**
- **M4 — Selectable calendars + polish (optional):** `calendar.calendarlist.readonly` incremental scope; `GET /api/google/calendars`; multi-link UI with per-calendar toggles; color mapping; origin badge. **~1 agent-day.**

## 11. True blockers / owner decisions outstanding

1. **#25 must ship first** for M2+ verification and all webhook work (public HTTPS URL).
2. **Google Cloud console setup** is owner/browser-agent work (runbook §7); client secret handling is owner-pasted.
3. **Testing-vs-Published consent screen:** 7-day refresh-token expiry in Testing mode makes "Publish (unverified)" the practical choice — needs a one-click owner decision at setup.
4. ~~Webhook domain feasibility~~ — RESOLVED, not a blocker: Google no longer requires domain verification for push notification endpoints, so the free `*.vercel.app` URL works for M3 as-is. No custom domain needed.
