# API Backend Fixes, Architecture, and Handoff Notes

## 2025-08 Direct SQL Migration (node-postgres) — Read This First

This codebase has been migrated off Prisma ORM to direct SQL using node-postgres (`pg`) for the serverless API. The frontend contracts remain the same. Keep the `.js` extensions in ESM imports; do not remove them.

What changed (high level):
- Database client: Prisma → `pg` (`Pool`/`PoolClient`) via `lib/config/database.ts`
  - Exports: `pool`, `query(sql, params, client?)`, `withTransaction(fn)`, `initDatabase`, `checkDatabaseHealth`, `cleanupDatabase`
- Services are now SQL-backed. `BaseService` no longer exposes Prisma delegates. It provides logging, ownership checks, and helpers; concrete services implement SQL themselves.
- `ServiceFactory` injects a `dbClient` (for transactions) and no longer exposes or expects a Prisma client.
- API routes under `api/*` are unchanged in shape, but call SQL-backed services.
- Error handling unchanged: always use `sendError(res, new ApiErrorSubclass(...))` and `sendSuccess` for success.

Key service behaviors (SQL):
- TaskListService: CRUD + `getDefault`, `getWithTaskCount`. PATCH to `/api/task-lists/:id` supports `{ name, color, icon, description }` for emoji/color updates.
- TaskService: `create` will use provided `taskListId` or fall back to the user’s default task list. Tags are upserted and linked within a transaction.
- CalendarService: CRUD + default calendar helpers; visibility toggles and counts.
- EventService: CRUD with calendar join. Update implemented to accept Date or ISO strings for `start`/`end`.

Frontend contract clarifications (unchanged API shapes, now honored by SQL services):
- POST /api/tasks accepts `taskListId`; the UI now passes the selected list id. Without it, tasks go to the default list.
- PATCH /api/task-lists/:id persists `icon` (emoji) and `color` updates.
- PUT /api/events/:id accepts Date or ISO string for `start`/`end` and returns enriched calendar info.

Dev ergonomics and Vite fixes:
- Vite now pre-bundles `react-resizable-panels`, `react-dropzone`, and `@radix-ui/react-toggle` via `optimizeDeps.include`, and enforces `server.port=5173` with `strictPort=true` to eliminate “Outdated Optimize Dep” 504s.
- If you see optimize errors, clear caches: `rm -rf node_modules/.vite node_modules/.cache/vite` and restart dev.

## 2025-08 Optimistic UI (Frontend) — Instant UX + Toast Rollbacks

This session implemented an end-to-end Optimistic UI across Tasks, Events, Calendars, and Task Lists. Actions update the UI immediately and roll back on error with a Sonner toast. This section documents the decisions and the exact places that were changed so future agents can reason safely about the behavior.

### Why events “disappeared” after create (root cause and fix)

- Symptom: Creating an event shows it immediately, then it “vanishes” once the network call finishes.
- Root cause:
  - The UI filtered events by `calendarName` for visible calendars.
  - The server response for create/update sometimes returned an event without `calendarName` (only `calendarId`/joined `calendar`).
  - An immediate refetch replaced the optimistic item with the server list; the new event lacked `calendarName` so the filter dropped it.
- Fix:
  - Map `calendarName` on the client for both create and update responses (from `data.calendarName` or the joined `calendar.name`).
    - File: `src/services/api/events.ts` (create/update mapping)
  - Remove premature invalidation right after create/update/delete in events, so the optimistic item remains stable.
    - File: `src/hooks/useEvents.ts`
  - Keep a single “all events” cache and derive filtered views in-memory to avoid list/fetch races.

### Libraries and global setup

- Toasts: `sonner`
  - Toaster mounted once in `src/App.tsx` with system theming and rich colors.
  - Global error surfacing in `src/components/providers/QueryProvider.tsx` pipes query/mutation errors to `toast.error(...)`.
- Data: `@tanstack/react-query` v5
  - Use optimistic `onMutate` with snapshots + rollback in all mutations.

### Events (create/update/delete/drag)

