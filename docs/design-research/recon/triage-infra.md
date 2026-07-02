# Triage dossier: issues #13, #21, #22, #23, #24 — taskflow-calendar

Recon date: 2026-07-01. Branch: `finish-polish-deploy` at `3d6b329`, **ahead of origin by 25 commits (not pushed)**.
Repo: https://github.com/ShreeChaturvedi/taskflow-calendar
All paths relative to `/home/shree/dev/taskflow-calendar` unless absolute.
Raw test logs (kept):

- `/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/backend-test-run.log`
- `/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/frontend-test-run.log`

## TL;DR verdicts

| Issue                         | Verdict                                                                                                                                          | Remaining work                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| #13 RBAC placeholder          | **Already fixed** on branch (commit `7747e37`, merged via wf-g8-rbac)                                                                            | Close on merge. Optional nit: tokens never carry the role claim (DB fallback used) |
| #21 111 failing backend tests | **Already fixed** (commit `8673eb4`). Verified live: 516/516 pass, 0 fail                                                                        | Workspace DB suite re-verify happens in CI; README counts → #23                    |
| #22 dead code + workspaces    | **Issue is partially WRONG**: `packages/shared` is live (57 frontend importers). Rest of kill-list verified dead + 1 extra dead file found       | ~1–2h execution with the corrected kill-list below                                 |
| #23 README claims             | Verified item-by-item; several issue bullets now stale (CI exists, db:migrate works), plus 6 false claims the issue missed                       | ~1h README edit after #22 lands (counts shift)                                     |
| #24 no CI                     | **Already implemented** (commit `11f5c15`, `.github/workflows/ci.yml`) but never run (branch unpushed). 5 gaps found incl. NO typecheck anywhere | Small tweak commit + branch protection command                                     |

