# Test Story Audit — taskflow-calendar (branch `finish-polish-deploy`, 2026-07-01)

Repo: `/home/shree/dev/taskflow-calendar`. All counts below are from REAL runs on the current working tree (commit `3d6b329`). Raw logs in this directory:

- `frontend-run.log` — frontend suite
- `backend-run.log` — backend root suite
- `shared-ws-run.log` — packages/shared workspace
- `backend-ws-run.log` — packages/backend workspace (contains the one real failure)
- `comprehensive-realdb-run.log` — same failing suite re-run with a correct DATABASE_URL (passes)

## 1. Headline: the suites are GREEN. Issue #21 is already fixed on this branch.

| Suite            | Command                                            | Result                                                       | Time |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------ | ---- |
| Frontend         | `npx vitest run --config vitest.config.ts`         | **58 files, 634 passed, 0 failed**                           | 49s  |
| Backend root     | `npx vitest run --config vitest.backend.config.ts` | **20 files, 516 passed, 0 failed**                           | 9s   |
| packages/shared  | `npx vitest run` (in workspace)                    | **4 files, 22 passed**                                       | 3.5s |
| packages/backend | `npx vitest run` (in workspace)                    | **42 passed, 25 skipped, 1 suite FAILED** (env only, see §4) | 9.5s |