- Hook: `src/hooks/useEvents.ts`
  - Create: optimistic insert with temp id; replace temp with server entity in `onSuccess`; no immediate invalidation (prevents flicker).
  - Update: optimistic merge; rollback on error; avoid immediate invalidation.
  - Delete: optimistic remove; rollback on error; avoid immediate invalidation.
  - Filtering: switched to a single `all` query and derived filtered results via `useMemo`.
- Mapping: `src/services/api/events.ts`
  - Ensure `calendarName` is always present on create/update responses by backfilling from `calendar.name` or request payload.
- Drag/move: `src/components/calendar/CalendarView.tsx`
  - `eventChange` uses `mutate` (not `await`) for a true optimistic move; revert only on error.
- Dialogs:
  - `src/components/dialogs/EventCreationDialog.tsx`: create uses non-blocking `mutate` and closes immediately.
  - `src/components/dialogs/EventDisplayDialog.tsx`: delete uses non-blocking `mutate` and closes immediately.

### Tasks (create/update/delete/schedule/toggle)

- Hook: `src/hooks/useTasks.ts`
  - Create: temp id, optimistic insert + replacement on success; rollback + toast on error.
  - Update/Delete/Schedule/Toggle: optimistic mutations with snapshot + rollback + toast.

### Calendars (create/update/delete/toggle visibility)

- Hook: `src/hooks/useCalendars.ts`
  - Create: optimistic add with temp id + replacement on success; rollback + toast on error.
  - Update/Delete/Toggle: optimistic with rollback + toast.

### Task Lists (emoji/color/create/edit/delete)

- Hook: `src/hooks/useTaskManagement.ts`
  - Create/Edit/Delete: optimistic changes with rollback + toast.
  - Emoji/Color: now optimistic with rollback + toast.

### Operational guidance (important for future agents)

- Filters depend on `calendarName`. If you ever change server responses, ensure `calendarName` is preserved or computed; otherwise new events will vanish from filtered views.
- Avoid immediate `invalidateQueries` on optimistic create/update/delete unless you specifically need a server truth refresh; it often causes visible flicker. Prefer reconciling during background moments or on a subsequent screen.
- When wiring FullCalendar moves/resizes, use `mutate` (not `await`) so the UI doesn’t snap back. Revert only in the mutation `onError` path.

### Quick troubleshooting

- Verify server responses contain `calendarName`:
  - POST `/api/events` should return the newly created event with `calendarName` populated.
  - PUT `/api/events/:id` should return `calendarName` (original or updated).
- If an event is missing:
  - Confirm the event’s `calendarName` matches a visible calendar name on the client.
  - Check that no immediate invalidation is clearing your optimistic entry.

### Files changed (Frontend)

- Toaster + global errors: `src/App.tsx`, `src/components/providers/QueryProvider.tsx`
- Events: `src/hooks/useEvents.ts`, `src/services/api/events.ts`, `src/components/calendar/CalendarView.tsx`, `src/components/dialogs/EventCreationDialog.tsx`, `src/components/dialogs/EventDisplayDialog.tsx`
- Tasks: `src/hooks/useTasks.ts`
- Calendars: `src/hooks/useCalendars.ts`
- Task Lists: `src/hooks/useTaskManagement.ts`

Do’s
- Keep `.js` extensions in ESM imports inside `api/` and `lib/`.
- Use `query`/`withTransaction` from `lib/config/database.ts` for all DB work.
- Always pass `context.userId` from routes into services; services enforce ownership.
- Return `ApiResponse<T>` and use `sendError` with typed `ApiError`s.

Don’ts
- Don’t reintroduce Prisma in the serverless API.
- Don’t mutate `req.query`. Use validation middleware or parse locally and pass through.
- Don’t bypass error helpers with raw objects.

Recently fixed bugs (SQL phase):
- 500s on GET /api/events and /api/task-lists due to unimplemented `findAll` → implemented in `EventService`, `TaskListService`, `CalendarService`.
- PUT /api/events/:id returned 500 (“Event not found”) → implemented `EventService.update` and tolerant date parsing.
- Tasks always created in General → UI now sends `taskListId`; backend honors it.
- Emoji updates didn’t persist → UI now PATCHes `/api/task-lists/:id` with `{ icon }`; SQL service updates persist.
- Vite dev 504s (optimized deps) → added `optimizeDeps.include` and `strictPort`.

