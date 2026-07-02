# Triage: issues #6, #7, #10 (auth) — taskflow-calendar

Recon date: 2026-07-01. Branch: `finish-polish-deploy`, HEAD `3d6b329`. All code citations verified against the CURRENT working tree, not issue text.

## Verdict table

| Issue | Title                                                 | State on GitHub | Verdict                                                                                                                             | Fixing commit                                         |
| ----- | ----------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| #6    | Auth guard calls non-existent `/api/auth/verify`      | OPEN            | **ALREADY-FIXED** (E2E-verified per issue comment)                                                                                  | `ad3019d` (+ `3d6b329` follow-up)                     |
| #7    | Google OAuth code exchange posts to unrouted endpoint | OPEN            | **ALREADY-FIXED** (routing + response shape; full Google E2E blocked on real credentials)                                           | `ad3019d`                                             |
| #10   | Password reset flow not implemented                   | OPEN            | **ALREADY-FIXED** (full implementation merged; residual: prod email config = owner decision, tests = MEDIUM, link base URL = QUICK) | `0b3a5ea` (merged via `6e1ef8a` wf-g4-password-reset) |

No issue here needs a from-scratch fix plan. Residual work is listed per issue below.

---

## Issue #6 — ALREADY-FIXED

**Fix commit:** `ad3019d` "fix(auth): make JWT login persist (#6) and route Google code exchange (#7)" (2026-06-26). Follow-up `3d6b329` "fix(auth): correct createApiHandler shape in /api/auth/me" (2026-06-26).

**Current code proving it:**

- `/home/shree/dev/taskflow-calendar/src/services/api/auth.ts:286-327` — `verifyToken()` now fetches `GET ${this.baseURL}/me` (line 294, baseURL = `/api/auth`), maps 200 → `{ valid: true, user }` reading the user **flat under `data`** (line 309: `const u = data?.data;` — /me does NOT nest under `data.user`), non-ok → `{ valid: false }` (line 302). Picture falls back to `u.profile?.avatarUrl` (line 320). No reference to `/verify` remains anywhere in the client.
- `/home/shree/dev/taskflow-calendar/api/auth/me.ts:43-55` — returns `{ success, data: { id, email, name, createdAt, profile } }`, `requireAuth: true` via `createApiHandler` (shape corrected in `3d6b329`).
- `/home/shree/dev/taskflow-calendar/src/hooks/useAuthGuard.ts:139-140` — consumer unchanged: `verification.valid` gates clearJWTAuth. Correct now that verifyToken works.
- Dev-server parity (was a local-testing trap): `/home/shree/dev/taskflow-calendar/scripts/dev-server.ts:979` — `GET /api/auth/me` now extracts the bearer, `verifyToken(token)`, rejects non-`access` token types, returns the real DB user (previously returned hardcoded `dev-user-id`).

