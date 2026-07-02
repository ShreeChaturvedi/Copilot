# Triage dossier: #25 (deploy Neon+Vercel) and #27 (Google Calendar sync)

Repo: /home/shree/dev/taskflow-calendar (github.com/ShreeChaturvedi/taskflow-calendar, public, default branch `main`)
Branch verified against: `finish-polish-deploy` (HEAD 3d6b329, 2026-07-01). All file:line refs below are against this working tree.

---

## Issue #25 — Deploy to Neon Postgres + Vercel

A full deploy runbook was posted as the first comment on #25 (author ShreeChaturvedi). It is still accurate. The second comment (xiaohou2503687-design) is drive-by spam with a link, ignore it.

### Already done on this branch (verified, not from issue text)

| Item                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime pg pools SSL-aware (the #25 blocker) | commit `c8878f3` is on `finish-polish-deploy` (`git branch --contains c8878f3`). `lib/config/database.ts:34-45` and `packages/backend/src/config/database.ts:6,22` enable `ssl: { rejectUnauthorized: false }` when URL has `sslmode=require` OR host is non-local, unless `PGSSLMODE=disable`. Local Docker stays plaintext.                                                                                                                      |
| Migrations exist                             | `lib/config/migrations/` has 8 files: `001_initial_schema.sql` (users, user_profiles, refresh_tokens, calendars, events, task_lists, tasks, tags, task_tags, attachments), `002_performance_indexes.sql`, `003_event_color_exceptions.sql`, `004_task_description.sql`, `005_password_reset_tokens.sql`, `006_task_list_archive.sql`, `007_user_preferences.sql`, `008_user_roles.sql`.                                                            |
| Migration runner works                       | `npm run db:migrate` → `scripts/migrate.ts` (tsx). Idempotent, transactional per file, records into `schema_migrations`, SSL-aware (`scripts/migrate.ts:45-53`). Verified live 2026-07-01: `npm run db:migrate:status` against local Docker (`react-calendar-postgres`, healthy) shows all 8 `✓ applied`. Falls back to `postgresql://postgres:postgres@localhost:5432/react_calendar_dev` when `DATABASE_URL` unset (`scripts/migrate.ts:33-40`). |
| JWT_SECRET prod refusal                      | `packages/backend/src/utils/jwt.ts:9-18`: empty fallback in production + `throw new Error('JWT_SECRET environment variable is required in production...')`. All CRUD-route auth verifies via this same module (`lib/middleware/auth.ts:10` imports from `packages/backend/src/utils/jwt.js`), so there is one JWT source of truth.                                                                                                                 |
| Prod build config                            | `vercel.json`: framework `vite`, buildCommand `npm run build:shared && npm run build:frontend`, outputDirectory `dist`, installCommand `npm install --legacy-peer-deps` (`.npmrc` also has `legacy-peer-deps=true`), functions `api/**/*.ts` pinned to runtime `@vercel/node@5.3.11`. `package.json` engines: `node 20.x`.                                                                                                                         |
| CI                                           | `.github/workflows/ci.yml`: lint + frontend tests + mocked backend tests + `npm run build`, plus a `backend-db` job with a postgres:16 service. No deploy step in CI.                                                                                                                                                                                                                                                                              |
| Vercel CLI                                   | Installed at `/home/shree/.local/nodejs/node-v22/bin/vercel` (v51.2.1) and **already logged in** as `shreebatsachaturvedi-8125` (`vercel whoami` succeeds). So `vercel login` is NOT an outstanding owner step.                                                                                                                                                                                                                                    |

### NOT done / remaining

1. **`.vercel/` does not exist** — project never linked/created. `vercel link --yes` (or first `vercel deploy`) creates it. Agent-doable since CLI is authed.
2. **Neon project does not exist** (no `DATABASE_URL` for prod anywhere; repo has no `.env`, only `.env.example` and `.env.build`). `neonctl` is NOT installed. Owner step (or agent via Neon web console with owner driving auth, or the Vercel Marketplace Neon integration from the Vercel dashboard).
3. **Migrate Neon**: `DATABASE_URL='postgres://...-pooler...?sslmode=require' npm run db:migrate` then `... npm run db:migrate:status`. Agent-doable once the connection string exists. Use the **pooled** (`-pooler` host) string for the runtime env; migrations can use either.
4. **Set Vercel env vars** (see table below). Agent-doable via `vercel env add <NAME> production` (values pasted by owner for secrets).
5. **Deploy**: `vercel --prod`. Agent-doable.
6. **Live smoke test**: register/login, reload persists, task CRUD, event CRUD, calendar views. Agent-doable (playwright-cli).
7. **README env docs** (acceptance criterion in #25) — will need a repo edit; tracked with #23.

### GAP FOUND (not in the issue/runbook): missing SPA fallback rewrite — likely must-fix

`vercel.json` rewrites contain only a no-op `/api/:path*` → `/api/:path*`. There is **no catch-all rewrite to `/index.html`**. The SPA has client routes `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/google/callback` (`src/App.tsx:233-288`). On Vercel's static vite output, a hard navigation to any of these returns 404 — and `/auth/google/callback` is precisely where Google redirects back to, and `/reset-password?token=...` is opened from email. Fix during deploy (repo edit, one line):

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api/:path*" },
  { "source": "/((?!api/).*)", "destination": "/index.html" }
]
```

(Keep the `/api` rule first; the negative-lookahead catch-all must not swallow API routes. Vercel serves real static files before rewrites, so assets are unaffected.)

### Env vars required in Vercel Production (enumerated from code, not the issue)

`rg 'process.env' api/ lib/ packages/backend/src` distinct vars and where they matter:

| Var                                         | Required?                 | Used at                                                                                                                                                                                                                        | Notes                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | YES                       | `lib/config/database.ts:19`, `packages/backend/src/config/database.ts:6`, `scripts/migrate.ts:35`                                                                                                                              | Neon **pooled** string with `?sslmode=require`                                                                                                                                                                                                                                                   |
| `JWT_SECRET`                                | YES                       | `packages/backend/src/utils/jwt.ts:9`                                                                                                                                                                                          | App throws at cold start in prod without it. Generate: `openssl rand -hex 32`                                                                                                                                                                                                                    |
| `NODE_ENV=production`                       | YES                       | 32 uses; gates the JWT refusal, upload fallback (`api/upload/index.ts:51-52`), pool caching (`lib/config/database.ts:49`)                                                                                                      | Vercel sets this automatically for prod builds, but set explicitly to be safe                                                                                                                                                                                                                    |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | no                        | `packages/backend/src/utils/jwt.ts:19-20`                                                                                                                                                                                      | defaults 15m / 7d                                                                                                                                                                                                                                                                                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login only         | `packages/backend/src/services/GoogleOAuthService.ts:32-33,328`                                                                                                                                                                | Without them `/api/auth/google` returns 503 GOOGLE_OAUTH_NOT_CONFIGURED (graceful)                                                                                                                                                                                                               |
| `GOOGLE_REDIRECT_URI`                       | Google login only         | `GoogleOAuthService.ts:34-36` (default `http://localhost:3001/auth/google/callback`)                                                                                                                                           | MUST be exactly `https://<prod-domain>/auth/google/callback` — see redirect-URI footgun below                                                                                                                                                                                                    |
| `VITE_GOOGLE_CLIENT_ID`                     | Google login only         | `src/services/api/auth.ts:430` (build-time, baked into the bundle)                                                                                                                                                             | Same client id; must be present at **build** time on Vercel                                                                                                                                                                                                                                      |
| `BLOB_READ_WRITE_TOKEN`                     | attachments only          | `lib/utils/blobStorage.ts:25`, `api/upload/index.ts:52`                                                                                                                                                                        | Vercel Blob store token; in prod without it uploads fail (dev has a data-URI fallback, prod does not)                                                                                                                                                                                            |
| `FRONTEND_URL`                              | no                        | `lib/config/api.ts:20,221-222`, `lib/middleware/cors.ts:16`, `packages/backend/src/services/AuthService.ts:349-351`                                                                                                            | SPA+API are same-origin on Vercel; only needed for a separate frontend domain. Password-reset emails build links from `VERCEL_URL` else `FRONTEND_URL` (`AuthService.ts:349-351`) — note `VERCEL_URL` is the per-deployment URL, so for pretty reset links set `FRONTEND_URL` to the prod domain |
| `RESEND_API_KEY` + `FROM_EMAIL`             | password-reset email only | `packages/backend/src/services/AuthService.ts:356-357`                                                                                                                                                                         | Without them forgot-password still 200s but no email is sent (token only logged)                                                                                                                                                                                                                 |
| `PGSSLMODE`                                 | no                        | `lib/config/database.ts:37` etc.                                                                                                                                                                                               | only as an opt-out (`disable`)                                                                                                                                                                                                                                                                   |
| auto-set by Vercel                          | —                         | `VERCEL_URL` (10 uses), `VERCEL_PROJECT_PRODUCTION_URL` (`lib/middleware/cors.ts:15`)                                                                                                                                          | nothing to do                                                                                                                                                                                                                                                                                    |
| ignorable                                   | —                         | `REDIS_URL` (`lib/services/index.ts:29` cache flag only), `DATABASE_MAX_CONNECTIONS`, `DATABASE_TIMEOUT`, `DATABASE_QUERY_TIMEOUT`, `DB_MAX_CONNECTIONS`, `ENABLE_*`, `EMAIL_FROM` (only via dead config), `TEST_DATABASE_URL` | no Redis anywhere in runtime paths                                                                                                                                                                                                                                                               |

Dead config note: `lib/config/env.ts` (zod schema requiring `DATABASE_URL` url + `JWT_SECRET` min-32) is **imported by nothing** — it enforces nothing. `lib/config/api.ts:34` has a `'your-secret-key'` fallback but is not used for signing/verifying (only `packages/backend/src/utils/jwt.ts` is).

### Owner-interactive vs agent-doable

Owner (interactive/browser):

- Create the Neon project + database and hand over the pooled connection string (console.neon.tech; or approve the Vercel↔Neon marketplace integration in the Vercel dashboard). `neonctl` is not installed and would itself need an interactive `neonctl auth`.
- Paste secret values (`JWT_SECRET` can be agent-generated; Neon URL, Google client secret, Resend key are owner-held).
- Google Cloud console work if Google login should work in prod (redirect URI registration; see #27 section).
- Optional: custom domain DNS.

Agent (everything else, in order):

```bash
cd /home/shree/dev/taskflow-calendar
vercel link --yes                             # creates .vercel/, project taskflow-calendar
# create Blob store: vercel blob store add taskflow-attachments   (then token via dashboard or `vercel env pull`)
DATABASE_URL='<neon-pooled-url>' npm run db:migrate
DATABASE_URL='<neon-pooled-url>' npm run db:migrate:status
printf '%s' "$VAL" | vercel env add DATABASE_URL production       # repeat per var
vercel --prod
# then smoke test the deployment URL with playwright-cli
```

`vercel login` is already done (account `shreebatsachaturvedi-8125`). Git-connecting the Vercel project to GitHub (optional, enables deploy-on-push) is a dashboard step or `vercel git connect`.

### Risks / verify-at-deploy

- **39 serverless function files** under `api/` (excluding `__tests__`; includes leftovers `api/test.ts` and `api/health.ts`). Vercel Hobby historically capped deployments at 12 functions; Vercel lifted/relaxed this in 2024 but verify on first deploy. If the cap bites: consolidate routes into fewer catch-all handlers or upgrade to Pro. (`api/test.ts` is a debug endpoint that should probably be deleted anyway — dead-code issue #22.)
- Engines `node: 20.x` vs runtime pin `@vercel/node@5.3.11` — set the Vercel project Node version to 20 if the build complains.
- `.env.build` (contains only local `DATABASE_URL`) is referenced by nothing found in build scripts; ignore.
- The dev-server (`scripts/dev-server.ts`) mirrors `api/**` including `/api/auth/google` (`scripts/dev-server.ts:1020-1044`), so local parity exists for smoke-testing before deploy.

---

## Issue #27 — Google Calendar import + two-way sync

Issue has 0 comments. Its body (verified still accurate against the tree) proposes scopes, syncToken, external-id mapping, watch channels.

### What exists today (inventory)

| Piece                                                 | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------- | ------------------------------------------------------------------------ |
| `packages/backend/src/services/GoogleOAuthService.ts` | Auth-only. Scopes = `userinfo.email` + `userinfo.profile` (`:52-55`), `access_type: 'offline'`, `prompt: 'consent'` (`:57-61`) — so Google DOES return a refresh_token at `:70` (`oauth2Client.getToken(code)`), **but it is discarded**: `findOrCreateUser` stores only the app's own JWT refresh token via `refreshTokenService` (`:255-259`). `revokeTokens()` is an explicit placeholder (`:277-286`). Uses `google-auth-library` ^10.2.1 (`packages/backend/package.json:20`); the `googleapis` package is NOT installed anywhere.                               |
| API routes                                            | `api/auth/google/index.ts` (GET auth-url from backend service, POST code→session; this is the #7 fix, works), `api/auth/google/callback.ts` (GET, JSON-dumps authResult, unused by the SPA flow), `api/auth/google/verify.ts` (POST idToken verify, unused by the SPA flow). No calendar endpoints of any kind.                                                                                                                                                                                                                                                       |
| Frontend                                              | `src/services/api/auth.ts:428-439` `getGoogleAuthUrl(redirectUri)` builds the consent URL **client-side** with `import.meta.env.VITE_GOOGLE_CLIENT_ID`, scope `openid email profile`, `access_type=offline&prompt=consent`. `src/pages/GoogleCallback.tsx:34-36` posts `{ code, redirectUri: window.location.origin + '/auth/google/callback' }` to `/api/auth/google`. Settings components: `CalendarSettings/General/Help/Preferences/Profile/Security/SettingsDialog/SettingsNav` under `src/components/settings/` — **no Integrations/Connect-Google UI exists**. |
| DB                                                    | `users."googleId" text UNIQUE` (`lib/config/migrations/001_initial_schema.sql:17`) is the ONLY Google column. `calendars` table (`001:49-61`: name, color, isVisible, isDefault, userId) is a natural mapping target for Google calendars. `events` (`001:63-84`: title, description, start/end timestamp, allDay, location, notes, recurrence text, calendarId, userId; `003` adds color + recurrence exceptions) has **no source/externalId/etag column** — no dedupe key for imports. No tables for Google tokens, sync tokens, or channel state.                  |
| Sync code                                             | None. `rg 'googleapis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | calendar.readonly | syncToken | calendar/v3'` over api/, lib/, packages/backend/src: zero non-auth hits. |
| Cron                                                  | `vercel.json` has no `crons` key; no cron endpoints exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Redirect-URI footgun (affects all variants and plain Google login):** the frontend builds the consent URL with `redirect_uri = window.location.origin + '/auth/google/callback'`, but the token exchange happens server-side through an `OAuth2Client` constructed with `process.env.GOOGLE_REDIRECT_URI` (`GoogleOAuthService.ts:34-36`; the `redirectUri` in the POST body is ignored by `api/auth/google/index.ts` — it only reads `code`). Google requires the exchange redirect_uri to equal the consent one, so `GOOGLE_REDIRECT_URI` must be set to exactly `https://<prod-domain>/auth/google/callback` (dev: `http://localhost:5180/auth/google/callback`). Also: there is no local `.env` at all, so Google login is currently unconfigured even in dev; whether an OAuth client already exists in some Google Cloud project is unknown — ask the owner.

### Variant (a): one-time import

Flow: user clicks "Import from Google" → OAuth consent with added scope `https://www.googleapis.com/auth/calendar.readonly` → backend exchanges code, uses the short-lived access token immediately to pull `calendarList.list` + `events.list` (paged, `singleEvents=false`), maps into `calendars`/`events`, done. No token storage needed if import happens within the callback request (access tokens live ~1h).

- Build items: migration `009` adding `events."googleEventId" text`, `events."googleCalendarId" text`, partial unique index `(userId, googleEventId) WHERE "googleEventId" IS NOT NULL` (dedupe on re-import); one new endpoint pair (`api/google/import.ts` start+callback or reuse the existing auth callback with a `state` flag); mapping code (Google event → app event: `start.dateTime|date` → start/allDay, `recurrence[]` RRULE strings → existing `recurrence` text column, timezone: app stores UTC timestamps, convert with the event's `timeZone`); a settings button + progress toast; dev-server mirror route (parity rule, see #31 precedent).
- Effort: ~0.5–1.5 agent-days including tests. No new deps needed — call `https://www.googleapis.com/calendar/v3/...` with plain `fetch` and the access token (skip the heavyweight `googleapis` package; `google-auth-library` already handles the OAuth dance).
- Google Cloud console (OWNER): enable "Google Calendar API" on the project; add `calendar.readonly` scope to the OAuth consent screen (sensitive scope → keep app in Testing mode with owner as test user, no verification review needed); ensure redirect URIs registered for localhost:5180 + prod domain.
- Env vars: the existing 4 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `VITE_GOOGLE_CLIENT_ID`). Nothing new.

### Variant (b): periodic one-way pull sync

Adds to (a): persist the Google refresh token + per-calendar `syncToken`, and re-pull on a schedule.

- Build items: migration `009b`: table `google_accounts(userId PK/FK, googleUserId, refreshTokenEnc text, scopes text, connectedAt)` (encrypt at rest — new env `GOOGLE_TOKEN_ENC_KEY`, AES-256-GCM) and `google_sync_state(userId, googleCalendarId, appCalendarId, syncToken, lastSyncedAt, enabled)`. Stop discarding `tokens.refresh_token` in `GoogleOAuthService.handleCallback` (`:70-77`). Sync service: `events.list` with `syncToken` (incremental; on HTTP 410 GONE drop token and full-resync), upsert by `googleEventId`, honor `status: 'cancelled'` → delete. Endpoints: `api/google/sync.ts` (POST, manual refresh + cron target, protect with `CRON_SECRET` env), `api/google/calendars.ts` (list/select), `api/google/index.ts` (connect/disconnect status). Settings UI: "Connected accounts" panel (calendar checkboxes, last-synced, disconnect). Cron: `vercel.json` `"crons": [{"path": "/api/google/sync", "schedule": "0 6 * * *"}]`.
- **Vercel plan constraint**: Hobby crons are limited (2 jobs, once-per-day granularity). For 5–15 min freshness either Vercel Pro, or free workaround: a GitHub Actions scheduled workflow (`schedule: '*/15 * * * *'`, repo is public so free) curling `https://<prod>/api/google/sync -H "Authorization: Bearer $CRON_SECRET"`.
- Imported events should be read-only in the UI in this variant (edits would be silently overwritten on next pull) — or accept last-pull-wins and document it.
- Effort: ~2–3 agent-days on top of (a).
- Console (OWNER): same as (a).
- New env vars: `GOOGLE_TOKEN_ENC_KEY`, `CRON_SECRET`.

### Variant (c): true two-way sync

Adds to (b): write-back + push notifications + conflict rules.

- Scope upgrade to `https://www.googleapis.com/auth/calendar` (also sensitive; Testing mode still fine for personal use).
- Write-back: hook the existing event CRUD (`api/events/index.ts`, `api/events/[id].ts`) — after commit, if the event's calendar is Google-linked, call `events.insert/patch/delete` on Google, store returned `id`/`etag`. Echo suppression: on the next incremental pull, skip changes whose `updated`/etag match what we just wrote (store `lastKnownEtag` per mapping row).
- Push: `events.watch` per synced calendar → webhook `api/google/webhook.ts` (validate `X-Goog-Channel-Token` against a stored per-channel secret; body is empty, it just triggers an incremental sync). Channels expire — store `channelId/resourceId/expiration` in `google_sync_state` and renew via the cron. **Owner console step unique to (c): domain verification** — Google push requires the webhook domain be a verified owner domain (Search Console verification of the prod domain, then add it under Cloud Console → APIs & Services → Domain verification). A bare `*.vercel.app` subdomain can be Search-Console-verified via HTML-file method, but a custom domain is cleaner.
- Conflict rule (keep it simple): compare Google `updated` vs app `updatedAt`, last-writer-wins; per-field merge is not worth it. Recurring events: map master + `recurringEventId` exceptions onto the existing `recurrence` + `003` exceptions columns; this mapping is the fiddliest part (note issue #8's server-side expansion landed in `aa80d58` — write-back must target masters, not expanded occurrences).
- Effort: realistically 1–2 weeks of agent work with proper tests; the webhook + renewal + echo-suppression state machine is where the time goes.
- New env vars beyond (b): none strictly (`GOOGLE_WEBHOOK_SECRET` optional if not per-channel), but requires the SPA-fallback/vercel deploy from #25 to exist first — webhooks need a public HTTPS prod URL.

### Recommendation

Ship #25 first (nothing in #27 is testable end-to-end without a public URL + real Google creds). For #27, build (a) with the (b)-ready schema (store the refresh token and the external-id mapping from day one — it costs one migration and removes rework), then decide on (b)/(c) after using the import. File the redirect-URI-ignored-in-POST-body observation and the missing SPA fallback rewrite as GitHub issues per the standing log-issues rule.

### Quick-reference commands

```bash
# migrations status / apply (local docker must be up: npm run docker:up)
npm run db:migrate:status
npm run db:migrate
# against Neon
DATABASE_URL='postgres://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require' npm run db:migrate

# vercel (already authed as shreebatsachaturvedi-8125, CLI 51.2.1)
vercel link --yes
vercel env add DATABASE_URL production
vercel --prod

# dev (project rule: vite on 5180, API dev server on 3001)
npx vite --port 5180 --strictPort
npm run dev:api
```