This document captures a comprehensive, end-to-end summary of the backend/API state, the fixes applied during this session, design decisions, expected behavior, known issues, and a roadmap for the next agent.

The goal is to make future work predictable and safe by fully documenting the architecture, constraints, and the rationale behind code changes.

## TL;DR (Executive Summary)

- Serverless API migrated to direct SQL using `pg` (node-postgres). Prisma is no longer used in `api/` or `lib/`.
- All services (`Task`, `TaskList`, `Calendar`, `Event`, `Tag`, `Attachment`) now use `query(...)` and `withTransaction(...)` from `lib/config/database.ts`.
- Fixed critical 500s by implementing missing methods and tolerant validators:
  - Implemented `findAll` in `EventService`, `TaskListService`, `CalendarService`.
  - Implemented `EventService.update` (accepts Date or ISO strings; returns enriched event with calendar).
  - Implemented `TaskListService.update` (name, color, icon/emoji, description) used by PATCH/PUT routes.
- Frontend contract unchanged; APIs return the same shapes. UI fixes now send `taskListId` on task create and persist emoji/color edits via PATCH `/api/task-lists/:id`.
- ESM requires `.js` extensions in imports inside `api/` + `lib/`; do not remove them.

## Background and Symptoms

Observed issues before fixes:
- TypeScript errors from Prisma client d.ts (const type parameters, duplicate identifiers) causing Vercel builder to fail and API routes to return 500.
- ESM resolution errors for `BaseService` imports in serverless environment.
- `sendError` was strict and routes were passing POJOs; TypeScript complained that `ApiError` fields were missing.
- Request logging overrode `res.end`, causing TS signature errors.
- Validation middleware wrote parsed data back into `req.query`, conflicting with `VercelRequestQuery` typing.
- POST flows failed due to missing user relationships and FK constraints (e.g., creating default task list without a persisted user row), and event creation omitted the required `user` relation.

## Architecture Overview (Serverless API)

- Platform: Vercel serverless functions under `api/` directory.
- Backend logic lives in `lib/` (services, middleware, utilities). Serverless routes call into services.
- Database: PostgreSQL via node-postgres (`pg`) for serverless API. SQL helpers in `lib/config/database.ts`.
- Frontend dev: Vite serves the UI and proxies `/api` to `localhost:3000` (where `vercel dev` serves serverless functions by default).

Request flow:
1. Vite dev server at `5173` proxies `/api/*` → `localhost:3000` (serverless routes).
2. API route enters `createApiHandler`/`createCrudHandler` in `lib/utils/apiHandler.ts`.
3. Middleware pipeline runs (CORS → RequestId → RequestLogger → RateLimit → Validation → DevAuth).
4. Route handler executes, constructs filters/payloads, and defers to the appropriate service method.
5. Services execute parameterized SQL and return domain entities (optionally enriched via post-load joins).

## Middleware Pipeline and Order

- `corsMiddleware()`
- `requestIdMiddleware()` – sets `req.requestId`, adds an `X-Request-ID` header
- `devAuth()` – in development only, attaches a default user (`dev-user-id`) to `req.user` for routes that expect authentication
- `requestLogger()` – logs request on arrival and response on finish
- Rate limit preset (`rateLimitPresets.api`) – basic per-route limiting
- `validateRequest(config)` – if validation schemas are provided

Note: In dev, `devAuth()` precedes the logger so logs include the mock `userId`.

## Error Handling and Response Contract

- All routes return `ApiResponse<T>`:
  - `{ success: true, data: T }` on success.
  - `{ success: false, error: { code, message, details?, timestamp, requestId? } }` on error.
- Error helpers:
  - `sendSuccess(res, data, statusCode = 200)`
  - `sendError(res, error: ApiError)` – routes pass `ApiError` subclasses explicitly