Total real tests: **1,239** (634 + 516 + 22 + 67). README badge (`README.md:21`) claims "738 passing" — wrong in the other direction now (issue #23 still valid, number needs updating to reality).

Issue #21 ("111 failing integration tests") is **stale against this branch**: the auth-mock drift was fixed — `api/tasks/__tests__/tasks.integration.test.ts:31-42` now mocks BOTH `devAuth` and `authenticateJWT` (with an explanatory comment), and the whole backend root suite passes 516/516. The only surviving piece of #21 is the `comprehensive-requirements` env failure (§4). Issue #24 (CI) is also largely done on-branch: `.github/workflows/ci.yml` exists (commit `11f5c15 ci: add GitHub Actions pipeline (#24)`).

## 2. Inventory

### Configs

- `vitest.config.ts` (frontend): jsdom, globals, setup `src/test/setup.ts`, include `src/**/*.test.{ts,tsx}`, excludes `packages/**`, `api/**`, `lib/**`, `test/**`. Aliases `@`, `@shared`, `@backend`, `@api`, `@lib`.
- `vitest.backend.config.ts` (backend root): node env, include `api/**/*.test.ts` + `lib/**/*.test.ts`, setup `test/backend-setup.ts`, v8 coverage over `api/**` + `lib/**`.
- Workspace packages (`packages/shared`, `packages/backend`) have **no vitest config** — bare `vitest run` with default includes; `packages/backend` has its own setup at `packages/backend/src/test/setup.ts` (loads `.env`, prefers `TEST_DATABASE_URL`).
- No playwright config anywhere.

### npm scripts (root `package.json`)

- `test` = `npm run test --workspaces --if-present` → runs **watch-mode** `vitest` in each workspace. Would hang CI. Trap.
- `test:run` = workspaces `vitest run` (shared + backend workspaces only; NOT root frontend/backend suites).
- `test:frontend` / `test:frontend:run`, `test:backend` / `test:backend:run` / `test:backend:coverage`, `test:ui`.
- `test:all` = `test:run --workspaces` + `test:frontend:run` — **omits `test:backend:run`**. No single script runs all four suites. Script gap.

### Test locations (4 roots, 92 files)

1. `src/**/__tests__` + `src/App.test.tsx` — 58 files, 634 tests (frontend config).
2. `lib/{services,middleware}/__tests__` — 14 files + shared helpers in `lib/__tests__/helpers` (backend config).
3. `api/{tasks,calendars,tags,task-lists,attachments}/__tests__/*.integration.test.ts` + `api/__tests__/task-management.e2e.test.ts` — 6 files (backend config).
4. `packages/shared/src/**/__tests__` (4 files), `packages/backend/src/{services,utils}/__tests__` + `packages/backend/src/test/comprehensive-requirements.test.ts` (4 files).

Setups: `src/test/setup.ts` (jsdom shims), `test/backend-setup.ts` (env vars, console mock, custom matchers — and a `vi.mock('@prisma/client', ...)` at line ~44 that is **dead weight**: the app uses `pg`, Prisma is not a dependency).

## 3. E2E and DB infrastructure

- **No browser E2E at all.** `@playwright/test` is not installed (`node_modules/@playwright` absent, not in any package.json), no `playwright.config.*`, no `e2e/` dir. The file named `api/__tests__/task-management.e2e.test.ts` (679 lines, 13 tests) is a fully mocked vitest file — "e2e" in name only.
- **docker-compose.yml** provides `postgres:15-alpine` on 5432 (db `react_calendar_dev`, user/pass `postgres/postgres`, init from `docker/postgres/init.sql`), plus redis and optional pgadmin. Container `react-calendar-postgres` was up and healthy during this audit.
- **Exactly ONE suite touches a real Postgres**: `packages/backend/src/test/comprehensive-requirements.test.ts` (25 tests — registration/login SQL, schema/relationship checks, token refresh, cross-user access control). Everything else mocks the DB layer.
- CI (`.github/workflows/ci.yml`) already has two jobs: `checks` (lint, frontend tests, backend root tests, build — no DB) and `backend-db` (Postgres 16 service, `npm run db:migrate`, backend workspace suite with `TEST_DATABASE_URL`). CI on node 22 while `package.json engines` says `20.x` — minor mismatch.

## 4. The one real failure (env, not code)

`npm run test:run --workspace=packages/backend` fails locally:

```
FAIL src/test/comprehensive-requirements.test.ts
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
  cleanupDatabase src/test/comprehensive-requirements.test.ts:291
```

Root cause: `packages/backend/src/config/database.ts:5-7` defaults to `postgresql://localhost:5432/react_calendar_dev` — **no username/password**, so `pg` sends an undefined password. The 25 tests get "skipped" because `beforeAll` dies.

Proof it's env-only: re-run with the docker credentials passes 25/25 (`comprehensive-realdb-run.log`):

```
cd packages/backend && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/react_calendar_dev' npx vitest run src/test/comprehensive-requirements.test.ts
# Test Files 1 passed, Tests 25 passed
```

CI is unaffected (sets `TEST_DATABASE_URL`). Fix: default the workspace DB URL to the docker-compose credentials, or document/export `DATABASE_URL` for local runs. This closes the last acceptance box of #21.

## 5. Quality assessment — what the 1,239 tests actually verify

### 5.1 Genuinely good (keep as-is)

- `src/utils/__tests__/` — validation (49), storage (37), date (32), analytics (22): real pure-unit tests of real logic.
- `src/stores/__tests__/` — authStore (21), themeStore (14), uiStore (14): real zustand store behavior.
- `packages/shared` (22) — zod schema tests.
- `packages/backend/src/utils/__tests__/jwt.test.ts` (17) — real sign/verify.
- `packages/backend/src/services/__tests__/AuthService.test.ts` (12) — real bcrypt against mocked SQL (slow, 6s, but honest).
- `packages/backend/src/test/comprehensive-requirements.test.ts` (25) — the only real-DB suite; the model to expand.
- `lib/middleware/__tests__/` validation/cors/rateLimit/errorHandler/requestId (~174) — mostly real middleware logic. Exception: `auth.test.ts` (27) mocks the jwt utils (`lib/middleware/__tests__/auth.test.ts:21`) so it tests wiring only.

### 5.2 Over-mocked: tests that test the mock

- **`lib/services/__tests__/*` (199 tests, 4,899 lines)** — every suite mocks `../../config/database.js` (`query`, `withTransaction`) and the cache (e.g. `TaskService.test.ts:8-27`). They verify the service calls `query` with expected SQL text and maps the rows the test itself fabricated. Real SQL never executes: wrong column names, broken JOINs, constraint violations, bad migrations are all invisible. Open issues #12 (missing `description` column referenced by UI) and #30 (tag removal ignored) are exactly the bug class this layer cannot catch — and both shipped under 199 green service tests.
- **`api/**/**tests**/\*.integration.test.ts`+`task-management.e2e.test.ts` (116 tests, 4,172 lines)** — despite the names, EVERYTHING below the handler is mocked: services (`vi.mock('../../../lib/services/index.js')`), auth (both `devAuth`and`authenticateJWT`pass-through), and even the response helpers`sendSuccess`/`sendError` (`api/tasks/**tests**/tasks.integration.test.ts:20-42`). Assertions are almost entirely `expect(mockService.X).toHaveBeenCalledWith(...)`and`expect(mockSendSuccess).toHaveBeenCalledWith(...)` (44 such calls in calendars, 29 in tasks). Real value retained: query-param parsing/coercion (dates, booleans, filters) and 401-when-no-user routing. No real status codes, no real response bodies, no real auth, no DB.

### 5.3 Tautological / filler (delete candidates)

- `src/components/smart-input/__tests__/SmartTaskInput.enhanced.functionality.test.tsx:74-94` — test named **"parses smart tags in enhanced layout"** types "Complete project tomorrow high priority" then asserts `expect(textarea).toHaveValue('Complete project tomorrow high priority')` — i.e. asserts the text typed is the text typed. The parser result is never inspected. Several siblings in that file are the same shape (lines 50-52, 284-287).
- `src/hooks/__tests__/reactQueryIntegration.test.tsx` (10 tests) — assertions like `expect(result.current.isError || result.current.isPending).toBe(true)` (line 214) and `isSuccess || isPending` (lines 155, 176, 196, 270) **cannot fail**. The file header says "Tests caching, synchronization, and optimistic updates"; it tests none of them.
- Demo filler (10 tests across 4 files): `VoiceInputDebug.demo.test.tsx`, `VoiceInputDemo.test.tsx`, `SmartTaskInput.enhanced.demo.test.tsx`, `ConsolidatedCalendarHeaderDemo.test.tsx` — render a demo harness, assert static headings exist.
- No snapshot tests anywhere (grep for `toMatchSnapshot` = 0). One noise source avoided.
- Frontend mock-call density: 108 `toHaveBeenCalled` vs 1,249 `expect(` — component layer is mostly render-and-assert-text, which is fine but shallow.

### 5.4 Distribution skew

Smart-input owns **26 of 58 frontend files (~230 tests)** — a third of the frontend suite for one input widget, mostly render assertions — while the areas below have zero.

## 6. Critical paths with NO meaningful coverage

1. **`api/auth/*` — ZERO tests.** 9+ handlers (`login.ts`, `register.ts`, `logout.ts`, `me.ts`, `refresh.ts`, `change-password.ts`, `forgot-password.ts`, `reset-password.ts`, `google/{index,callback,verify}.ts`). The most security-critical surface. Evidence of consequence: `3d6b329 fix(auth): correct createApiHandler shape in /api/auth/me` (a handler-shape bug no test caught), issues #6, #7, #10 all lived here.
2. **`api/events/*` — ZERO handler tests** (`index.ts`, `[id].ts`, `conflicts.ts`). `api/calendars/__tests__` covers only `/api/calendars`. Server-side recurrence expansion (`aa80d58`, #8) has only mocked-SQL EventService tests.
3. **`api/user/*` (profile/preferences/export), `api/upload`, `api/health` — ZERO tests.** All new in the g1/g4 merges.
4. **Smart-input parsers — ZERO tests** for `src/components/smart-input/parsers/` (ChronoDateParser 204 lines, CompromiseNLPParser 326, PriorityParser 194, SmartParser 310; 1,041 lines total). No test file anywhere mentions these classes (grep = 0). This is the app's signature feature and the cheapest high-value gap to close: pure functions, chrono-node/compromise-driven, timezone-sensitive.
5. **React Query optimistic updates** — `src/hooks/useTasks.ts` has ~10 mutations with `onMutate`/`cancelQueries`/`setQueryData`/rollback (lines 88-490). `useTasks.test.tsx` (12 tests) only asserts final post-settle results; zero mid-flight cache assertions, zero rollback-on-error tests. `useEvents.ts` (333 lines), `useCalendars.ts` (560 lines), and 11 of 13 hooks (`useAuthGuard`, `useTaskManagement`, `useCalendarManagement`, `useTaskStats`, `useKeyboardShortcuts`, `useSwipeDetection`, ...) have no tests at all.
6. **Calendar rendering and navigation** — `CalendarView.test.tsx:10-48` replaces FullCalendar with a stub div. Nothing verifies the visible date range changes on prev/next/today. **Open issue #32 ("Calendar Next/Previous/Today navigation does nothing") shipped while 4 CalendarView + 8 ConsolidatedCalendarHeader tests passed.** This is the flagship example that the suite verifies wiring, not behavior.
7. **Drag-and-drop** — `TaskKanbanBoard.tsx` (react-dnd) and drag-task-to-calendar: zero tests (grep `useDrag|useDrop|DndContext` in tests = 0).
8. **Auth UI** — `login-form.tsx`, `ProtectedRoute`, `PublicRoute`, `AuthLayout`: zero tests. `App.test.tsx` has 2 smoke tests using a "Mock token detected, skipping backend verification" bypass.
9. **Frontend API client** (`src/services/api/*.ts` — auth, tasks, events, calendars, attachments, user): zero tests; it's mocked away in every hook test.
10. **`scripts/dev-server.ts` (1,252 lines)** — untested Express re-implementation of `api/**`; drift is already a filed bug (#31: missing /api/upload + /api/attachments locally).
11. **Settings components** (8 files, new in g1) and `src/components/forms`: zero tests.

## 7. Proposed testing architecture

Five layers. Guiding principle: today's suite is inverted — heaviest where the code is simplest (render assertions, mocked-SQL echo tests), absent where bugs actually shipped (#6, #7, #12, #29, #30, #32). Shift weight to real-DB and real-browser layers; docker-compose Postgres already exists and CI already has a Postgres service job, so the infrastructure cost is low.

### L1 — Pure unit (vitest, node) — target ~300 tests

- KEEP: `src/utils` (140), stores (49), shared (22), jwt (17), fileTypes configs.
- ADD (top priority, no infra needed): `src/components/smart-input/parsers/__tests__/` — ~60-80 cases: date phrases ("tomorrow 2pm", "next friday", ranges, DST/timezone edges via chrono reference date), PriorityParser keywords, CompromiseNLPParser tag/entity extraction, SmartParser composition + confidence + span offsets (span offsets feed the highlight overlay, a subtle-bug hotspot).
- ADD: `src/services/api/*` client tests against a stubbed `fetch` (URL, method, body, error mapping). ~25 tests.

### L2 — Services vs REAL Postgres (new config, e.g. `vitest.db.config.ts`, include `lib/**/*.db.test.ts` + `packages/backend/**/*.db.test.ts`) — target ~130 tests

- Run against docker-compose Postgres, dedicated `react_calendar_test` DB, `scripts/migrate.ts` in globalSetup, truncate between suites (pattern already proven by `comprehensive-requirements.test.ts`).
- REWRITE the 199 mocked-SQL `lib/services/__tests__` tests down to ~120 real-DB tests: CRUD + ownership isolation per service, task filters/pagination/sort actually executed, **tag add AND remove** (#30 regression), recurrence expansion with real rows (#8/#29 class), archiving (#11), attachment cascade + blob cleanup (#9 class, blob client stubbed).
- KEEP mocked-SQL only for hard-to-trigger error paths (transaction rollback, pool failure) — ~15 tests.
- Migrate `comprehensive-requirements.test.ts` content here; fix the default DB URL so it runs locally out of the box.

### L3 — API handler integration (real handlers + real services + real JWT + real Postgres) — target ~150 tests

- The `api/**` handlers are plain `(req,res)` functions — invoke them directly with a real signed JWT (packages/backend jwt utils) and real DB; assert **actual status codes and response bodies**, not `sendSuccess` mock calls.
- PRIORITY ORDER: `api/auth/*` full flow first (register → login → me → refresh rotation → change-password → forgot/reset → logout; Google endpoints with the OAuth client stubbed at the network boundary) ~50 tests; then events (+conflicts, recurrence expansion through the HTTP shape) ~30; tasks/task-lists/tags/calendars ~50 (port the useful query-param-coercion cases from the current mocked files); user/upload/health ~20.
- REPLACE the 116 mocked "integration"/"e2e" tests with these. Delete or rename the misnamed `task-management.e2e.test.ts`.

### L4 — Component + hook tests (jsdom, RTL) — target ~350 tests (down from 634, up in value)

- KEEP: ui primitives (43), TaskItem/TaskList (32), dialogs (65), layout (28), a consolidated smart-input component set.
- DELETE: 4 demo files (10 tests); tautological cases in `SmartTaskInput.enhanced.functionality.test.tsx`; `reactQueryIntegration.test.tsx` as-is (fold anything real into hook tests).
- CONSOLIDATE smart-input 26 files → ~8 (parsing assertions move to L1; keep interaction/accessibility).
- REWRITE hooks: real QueryClient + mocked api module, but assert optimistic cache state BEFORE the promise resolves and rollback after rejection, for useTasks/useEvents/useCalendars mutations (~30 tests). Add useAuthGuard + useTaskManagement tests (~15).
- ADD: login-form validation/submission/error display, ProtectedRoute/PublicRoute redirects (~15).

### L5 — Browser E2E (Playwright, NEW) — target ~20 scenarios

- Install `@playwright/test` (repo devDep), `e2e/` dir, `playwright.config.ts` with `webServer`: `npx vite --port 5180 --strictPort` + `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_dev npx tsx scripts/dev-server.ts` (port 3001; /api proxies there). Note ports 5173/5174 are occupied locally — 5180 is mandatory.
- Scenarios: register/login/logout + session persistence across reload + token refresh; create task via smart input with a natural-language date and verify the parsed chip AND persisted row; toggle complete; **calendar prev/next/today changes the visible range** (regression for #32); event create/edit/delete; recurring event occurrences visible; drag task onto calendar / kanban drag; tag add+remove round-trip (#30); task-list archive; settings profile update; attachment upload via `setInputFiles` (blocked locally until #31 lands in dev-server — start with it skipped or fix #31 first).
- Known risk to document in the config: dev-server.ts is a re-implementation of api/** (drift, #31). Mitigation later: mount the real `api/**`handlers in a thin Express adapter for E2E, or run`vercel dev`.

### CI (#24) — extend the existing `.github/workflows/ci.yml`

- Job `checks` (exists): lint, L1 + L4 (`test:frontend:run`), build. Move backend mocked run out as L2/L3 replace it.
- Job `backend-db` (exists, Postgres 16 service + migrations): add L2 (`vitest run --config vitest.db.config.ts`) and L3 alongside the workspace suite.
- NEW job `e2e`: Postgres service, migrations + seed, `npx playwright install --with-deps chromium`, start both dev servers, `npx playwright test`; upload trace/screenshot artifacts on failure; cache `~/.cache/ms-playwright`.
- Script fixes: add `test:backend:run` to `test:all`; never let CI call bare `npm test` (workspace watch mode hangs); align CI node 22 vs `engines: 20.x`.

## 8. Keep / rewrite / delete summary

| Action       | What                                                                                               | Tests affected |
| ------------ | -------------------------------------------------------------------------------------------------- | -------------- |
| Keep         | src/utils, stores, shared, jwt, AuthService, most lib/middleware, ui/dialog/layout/task components | ~600           |
| Keep+fix env | comprehensive-requirements (fix default DB URL in `packages/backend/src/config/database.ts:5-7`)   | 25             |
| Rewrite      | lib/services mocked-SQL → real-DB (L2)                                                             | 199 → ~130     |
| Rewrite      | api mocked "integration"/"e2e" → real handler+DB (L3)                                              | 116 → ~150     |
| Rewrite      | hooks (optimistic/rollback), consolidate smart-input                                               | ~250 → ~150    |
| Delete       | 4 demo files, tautological parse/reactQueryIntegration cases                                       | ~25            |
| Add          | parser unit (~70), api-client unit (~25), auth UI (~15), Playwright E2E (~20)                      | +130           |

Net: ~1,240 → ~1,100 tests, but every layer verifies real behavior at its boundary, and the five bug classes that actually shipped (#6/#7 auth routing, #12/#30 SQL-schema drift, #29 data loss, #31 dev-server drift, #32 calendar nav) each become catchable at a named layer.

## 9. Repro commands

```bash
cd /home/shree/dev/taskflow-calendar
npx vitest run --config vitest.config.ts            # frontend: 634 pass
npx vitest run --config vitest.backend.config.ts    # backend root: 516 pass
cd packages/shared && npx vitest run                # 22 pass
cd ../backend && npx vitest run                     # 42 pass, 25 skip, 1 suite fails (no DB creds)
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/react_calendar_dev' npx vitest run src/test/comprehensive-requirements.test.ts  # 25 pass
docker ps   # react-calendar-postgres must be up (docker-compose.yml)
```