Standing rule reminder (project memory): any NEW bug found gets filed as a `gh issue`. New findings here that are not covered by existing issues: the missing-typecheck gap (#24 scope, can fold in) and the express/cors hoisting trap (#22 scope, fold in). Update the issue bodies rather than filing dupes.

---

## Issue #13 — requireRole placeholder (OPEN, but FIXED on branch)

### Evidence it is fixed (current working tree)

- `lib/middleware/auth.ts:156-178` — `requireRole(role)` now throws `ForbiddenError("Requires '<role>' role")` when `userRole !== role && userRole !== 'ADMIN'`. ADMIN is a superuser (line 172). Role comes from `req.user.role` (JWT claim) with a DB fallback `fetchUserRole()` (`lib/middleware/auth.ts:22-28`: `SELECT "role" FROM users WHERE id = $1`, default `'USER'`).
- Migration exists and is applied: `lib/config/migrations/008_user_roles.sql` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'USER';`. `npm run db:migrate:status` against dev DB shows all 8 migrations applied (verified 2026-07-01).
- JWT support: `packages/backend/src/utils/jwt.ts:52-55` adds optional `role` to the access-token payload; `generateAccessToken(userId, email, role)` at line 70; `generateTokenPair(..., role?)` at line 115-121.
- Tests: `lib/middleware/__tests__/auth.test.ts:285-350+` — `describe('requireRole')` covers: 401 when unauthenticated, pass when role matches, `ForbiddenError` on mismatch, ADMIN satisfies any role. All 27 tests in that file pass (part of the green backend run below).
- `devAuth` injects `role: 'ADMIN'` for the dev user (`lib/middleware/auth.ts:142`).
- Fix commit: `7747e37 feat(auth): enforce real roles in requireRole middleware (#13)`.

### Residual nits (not blockers)

1. **No caller ever mints a role into tokens.** All four minting sites call `generateTokenPair(user.id, user.email)` with no third arg: `packages/backend/src/services/AuthService.ts:86,141`, `GoogleOAuthService.ts:252`, `RefreshTokenService.ts:103`. So every real token lacks the role claim and `requireRole` does one DB query per request (fallback path). Functionally correct; perf/design nit only. Fix = have AuthService/RefreshTokenService pass the user's role (they already fetch the user row).
2. **No route uses `requireRole` yet** (`rg -ln requireRole api lib scripts` → only `lib/middleware/auth.ts` and the migration comment). That is fine: acceptance option A ("enforces real roles") is met; the middleware no longer lies.

### Action

Close #13 with a comment pointing at `7747e37` once `finish-polish-deploy` is pushed/merged. Optionally fold nit 1 into the close-out or a follow-up. Effort: 0 (or ~20 min for nit 1 + test).

---

## Issue #21 — 111 failing backend integration tests (OPEN, but FIXED; verified live)

### Live verification (run 2026-07-01 on current tree)

```
npm run test:backend:run     # vitest run --config vitest.backend.config.ts
→ Test Files  20 passed (20)
→ Tests       516 passed (516)   # 0 failures, 3.35s, NO database needed
```

Full log: `/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/backend-test-run.log`

### Root cause (confirmed exactly as issue diagnosed)

- Pipeline: `lib/utils/apiHandler.ts:18` imports `{ devAuth, authenticateJWT }`; line 43-44 inserts `devAuth()` in non-prod, line 58 pushes `authenticateJWT()` when `requireAuth` is set. Tests mocked only `devAuth`, so the real `authenticateJWT` 401'd every request before the mocked service was reached ("Number of calls: 0").
- Fix commit: `8673eb4 test(backend): fix 111 failing integration tests (auth-mock drift) (#21)` — touched the 5 integration suites + the e2e suite (178 insertions/135 deletions). Pattern now (e.g. `api/calendars/__tests__/calendars.integration.test.ts:67-74`):

```ts
vi.mock('../../../lib/middleware/auth.js', async (importOriginal) => {
  ...
  devAuth: () => (_req, _res, next) => next(),
  authenticateJWT: () => (_req, _res, next) => next(),  // pass-through, does NOT inject a user
});
```

The pass-throughs deliberately do not set `req.user`, so unauthenticated-case tests still 401 via the handler's own check.

### Repair-strategy question (asked by triage): answered

"Fix mocks" was the right call and is already done. No harness rewrite, no dev-server integration testing needed. The suite is fully self-contained (no DB), fast (3.4s), and green.

### Remaining acceptance items

1. Workspace suite `npm run test:run --workspace=packages/backend`: **not re-run in this recon.** Its `comprehensive-requirements.test.ts` teardown `cleanupDatabase()` (`packages/backend/src/test/comprehensive-requirements.test.ts:290-300`) issues `DELETE FROM` on every table — destructive against the shared dev DB (`react_calendar_dev`), and creating a scratch DB in the postgres container was denied by the recon sandbox. Commit `8673eb4`'s message records it green ("67 passed") once the schema is migrated, and the dev DB now has all 8 migrations applied. The CI `backend-db` job (see #24) runs exactly this suite against a disposable `postgres:16` service container — first pushed CI run is the verification.
   - To verify locally without touching dev data: `docker exec react-calendar-postgres psql -U postgres -c 'CREATE DATABASE react_calendar_test;'` then `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_test npm run db:migrate` then `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_test npm run test:run --workspace=packages/backend` (setup honors `TEST_DATABASE_URL`: `packages/backend/src/test/setup.ts:40-41`).
2. README test counts → tracked in #23 (numbers below).

### Action

Close #21 on merge (commit message already says "Closes #21 when the finish-polish-deploy PR merges"). Effort remaining: 0 locally; confirm the `backend-db` CI job goes green on first push.

---

## Issue #22 — dead code + workspaces config (OPEN; issue text needs corrections)

### CRITICAL correction: `packages/shared` is NOT dead

The issue says "Nothing live imports `@react-calendar-app/shared`" and proposes removing `packages/shared/`. **Removing it breaks the frontend build.** The frontend imports it via the `@shared` alias, which points at `packages/shared/src`:

- Alias definitions: `vite.config.ts:20-21`, `vitest.config.ts:12-13`, `tsconfig.json:15`, `tsconfig.app.json:28`, `api/tsconfig.json:19`; project reference `tsconfig.json:6`.
- **57 files under `src/` import `@shared/...`** (verified `rg -l "from ['\"]@shared" src | wc -l` → 57). Breakdown: `@shared/types` ×52, `@shared/config/fileTypes` ×6, `@shared/utils` ×2. Examples: `src/hooks/useTasks.ts:6`, `src/hooks/useEvents.ts:8`, `src/services/api/tasks.ts`, `src/utils/validation.ts`.
- Its test suite is real and green: `npm run test:run --workspace=packages/shared` → 4 files / 22 tests passed (verified 2026-07-01).
- Root `build` script depends on it: `package.json:18-19` (`build:shared` runs first).

What IS true: the **package-name** import `@react-calendar-app/shared` is used by nothing — the only reference is the dependency entry `packages/backend/package.json:15`. Safe to delete that dependency edge only.

### Verified KEEP-list (live importers traced)

| File                                                                                 | Live importers                                                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/` (entire package)                                                  | 57 files in `src/` via `@shared` alias (above)                                                                                   |
| `packages/backend/src/services/AuthService.ts`                                       | `api/auth/login.ts`, `register.ts`, `logout.ts`, `refresh.ts`, `change-password.ts`, `scripts/dev-server.ts:32` (6 import sites) |
| `packages/backend/src/services/UserService.ts`                                       | `api/auth/me.ts`, `api/user/index.ts`, `profile.ts`, `export.ts`, `preferences.ts` (5 sites)                                     |
| `packages/backend/src/services/RefreshTokenService.ts`                               | `api/auth/refresh.ts`, `logout.ts`, `scripts/dev-server.ts:33`, `scripts/smoke-refresh.ts` (5 sites)                             |
| `packages/backend/src/services/GoogleOAuthService.ts`                                | `api/auth/google/index.ts`, `verify.ts`, `callback.ts` (4 sites)                                                                 |
| `packages/backend/src/utils/jwt.ts`                                                  | `lib/middleware/auth.ts:7-10`, `api/auth/*`, `scripts/smoke-refresh.ts:6` (6 sites)                                              |
| `packages/backend/src/config/database.ts`                                            | all 4 services above + `scripts/smoke-refresh.ts`                                                                                |
| `packages/backend/src/scripts/seed.ts`                                               | root `db:seed` → workspace `db:seed` → `node dist/scripts/seed.js` (`packages/backend/package.json:12`)                          |
| `packages/backend/src/test/*`, `services/__tests__/*`, `utils/__tests__/jwt.test.ts` | the workspace test suite (CI backend-db job)                                                                                     |

`TokenBlacklistService` — already deleted from the tree (issue noted this; confirmed `find . -name "TokenBlacklist*"` → nothing).

### Verified KILL-list (zero importers, checked with rg across src/, lib/, api/, scripts/, packages/)

1. `packages/backend/src/utils/requestContext.ts` — only match for "requestContext" is the file itself.
2. `packages/backend/prisma/schema.prisma` (and the `prisma/` dir) — no `prisma` entry in `packages/backend/package.json` deps; Prisma not installed. (Issue offers "keep as docs" — owner's call; README already documents "Why Pure SQL over Prisma", so keeping it is redundant.)
3. `src/components/tasks/TaskItemDemo.tsx` — no importers.
4. `src/components/smart-input/components/EnhancedLayoutDemo.tsx` — no importers.
5. `src/components/calendar/ConsolidatedCalendarHeaderDemo.tsx` + `src/components/calendar/__tests__/ConsolidatedCalendarHeaderDemo.test.tsx` — only the test imports the demo. **Removal drops the frontend suite from 58 files/634 tests to 57/630** (the test contributes 4 passing tests) — coordinate with #23 counts.
6. **NEW, not in the issue:** `src/components/smart-input/components/HighlightedTextareaDemo.tsx` — zero importers (same demo pattern; verified `rg -ln "\bHighlightedTextareaDemo\b"` → nothing outside itself).
7. `lib/examples/apiRouteExample.ts` — zero importers.
8. Root `package.json:11` — drop `"apps/*"` from `workspaces` (no `apps/` dir exists).
9. Dead deps in `packages/backend/package.json`: `helmet`, `morgan`, `express-rate-limit`, `@react-calendar-app/shared` (dep edge only, see above), devDeps `nodemon`, `ts-node`, `@types/morgan` — the Express server they served was removed in `b3a6db2`. Verify each with `rg` before deleting.

### GOTCHA: express + cors are dead-looking but load-bearing via hoisting

`scripts/dev-server.ts:29-30` does `import express from 'express'; import cors from 'cors';`. Neither is in the ROOT `package.json` — they resolve only because npm hoists them from `packages/backend/package.json:17-18` into root `node_modules/`. **If you remove express/cors from packages/backend without adding them to root devDependencies, `npm run dev:api` breaks after the next fresh install.** Fix: move `express`, `cors`, `@types/express`, `@types/cors` to root `devDependencies` in the same commit.

### Acceptance for #22 (revised)

- [ ] Kill-list items 1–8 removed; `packages/shared` explicitly KEPT (update the issue body).
- [ ] express/cors relocated to root devDependencies (or left in packages/backend with a comment).
- [ ] `npm run build`, `npm run lint`, `npm run test:frontend:run`, `npm run test:backend:run`, `npm run test:run --workspace=packages/shared` all green after removal.
- [ ] README counts updated for the 57/630 frontend shift (#23).

Effort: ~1–2h including verification runs.

---

## Issue #23 — README claims vs reality (OPEN; several issue bullets themselves stale)

File: `README.md`. Verified line-by-line 2026-07-01. Real test numbers measured this recon:

- Frontend: **58 files / 634 tests, all passing** (`npm run test:frontend:run`, log kept). Becomes 57/630 after #22 removes the demo test.
- Backend root suite: **20 files / 516 tests, all passing** (`npm run test:backend:run`).
- packages/shared: **4 files / 22 tests, all passing** (verified live).
- packages/backend workspace: **67 tests passing** per commit `8673eb4` message (not re-run locally; CI verifies).
- Grand total: **86 files / 1239 tests** (pre-#22-removal).

### FALSE / stale claims (fix these)

| Line       | Claim                                                             | Reality                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------ |
| 21         | badge `tests-738 passing`                                         | 1239 passing (see above); regenerate badge                                                                                                                                                                                                          |
| 40         | "738 tests across frontend, backend, and integration suites"      | 1239                                                                                                                                                                                                                                                |
| 335–340    | Coverage table: Backend 5 files/82 cases, Total 67/738            | Backend root 20/516 + workspace 4/67; Frontend 58/634 ✓ correct; Shared 4/22 ✓ correct; Total 86/1239                                                                                                                                               |
| 167        | Rate limit "read: 100/min, write: 30/min"                         | Actual (`lib/middleware/rateLimit.ts:159-190`): auth 5/15min, api 100/15min, read 200/15min, write 50/15min, upload 10/hour                                                                                                                         |
| 284        | "Caching: In-memory with TTL, Redis (local dev)"                  | Redis is provisioned in docker-compose but NOTHING uses it — only placeholders `lib/config/env.ts:8` (optional REDIS_URL) and `lib/config/api.ts:74-76` ("will be used in task 12.1"). Drop the Redis claim (or drop Redis from docker-compose too) |
| 302–304    | Bundle sizes "Core ~180KB, Calendar ~120KB, NLP ~150KB"           | Current `dist/assets`: index 232K, calendar 268K, nlp 392K, emoji 464K, pdf 380K. Re-measure or delete the numbers                                                                                                                                  |
| 379        | `git clone https://github.com/yourusername/taskflow-calendar.git` | `ShreeChaturvedi/taskflow-calendar`                                                                                                                                                                                                                 |
| 395        | "API at `http://localhost:3000`"                                  | Dev API is port **3001** (`scripts/dev-server.ts:42` `PORT                                                                                                                                                                                          |     | 3001`; `vite.config.ts:121`proxies`/api` → 3001) |
| 403        | `.env.local` example `DATABASE_URL=...localhost:5432/calendar`    | Actual dev DB is `react_calendar_dev` (docker-compose.yml POSTGRES_DB; `dev:api` script hardcodes it, `package.json:16`)                                                                                                                            |
| 457        | `packages/backend/  # Express server`                             | Express layer removed in `b3a6db2`; it is now auth/user services + jwt utils consumed by the serverless `api/**`                                                                                                                                    |
| 50, 63, 93 | `<!-- GIF placeholder: ... -->` ×3                                | Still unfilled; add GIFs or delete the placeholder `<p>` blocks                                                                                                                                                                                     |

### Claims the ISSUE flags that are now RESOLVED on this branch (no README change needed, or issue-comment-worthy)

- Line 285 "CI/CD: GitHub Actions" — **now true**: `.github/workflows/ci.yml` exists (commit `11f5c15`). Was false when the issue was filed.
- Line 389 `npm run db:migrate` — **now works**: `scripts/migrate.ts` exists; `npm run db:migrate:status` shows migrations 001–008 applied.

### Verified-TRUE claims (leave alone)

- Line 244 "10 strategic indexes" — `lib/config/migrations/002_performance_indexes.sql` has exactly 10 `CREATE INDEX`.
- Frontend 58/634 and Shared 4/22 rows in the table (until #22 changes frontend to 57/630).

### Minor consistency nits

- `package.json:7` engines `"node": "20.x"` + README line 272 "Node.js 20" vs CI `node-version: 22` (ci.yml:23,65) — align (see #24).
- docker-compose `postgres:15-alpine` + README "PostgreSQL 15" vs CI `postgres:16` — align to one major version.

### Sequencing

Do #23 LAST: after #22 (counts shift to 57/630 frontend) and after the first green CI run (so the CI claim and badge are honest). Effort: ~1h.

---

## Issue #24 — CI pipeline (OPEN, but ALREADY IMPLEMENTED on branch; gaps found)

### What exists (commit `11f5c15`, file `.github/workflows/ci.yml`, 73 lines)

- Triggers: `push: branches [main]` + all `pull_request`. Concurrency group cancels superseded runs.
- Job `checks` ("Lint, tests (no DB), build"): checkout → setup-node 22 + npm cache → `npm install --legacy-peer-deps` → `npm run lint` → `npm run test:frontend:run` → `npm run test:backend:run` → `npm run build`.
- Job `backend-db` ("Backend DB suite"): `postgres:16` service container (user/pass postgres, db `react_calendar_test`, health-checked), env `DATABASE_URL` + `TEST_DATABASE_URL` → `react_calendar_test`, `JWT_SECRET` set → `npm run db:migrate` → `npm run test:run --workspace=packages/backend`.
- This matches the issue's proposed shape (install, lint, build, both suites, postgres service). **It has never run** — the branch is 25 commits ahead of origin, unpushed.

### Gaps vs the issue's acceptance criteria (fix in a small follow-up commit)

1. **No typecheck step, and `npm run build` does NOT typecheck the app.** `build:frontend` is plain `vite build` (`package.json:20`) — esbuild strips types without checking them. Only `packages/shared` and `packages/backend` get `tsc` via their build scripts. Add to the `checks` job:
   ```yaml
   - name: Typecheck
     run: npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit
   ```
   (Verify locally first — this has never been enforced, so there may be existing errors to fix.)
2. **`packages/shared` tests never run in CI.** 22 fast tests, no DB. Add to `checks`: `npm run test:run --workspace=packages/shared`.
3. **Node version mismatch:** ci.yml uses node 22; `package.json:6-7` engines says `20.x`; README says Node 20. Pick one (20 is what Vercel serverless targets per README) and align all three.
4. **Postgres major mismatch:** CI `postgres:16` vs docker-compose `postgres:15-alpine` (prod is Neon). Harmless but align to 16 or 15 everywhere.
5. **Branch protection not configured** (verified: `gh api repos/ShreeChaturvedi/taskflow-calendar/branches/main/protection` → 404 "Branch not protected"). After the first CI run reports check names, run:
   ```bash
   gh api -X PUT repos/ShreeChaturvedi/taskflow-calendar/branches/main/protection \
     -H "Accept: application/vnd.github+json" \
     -f 'required_status_checks[strict]=true' \
     -f 'required_status_checks[contexts][]=Lint, tests (no DB), build' \
     -f 'required_status_checks[contexts][]=Backend DB suite' \
     -F 'enforce_admins=false' -F 'required_pull_request_reviews=null' -F 'restrictions=null'
   ```
   (Contexts must match the job `name:` fields exactly; confirm from the first run's check names. `restrictions`/`required_pull_request_reviews` need `-F ...=null` JSON nulls — if the f-flag form fights you, use `--input` with a JSON body.)
6. `npm run build:shared` before lint/tests (issue asked for it): not needed — lint and the vitest configs resolve `@shared` from source via aliases (`vitest.config.ts:12`), and `npm run build` runs `build:shared` first anyway. Note this in the issue when closing.

### Acceptance check (issue's list vs reality)

- [x] Workflow exists under `.github/workflows/` (ci.yml)
- [x] Runs on PRs and pushes to main
- [~] install/lint/build/frontend+backend suites — yes; `build:shared` implicit; **typecheck missing** (gap 1); shared workspace tests missing (gap 2)
- [x] Postgres service container for DB tests
- [x] Failing steps fail the run
- [ ] Branch protection blocking merges — NOT configured (gap 5)

Effort: ~30 min for the tweak commit (plus fixing whatever `tsc --noEmit` surfaces, unknown), 5 min for branch protection after first run.

---

## Cross-cutting execution order (proposal)

1. Push `finish-polish-deploy` (or open the PR) — triggers first CI run, verifies the `backend-db` job (#21's last unverified leg) and #24's pipeline for real.
2. #24 tweaks: typecheck step (fix any surfaced errors), shared-workspace tests, node/postgres version alignment. Then branch protection.
3. #22 with the corrected kill-list (KEEP packages/shared; express/cors hoisting fix). Re-run all suites.
4. #23 README rewrite with final numbers (57/630 frontend post-#22, 20/516 backend root, 4/22 shared, 4/67 backend workspace) and all false claims from the table above.
5. Close #13 and #21 with evidence comments (commits `7747e37`, `8673eb4`).

## Commands used (reproducible)

```bash
npm run test:backend:run                                   # 516/516 green, no DB
npm run test:frontend:run                                  # 634/634 green
npm run test:run --workspace=packages/shared               # 22/22 green
npm run db:migrate:status                                  # 001–008 all applied (dev DB)
rg -l "from ['\"]@shared" src | wc -l                      # 57 live importers of packages/shared
rg -o "packages/backend/src/[A-Za-z0-9_/.-]+" api lib scripts --no-filename | sort | uniq -c
gh api repos/ShreeChaturvedi/taskflow-calendar/branches/main/protection   # 404 = unprotected
```

NOT run: `npm run test:run --workspace=packages/backend` (needs real Postgres; teardown `DELETE FROM` all tables would wipe `react_calendar_dev`; scratch-DB creation denied by recon sandbox — CI covers it).