- `ApiError` subclasses: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalServerError`.
- Validation: Zod-based via `validateRequest`. Parsed values are stored under `req.validated` instead of mutating `req.query` (prevents type mismatches on serverless request types).

## Authentication (Dev vs Prod)

- `requireAuth` flags exist on routes, but the hard JWT middleware is not wired yet. In dev, `devAuth()` injects:
  - `req.user = { id: 'dev-user-id', email: 'dev@example.com', name: 'Dev User' }`
- This lets services rely on `context.userId` during development.
- IMPORTANT: In production, remove `devAuth()` and implement proper JWT verification. Routes using `requireAuth` must add `authenticateJWT()` in the chain.

## TypeScript and ESM Details

- The repo is strict TS. `lib/` and `api/` are authored in TS with ESM; runtime requires `.js` in import specifiers.
- `lib/config/database.ts` provides the `pg` Pool and helpers. Prefer `query(sql, params, client)` with parameterized inputs.
- Use `withTransaction(async client => { ... })` for multi-step writes (e.g., task + tag relations).

## Services Layer (Design and Behavior)

Services live under `lib/services/` and extend `BaseService<TEntity, CreateDTO, UpdateDTO, Filters>`:
- `TaskService`
- `CalendarService`
- `EventService`
- `TaskListService`
- `TagService`
- `AttachmentService`

Shared responsibilities implemented in `BaseService`:
- Logging (`this.log`) with request metadata.
- Ownership checks (`checkOwnership`) for user-owned rows.
- `buildWhereClause` and `enrichEntities` hooks for filtering and relation loading.
- Helpers: `findById`, `count`, `exists`; concrete classes implement `findAll`, `create`, `update`.
- `ensureUserExists(userId, emailFallback)` (dev-only) inserts a user row to satisfy FKs.

Key service behaviors and fixes:

### TaskService (SQL)
- `create(data, context)`: validates, ensures dev user, resolves `taskListId` (or default), inserts task, upserts tags and `task_tags` in a transaction, returns enriched task (taskList, tags, attachments).
- `update(...)`, `toggleCompletion(...)`, `findByTaskList(...)`, `findByScheduledDate(...)`, `search(...)` implemented with SQL.

### TaskListService (SQL)
- `create`: inserts row tied to user.
- `update`: supports `name`, `color`, `icon` (emoji), and `description`.
- `getDefault(context)`: returns "General" or first list, creating a default if none exist.
- `getWithTaskCount(...)`: returns aggregate counts per list.

### CalendarService (SQL)
- `create`, `toggleVisibility`, `setDefault`, `getWithEventCounts`, standard findAll/filtering via SQL.

### EventService (SQL)
- `create`: validates, ensures dev user, inserts with calendar relation, returns enriched event (with calendar summary).
- `update`: now implemented; accepts Date or ISO string for `start`/`end`; validates start < end; optional calendar change with ownership validation.

### TagService / AttachmentService
- Where clauses are typed (`Prisma.TagWhereInput`, `Prisma.AttachmentWhereInput`).
- Entity interfaces updated to include `createdAt`/`updatedAt` where necessary to match results from Prisma delegates.

## API Routes (Serverless)

All routes under `api/` follow a consistent pattern using `createCrudHandler`:

- `api/tasks/index.ts`:
  - GET: returns tasks (supports filters and pagination).
  - POST: creates task; constructs `CreateTaskDTO` and delegates to service; returns 201 on success.
  - Responses now use `ApiError` subclasses for errors.

- `api/calendars/index.ts`:
  - GET: returns calendars; `withEventCounts=true` includes counts.
  - POST: creates a calendar; returns 201.
  - `api/calendars/[id].ts`: GET by id, PUT/PATCH update, DELETE.

- `api/events/index.ts`:
  - GET: returns events with optional range filters and upcoming mode.
  - POST: creates event (calendar relation required).
  - `api/events/[id].ts`: GET by id, PUT/PATCH update (now implemented), DELETE.

- All `sendError` usages now receive `ApiError` subclasses (`UnauthorizedError`, `ValidationError`, `InternalServerError`) to satisfy typings and unify response shape.

## ESM Pathing and Runtime Stability

- Replaced imports of `./BaseService` with `./BaseService.js` in services. Under ESM + Vercel builders, the `.js` extension is required for runtime resolution even in TS sources.
- Replaced `res.end` override with `res.once('finish', ...)` logging in `requestLogger` to avoid TS signature conflicts and to ensure safe logging.

## Validation Strategy

- Zod schemas can be attached to routes via `validateRequest({ body, query, params })`.
- Parsed outputs are mounted to `req.validated` to avoid mutating `req.query` and breaking `VercelRequestQuery` typing.

## Expected Behavior (Post-Fix)

- Page load:
  - GET `/api/calendars?withEventCounts=true` → 200
  - GET `/api/events` → 200
  - GET `/api/tasks` → 200
- Create/update flows (dev auth injected):
  - POST `/api/tasks` → 201; honors `taskListId` if provided; falls back to default list.
  - PATCH/PUT `/api/task-lists/:id` → 200; persists `name`, `color`, `icon` (emoji), `description`.
  - POST `/api/calendars` → 201; basic create; default handling via service.
  - PUT/PATCH `/api/events/:id` → 200; accepts Date or ISO `start/end`; returns enriched event.
- Error responses follow `ApiResponse` format consistently.

## Known Issues (and Mitigations)

- Ensure `DATABASE_URL` is configured; serverless routes rely on `pg` connectivity.
- Frontend dialogs reuse create components for edit; ensure initial values are passed (now implemented) and labels set appropriately.
- `BaseService.getModel()` is typed `any` to accommodate varying Prisma delegates.
  - Trade-off: Simpler common base, less static type coverage. Improvement: Introduce a typed delegate interface per model or generic mapping.
- `skipLibCheck: true` at root.
  - Trade-off: Keeps noisy lib TS errors from breaking serverless builds. Improvement: Revisit after TS/Node/Prisma upgrades.
- `ensureUserExists` is dev-only behavior.
  - Important: Guarded by `NODE_ENV !== 'production'`. Must not leak into prod flows. Real auth should provide/verify user.
- Rate limiting is applied with a preset; customization may be needed per endpoint.
- Validation coverage is partial; many routes rely on service-level validation.

## Unknowns / Items to Investigate

- End-to-end consistency of attachment upload and retrieval; current implementation is MVP and may require storage provider integration (e.g., Vercel Blob) and signed URL generation.
- Comprehensive timezone handling for event date/times; current code assumes UTC storage; UI conversions should be verified.
- Performance of complex filters; indexes exist in the schema, but load testing should confirm.
- Data cleanup tasks (unused tags, orphaned attachments) are implemented but may need scheduling or admin routes.

## Roadmap (Next Agent)

1. Authentication
   - Implement real JWT verification middleware and wire it when `requireAuth` is true.
   - Remove or strictly confine `devAuth()` to dev-only.
2. Middleware ordering
   - Consider moving `devAuth()` before `requestLogger()` in dev to improve log fidelity.
3. Service typing
   - Replace `any`-typed `getModel()` in `BaseService` with a typed delegate approach per model to regain static guarantees.
4. Validation
   - Add Zod schemas to POST/PUT/PATCH routes and wire them via `validateRequest`.
5. Observability
   - Standardize structured logs and add a log level knob.
   - Add per-request correlation using `req.requestId` throughout downstream logs.
6. Tests
   - Add integration tests for serverless routes (POST/GET flows) with a test DB.
   - Add unit tests for services with a Prisma test client.
7. Data & schema
   - Review and enforce required relations in Prisma schema to match service expectations.
   - Confirm indexes on frequent query paths.
8. Upgrades
   - Reassess Prisma versions after the duplicate identifier issue is confirmed resolved upstream.
   - Remove `skipLibCheck` when stable.

## File-by-File Changes (Key Highlights)

- `api/tasks/index.ts`, `api/calendars/index.ts`, `api/events/index.ts`
  - Return `ApiError` subclasses via `sendError`.
- `lib/utils/apiHandler.ts`
  - Adds typed `ValidationConfig`; includes `devAuth()` in dev.
- `lib/middleware/requestId.ts`
  - Safe logging with `res.once('finish', ...)` (no signature overrides).
- `lib/middleware/validation.ts`
  - `req.validated` introduced; stops mutating `req.query`.
- `lib/services/BaseService.ts`
  - Introduces `ensureUserExists` (dev only); tightens error logging; small signature adjustments.
- `lib/services/TaskService.ts`
  - Uses `Prisma.TaskCreateInput`; connects `user`/`taskList`; dev user upsert.
- `lib/services/TaskListService.ts`
  - Uses `Prisma.TaskListCreateInput`; default list creation return path simplified; dev user upsert on create.
- `lib/services/CalendarService.ts`
  - Uses `Prisma.CalendarCreateInput`; default calendar creation return path simplified; dev user upsert on create.
- `lib/services/EventService.ts`
  - OVERRIDDEN create: validates + connects `user` and `calendar`; dev user upsert.
- `lib/services/TagService.ts`, `lib/services/AttachmentService.ts`
  - Typed where clauses; entity interfaces include `createdAt`/`updatedAt`; ESM import fixes.
- `tsconfig.json`
  - `skipLibCheck: true` (root); path mappings intact.
- Prisma
  - Pinned to `5.16.1`; regenerated against `packages/backend/prisma/schema.prisma`.

## Local Dev & Troubleshooting

- Start: `vercel dev` (which runs `npm run dev` → Vite + backend concurrently)
- Vite serves UI at `http://localhost:5173`. Proxy forwards `/api` to `http://localhost:3000`.
- If a route returns 500:
  - Check terminal for Prisma or TS errors.
  - Confirm `DATABASE_URL` is set and DB is reachable.
  - Run `npm run db:migrate` and `npm run db:seed` if needed.