**Verification already done** (per owner comment on #6 and memory): real-browser E2E on Vite 5180 + dev API 3001 + Docker Postgres — signup → lands in app, reload stays authenticated, `GET /api/auth/me → 200`, invalid token → 401 → `{valid:false}`, logout/login cycle clean.

**What justifies closing:** merge of the `finish-polish-deploy` PR (the issue comment already says "Closing when the PR merges") plus one prod smoke after deploy: log in on the Vercel deployment, hard-reload, confirm still authenticated and network tab shows `GET /api/auth/me → 200` with no `/api/auth/verify` request. Nothing else to do locally.

---

## Issue #7 — ALREADY-FIXED (code-complete; E2E blocked on credentials)

**Fix commit:** `ad3019d` (chose Option A from the issue: add POST handler).

**Current code proving it:**

- `/home/shree/dev/taskflow-calendar/api/auth/google/index.ts:57-132` — `POST /api/auth/google` exists via `createMethodHandler`. Reads `{ code }` from body (line 70; 400 `MISSING_AUTH_CODE` if absent), 503 `GOOGLE_OAUTH_NOT_CONFIGURED` when unconfigured (lines 59-68), runs `googleOAuthService.handleCallback(code)` (line 84), returns:
  ```
  data: {
    user: { id, email, name, picture: authResult.user.avatarUrl },
    googleTokens: { accessToken, refreshToken, expiresAt },  // the APP JWT pair, not Google tokens
    isNewUser
  }
  ```
  (lines 86-107). `googleTokens` deliberately carries the app JWT pair so `getValidAccessToken()` yields a valid app bearer for Google sessions.
- `/home/shree/dev/taskflow-calendar/src/pages/GoogleCallback.tsx:37-44` — reads `response.data`, destructures `{ googleTokens, user }`, calls `setGoogleAuth(googleTokens, ...)`. Shape matches the handler exactly.
- `/home/shree/dev/taskflow-calendar/src/services/api/auth.ts:257-284` — `googleAuth()` POSTs `{ code, redirectUri }` to `/api/auth/google`. (Server ignores `redirectUri` from the body; see caveat.)
- Dev-server parity: `scripts/dev-server.ts:1022` (`GET /api/auth/google`) and `:1044` (`POST /api/auth/google`), mirroring the serverless handler.

**Verified so far:** `POST /api/auth/google` is routed — returns `503 GOOGLE_OAUTH_NOT_CONFIGURED` instead of 404 (per issue comment). Full browser E2E impossible without real Google credentials.

**Caveats (documented in the issue comment, tracked in #27):**

1. Redirect-URI consistency is an env contract, not code: the client builds the auth URL itself (`src/services/api/auth.ts:428-439`, `getGoogleAuthUrl()` using `VITE_GOOGLE_CLIENT_ID`, redirect_uri = `${origin}/auth/google/callback`). Google's token exchange requires the SAME redirect_uri, so the backend env `GOOGLE_REDIRECT_URI` must be set to exactly `https://<prod-domain>/auth/google/callback`. The POST body's `redirectUri` field is ignored server-side.
2. No refresh path for Google sessions (app JWT in `googleTokens` will expire; follow-up in #27).

**What justifies closing:** the routing/shape defect that #7 describes is gone; acceptance criteria "no request hits an unrouted method or path" and "fields map onto setGoogleAuth" are met in code. Owner's own comment: "Routing/shape closed when the PR merges; leaving open until verified with real Google credentials." So: close on PR merge + one real-credential E2E (needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `VITE_GOOGLE_CLIENT_ID` set), or re-scope the credential E2E into #27 and close #7 as code-complete. **Owner decision:** whether Google sign-in is launch-blocking (provisioning a Google OAuth client is owner-only).

---

## Issue #10 — ALREADY-FIXED (implementation complete; NOT yet commented on GitHub)

**Fix commit:** `0b3a5ea` "feat(auth): implement password reset flow (#10)" (2026-06-26), merged via `6e1ef8a` (wf-g4-password-reset). **Note: issue #10 has ZERO comments** — unlike #6/#7, no fix comment was ever posted. Per the project standing rule (log-issues-to-github memory), post one citing `0b3a5ea` after verification.

### Current code (all present in working tree)

| Piece             | File                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Detail                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration         | `/home/shree/dev/taskflow-calendar/lib/config/migrations/005_password_reset_tokens.sql`                                                                                                                                                                                                                                                                                                                                                                         | `password_reset_tokens(id, "userId" FK→users ON DELETE CASCADE, "tokenHash", "expiresAt", "usedAt", "createdAt")`, unique index on `tokenHash`. Idempotent. Runner `scripts/migrate.ts` applies `lib/config/migrations/*.sql` in lexical order, records in `schema_migrations` — 005 is picked up automatically by `npm run db:migrate`.                                 |
| Request           | `/home/shree/dev/taskflow-calendar/packages/backend/src/services/AuthService.ts:246-271`                                                                                                                                                                                                                                                                                                                                                                        | `requestPasswordReset(email)`: case-insensitive user lookup, **silent return when email unknown** (line 254), 32-byte random token (`generateSecureToken`, line 328), stores **SHA-256 hash only** (`hashToken`, line 336), TTL `RESET_TOKEN_TTL_MS = 60*60*1000` (line 8, 1 hour).                                                                                      |
| Confirm           | `AuthService.ts:278-323`                                                                                                                                                                                                                                                                                                                                                                                                                                        | `confirmPasswordReset(token, newPassword)`: lookup by hash `FOR UPDATE` **inside `withTransaction`** (single-use race-safe), throws `INVALID_RESET_TOKEN` / `RESET_TOKEN_USED` / `RESET_TOKEN_EXPIRED`, bcrypt-hashes new password, marks `usedAt = NOW()`.                                                                                                              |
| Email             | `AuthService.ts:345-393`                                                                                                                                                                                                                                                                                                                                                                                                                                        | `sendPasswordResetEmail`: raw `fetch` POST to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`, `from: FROM_EMAIL`, HTML + text bodies. **Fallback when either env is unset: `console.log('[password-reset] Reset link for ${email}: ${resetLink}')`** (line 360). Send failures are swallowed (logged) so the API response stays generic. |
| API routes        | `/home/shree/dev/taskflow-calendar/api/auth/forgot-password.ts` (POST, zod email validation, ALWAYS 200 with generic "If an account exists..." message — never reveals registration, even on internal error); `/home/shree/dev/taskflow-calendar/api/auth/reset-password.ts` (POST, zod password policy: min 8 + upper + lower + digit, maps the three token errors to 400 with one generic "invalid or expired" message).                                      |
| Dev-server parity | `scripts/dev-server.ts:872` (forgot-password), `:898` (reset-password).                                                                                                                                                                                                                                                                                                                                                                                         |
| Client            | `/home/shree/dev/taskflow-calendar/src/services/api/auth.ts:363-425` — `requestPasswordReset()` / `confirmPasswordReset()`.                                                                                                                                                                                                                                                                                                                                     |
| Frontend          | `/home/shree/dev/taskflow-calendar/src/pages/ForgotPassword.tsx`, `/home/shree/dev/taskflow-calendar/src/pages/ResetPassword.tsx` (token from `?token=` at line 22, dedicated missing-token state at line 31/90); routes in `src/App.tsx:253` (`/forgot-password`) and `:263` (`/reset-password`), lazy-loaded (lines 25-29); login form link fixed in `src/components/login-form.tsx:53-55, 92-93` (navigates to `/forgot-password`, no more dead `href="#"`). |

**Acceptance criteria from the issue → all satisfied in code:** full flow (request → email/log → confirm → login) implemented; single-use (usedAt + transaction + FOR UPDATE); expiry (1h, checked at confirm); non-revealing response (route always 200 generic, service silently returns); login link wired.

### The two variants the task asked to scope — status

**(a) Real email via Resend — code is DONE, only configuration remains.**

- Mechanism already implemented as a plain HTTPS call (no SDK dependency — `package.json` has no `resend` package and doesn't need one; raw fetch works fine on Vercel Node serverless).
- Env needed (all read via `process.env` in AuthService; declared optional in `lib/config/env.ts:21-22`):
  - `RESEND_API_KEY` — secret, set in Vercel project env.
  - `FROM_EMAIL` — must be a sender Resend will accept: either an address on a **domain verified in Resend** (DNS: SPF + DKIM records), or Resend's test sender `onboarding@resend.dev` which only delivers to the Resend account owner's own email (fine for pre-launch testing, useless for real users).
  - `FRONTEND_URL` — see the base-URL bug below.
- Resend free tier (confirmed 2026-07-01): **3,000 emails/month, 100/day, 1 verified domain, 30-day log retention**. Ample for this app. Sources: [Resend pricing](https://resend.com/pricing), [Resend account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

**(b) Minimal secure fallback — ALSO already implemented and active by default.** When `RESEND_API_KEY`/`FROM_EMAIL` are unset, the reset link is logged server-side (`AuthService.ts:360`). Locally that's the dev-server console; on Vercel it's function logs (`vercel logs` / dashboard), so the owner can hand a link to a user manually. Security properties (hashing, single-use, expiry, non-revealing responses) are identical in both modes. The only degradation: users get the generic "link has been sent" message but no email arrives — acceptable only pre-launch or for an owner-mediated flow.

### Residual work (this is the actual to-do for #10)

1. **QUICK — reset-link base URL is wrong in both prod and dev** (`AuthService.ts:349-351`):
   ```ts
   const baseUrl = process.env.VERCEL_URL
     ? `https://${process.env.VERCEL_URL}`
     : process.env.FRONTEND_URL || 'http://localhost:3000';
   ```

   - On Vercel, `VERCEL_URL` is the deployment-specific generated URL (e.g. `taskflow-calendar-abc123-user.vercel.app`), not the canonical domain — emailed links would point at an immutable deployment. Fix: prefer `FRONTEND_URL` when set (reorder precedence: `FRONTEND_URL || VERCEL_PROJECT_PRODUCTION_URL && https://... || VERCEL_URL && https://... || localhost`). Same precedence bug exists in the helper at `lib/config/env.ts:44-46` (`VERCEL_URL` wins over `FRONTEND_URL`).
   - Locally the default `http://localhost:3000` is wrong for this repo: Vite runs on **5180**. Logged dev links 404 unless `FRONTEND_URL=http://localhost:5180` is set in the dev env.
2. **MEDIUM — zero tests.** `packages/backend/src/services/__tests__/AuthService.test.ts` has no reset coverage; no route tests for forgot/reset-password anywhere (verified by repo-wide grep of `*.test.ts*` for `requestPasswordReset|confirmPasswordReset|password_reset_tokens` — no hits). Tests to add:
   - AuthService unit: unknown email resolves without insert and without throwing; known email inserts a row whose `tokenHash` = sha256(raw token) and `expiresAt` ≈ now+1h; confirm with valid token updates password (bcrypt-compare) and sets `usedAt`; second confirm with same token throws `RESET_TOKEN_USED`; expired token throws `RESET_TOKEN_EXPIRED`; garbage token throws `INVALID_RESET_TOKEN`; `sendPasswordResetEmail` without env logs and does not throw; with env, fetch called with correct Authorization/from/to (mock fetch).
   - Route tests: forgot-password returns 200 + generic message for both known and unknown email (identical body); reset-password 400 on weak password (zod), 400 with generic message for the three token error codes, 200 on success.
3. **VERIFY — the emailed deep link must actually render in prod.** `vercel.json` has NO SPA catch-all rewrite (only `/api/:path*` → itself). If the Vite framework preset doesn't add an index.html fallback, direct navigation to `/reset-password?token=...` (which is exactly how every user arrives — from an email) 404s in production. UNVERIFIED — check on the first deploy; likely fix is adding `{ "source": "/((?!api/).*)", "destination": "/index.html" }` to rewrites. This intersects the deploy runbook in #25.
4. **Nit (defense-in-depth, optional):** forgot-password inherits only the generic `rateLimitPresets.api` limiter (100 req/15min, in-memory per serverless instance — `lib/utils/apiHandler.ts:84-110`, `lib/middleware/rateLimit.ts:168`). The stricter `auth` preset (5/15min) exists but isn't applied, and in-memory state resets on cold start, so email-bombing is only weakly mitigated. Fine for launch; note it.
5. **Process:** post the fix comment on #10 (cite `0b3a5ea`, list the E2E evidence once run) — the standing log-issues-to-github rule; #6 and #7 got comments, #10 didn't.

### E2E verification runbook (what justifies closing #10)

```bash
# 1. DB + migration (005 must show as applied)
docker compose up -d                       # repo docker-compose.yml → Postgres :5432
npm run db:migrate                         # or: npx tsx scripts/migrate.ts
npx tsx scripts/migrate.ts --status        # expect 005_password_reset_tokens.sql applied

# 2. Servers (ports per project rules)
npx tsx scripts/dev-server.ts              # API :3001
npx vite --port 5180 --strictPort          # UI :5180 (/api proxies to 3001)

# 3. Flow (curl variant; browser variant: /login → "Forgot your password?" → email → submit)
curl -s -X POST localhost:3001/api/auth/forgot-password -H 'Content-Type: application/json' \
  -d '{"email":"<registered-user-email>"}'          # expect 200 generic message
# grab the reset link from dev-server stdout: "[password-reset] Reset link for ... token=<TOKEN>"
curl -s -X POST localhost:3001/api/auth/reset-password -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","newPassword":"NewPassw0rd"}'   # expect 200 "has been reset"
# login with the new password → 200; old password → 401
# replay the same token → expect 400 code RESET_TOKEN_USED
# unknown email through forgot-password → byte-identical 200 body as the known-email case
```

Browser check additionally: `/reset-password` with no `?token=` shows the missing-token state (ResetPassword.tsx:90); login page link navigates to `/forgot-password`.

---

## Owner-only decisions (roll up)

1. **Resend account + API key** — owner must create the Resend account and paste `RESEND_API_KEY` into Vercel env (agent drives everything up to the secret-entry moment).
2. **FROM_EMAIL / sending domain** — which domain to verify in Resend (needs DNS access: SPF + DKIM). Interim option: `onboarding@resend.dev`, which only delivers to his own Resend account email.
3. **Canonical `FRONTEND_URL`** — what the production domain will be (needed for correct emailed links; ties into the VERCEL_URL-precedence fix above).
4. **Ship without email?** — is the console-log fallback acceptable at launch (variant b), or is Resend config a launch blocker?
5. **Google OAuth (for closing #7)** — whether Google sign-in is launch-blocking; provisioning `GOOGLE_CLIENT_ID/SECRET` and the OAuth consent screen is owner-only. Otherwise close #7 as code-complete and track the credentialed E2E in #27.

## Sources

- [Resend pricing](https://resend.com/pricing)
- [Resend account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