- Database migrations (still via backend workspace using Prisma CLI for the monorepo DB):
  - `npm run db:migrate`
  - `npm run db:seed`

## Security Notes

- `devAuth()` must never be active in production.
- `ensureUserExists` is only effective in dev (`NODE_ENV !== 'production'`). It should be considered a dev-only convenience; do not rely on it outside dev.
- When JWT auth is introduced, ensure user `id` is pulled from the token and validated.

## Final State (After This Session)

- GET endpoints: healthy; returning 200 on page load.
- POST endpoints:
  - Potentially needs improvement and fixing across different cases.
- TypeScript build for serverless routes: green; no Prisma d.ts parse errors; no ESM path errors; consistent error handling.

---

If anything regresses, please paste the first error block (line numbers + file) from `vercel dev` and/or the Chrome network error body. The system is now structured for quick, targeted fixes.



## Addendum: Additional Findings, Current Regressions, and Hypotheses

This section records additional, concrete symptoms observed after the baseline fixes above, plus what I think the likely root causes are. Where I’m not fully certain, I explicitly say “I think” or “it might be.” The intent is to give the next agent enough breadcrumbs to avoid rediscovering the same issues.

### Symptoms observed (current state in local runs)

- Task/Task‑lists/Tags serverless route handlers sometimes appear to “do nothing.” In practice, they short‑circuit very early (e.g., 401) and never call services, or they return error payloads through a success response shape.
- In vitest integration tests for serverless routes (e.g., `api/tags/__tests__/tags.integration.test.ts`, `api/task-lists/__tests__/task-lists.integration.test.ts`, `api/tasks/__tests__/tasks.integration.test.ts`) a number of cases error with:
  - `TypeError: default is not a function` at the lines like `await tagsHandler(req, res);` (where `tagsHandler` is imported as `import tagsHandler from '../index'`).
- Some tests expect `sendError` to have been called with an ApiError shape and the spies show “Number of calls: 0” (so the mocked function never got called).
- When we briefly wired different error shapes (plain objects) into `sendError`, tests that asserted strict `ApiError` usage began to fail more broadly (because the mock is set up expecting a helper function call, not just any response).

### Likely causes (what I think is going on)

1) Authentication short‑circuit in dev
- In routes such as `api/tasks/index.ts` and `api/tasks/[id].ts`, the first branch is an auth guard:
  - `if (!userId) return sendError(... 401 ...)`
- If requests in development don’t have `req.user` populated, handlers bail before reaching services. We expect `devAuth()` to inject a dev user during development, but middleware order and environment can matter.
- In `lib/utils/apiHandler.ts` the current middleware order is:
  - `cors → requestId → requestLogger → rateLimit → (optional validateRequest) → devAuth` (dev only) → handler.
- I think devAuth runs late (after rate limit and logger). That shouldn’t prevent `req.user` from being available to the handler (so the guard should pass), but logs won’t show the user ID. If `NODE_ENV` is not what we think (e.g., not `development`), `devAuth()` won’t run and the guard will 401. It might be worth confirming `NODE_ENV` at runtime and possibly moving `devAuth()` earlier in the chain if we want user ID in logs as well.

2) Error handling contract drift (object vs ApiError)
- The system used to rely on `sendError(res, new ApiErrorSubclass(...))` across routes to keep a consistent wire contract and to make the test harnesses easy to mock/spy.
- Some edits changed routes to pass plain objects to `sendError` (e.g., `{ statusCode, code, message }`).
- Tests that `vi.mock('../../../lib/middleware/errorHandler')` expect to see the mocked `sendError` function being called with an ApiError (or at least with a consistent call signature). When the route bypasses `sendError` or passes a raw object, spies never trip or the expectations don’t match. This shows up in failures like “expected spy to be called... Number of calls: 0”.
- I think the safest approach is to standardize on `sendError(res, new ApiErrorSubclass(...))` everywhere (or, if we want to support object input, update all callsites and tests consistently). Mixing both leads to confusing test failures and inconsistent runtime responses.

3) Accidental success response in error path
- In `api/task-lists/[id].ts` there’s a catch branch that (accidentally) calls `sendSuccess(res, {...error payload...})` instead of `sendError(res, ...)`.
- This makes failing operations appear as `success: true` to the client, which explains UI “no‑ops” after an operation — the UI trusts success and doesn’t retry or surface errors.

4) “default is not a function” in route tests
- Tests import route handlers as default from `../index` (e.g., `import tagsHandler from '../index'`) and call them (`await tagsHandler(req, res)`), expecting a function.
- Each `api/*/index.ts` uses `export default createCrudHandler({...})`, where `createCrudHandler` returns a function (by way of `createApiHandler`).
- We still see `TypeError: default is not a function` consistently. I think there are a few plausible reasons:
  - Vitest ESM interop edge case (default import vs module namespace) when using `vi.mock` for side modules (e.g., `errorHandler` or `services/index`). In some configurations, the default export might not be materialized the way the tests expect.
  - Another possibility is a transient import resolution conflict if we change `.js` extension usage inconsistently between route files and tests. The tests import `../index` (extensionless). The code inside uses `.js` extensions for ESM runtime. I think it’s correct for runtime, but in test transforms this can produce surprises if the module loader or transform cache differs.
  - Finally, if tests are receiving an object (module namespace) rather than the function (default export), calling it would throw exactly this error. If so, rewriting tests to `import * as handlerModule from '../index'` and using `handlerModule.default` is one workaround, but better is to keep export patterns unchanged and ensure transform config preserves default.
- Action: Pick one standard and stick with it: keep `export default` for handlers and avoid changing it; ensure vitest config (`esModuleInterop`, `moduleResolution`) and imports are consistent; keep `.js` extensions where needed at runtime, but don’t change tests unless necessary.

5) Task service specifics (observed behaviors)
- Scheduled date filter:
  - Earlier, we adapted the where clause to Prisma `{ gte/lte }` boundaries. Tests for `findByScheduledDate` expect a shape `{ scheduledDate: { from: Date, to: Date } }` to be passed into `findMany` (mock expectations). When we convert to `{ gte/lte }` before calling the delegate, those tests fail. I think keeping the `from/to` at the call boundary (for test mocks) and mapping to `{ gte/lte }` inside the real delegate path is viable, but whichever we choose must match tests consistently.
- Delete ownership:
  - When `delete` didn’t check ownership and simply deleted by ID, tests expecting an authorization error (when non‑owned) failed. The fix is to check `checkOwnership` first and throw on mismatch.
- Tag creation in a transaction:
  - Some test transaction mocks don’t include `tx.tag` or `tx.taskTag` objects. When code unconditionally does `tx.tag.upsert` or `tx.taskTag.create`, those mocks throw. I think a defensive guard or improving the test mock shape will fix it.

6) Frontend interop and perceived “no data”
- Priority enum mismatch (backend `MEDIUM` vs frontend `medium`) caused “created tasks not visible” until mapping was added on the frontend. This was addressed in the client previously; verify that mapping still exists where task objects are revived.
- Event load performance: I think the UI should fetch events for the visible date range rather than all events on initial load. This can drastically reduce payload and initial render latency. The backend already supports range filters; ensure the calendar view passes `start`/`end` where available.

### Quick checklist (to stabilize task APIs first)

- Confirm `NODE_ENV` is `development` locally and that `devAuth()` is enabled in the middleware chain (present in `createApiHandler`). If desired, move `devAuth()` before `requestLogger()` so logs show `userId` as well.
- Replace the accidental `sendSuccess` in error catch in `api/task-lists/[id].ts` with `sendError`.
- Standardize error responses: use `sendError(res, new ApiErrorSubclass(...))` everywhere in routes (e.g., `UnauthorizedError`, `ValidationError`, `NotFoundError`, `InternalServerError`). If we prefer plain objects, update `sendError` typings and tests consistently.
- Keep route default exports as functions (`export default createCrudHandler({...})`) and avoid changing export forms. If tests still hit “default is not a function,” verify vitest ESM interop settings and import style.
- In `TaskService`:
  - Keep ownership checks for `update`, `delete`, and bulk operations.
  - Align `scheduledDate` filters with test expectations (either keep `{from,to}` at the mocked boundary or update tests accordingly). I think mapping to `{ gte/lte }` right before Prisma is correct for runtime; tests can be adjusted or a compatibility layer can be used in mocks.
  - Guard tag transaction code if mocks don’t provide `tx.tag`/`tx.taskTag`.

### What I would do next (step‑by‑step)

1) Fix response contract and accidental success path
- Change the one erroneous `sendSuccess` in `api/task-lists/[id].ts` catch to `sendError`.
- Ensure every early return uses `sendError(res, new ApiErrorSubclass(...))` for consistency.

2) Verify dev auth and guard removal in dev
- Confirm `devAuth()` is included (it is, but ensure `NODE_ENV` is `development`). Optionally move it before `requestLogger()` to improve logs.
- With that in place, re-run manual calls to `/api/tasks` and `/api/task-lists` to confirm 200s and that services are invoked (log statements in services should show calls).

3) Repair TaskService edge cases
- Add ownership check to `delete` if missing.
- Align `scheduledDate` shape with tests or adjust tests with a compatibility adapter in the mock layer.
- Make tag transaction guards resilient to mocks.

4) Resolve “default is not a function” in tests
- Keep route default export structure; ensure vitest config is compatible with ESM default exports. If needed, modify tests to `import * as handlerModule from '../index'` and call `handlerModule.default(req, res)` — but only if necessary.

5) Performance follow‑up (after correctness)
- Switch calendar to range‑based fetch on initial load.
- Confirm the frontend task revive maps backend enum fields (priority) to UI values.

### Open questions

- I’m not fully sure why vitest reports `default is not a function` given the route exports are `export default createCrudHandler(...)`. I think it’s an ESM interop/mocking side effect. Verifying with a minimal reproduction (test that imports a trivial `export default () => {}`) under the same config would confirm.
- I’m also not 100% on whether tests should assert `{from,to}` vs `{gte,lte}` in Prisma `findMany`. My inclination is runtime `{gte,lte}` is correct, and tests could assert behavior (date‑bounded results) rather than internal shape; but that’s a test‑style decision.

### References in code

- Middleware pipeline: `lib/utils/apiHandler.ts`
- Tasks routes: `api/tasks/index.ts`, `api/tasks/[id].ts`
- Task lists routes: `api/task-lists/index.ts`, `api/task-lists/[id].ts`
- Tags routes: `api/tags/index.ts`, `api/tags/[id].ts`
- Services: `lib/services/TaskService.ts`, `lib/services/TaskListService.ts`
- Error helpers: `lib/middleware/errorHandler.ts`
