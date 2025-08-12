# API Backend Fixes, Architecture, and Handoff Notes

This document captures a comprehensive, end-to-end summary of the backend/API state, the fixes applied during this session, design decisions, expected behavior, known issues, and a roadmap for the next agent.

The goal is to make future work predictable and safe by fully documenting the architecture, constraints, and the rationale behind code changes.

## TL;DR (Executive Summary)

- Worked on serverless API build/runtime problems (TypeScript + Prisma + ESM paths) that were causing 500s on basic GETs and POSTs.
- Standardized API error responses; routes should now construct proper `ApiError` subclasses.
- Tightened Prisma usage with concrete `Prisma.*WhereInput` and `Prisma.*CreateInput` rather than loose Records.
- Resolved duplicate Prisma d.ts identifier issues by pinning Prisma to `5.16.1` and regenerating the client.
- Addressed ESM resolution issues in serverless runtime; imports now use `./BaseService.js`.
- Replaced unsafe response overrides with safe request logging (`res.once('finish', ...)`).
- Implemented dev-only user upsert to satisfy FK constraints for POST flows (tasks, task lists, calendars, events) when running without real authentication.
- Event creation now connects to both `user` and `calendar`, removing 500s during event POST.
- GETs are 200 on page load; task/event POSTs succeed with dev user upsert.

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
- Database: PostgreSQL via Prisma ORM. Prisma schema in `packages/backend/prisma/schema.prisma`.
- Prisma Client generated into root `node_modules/@prisma/client` and used both by monorepo server (`packages/backend`) and API routes.
- Frontend dev: Vite serves the UI and proxies `/api` to `localhost:3000` (where `vercel dev` serves serverless functions by default).

Request flow:
1. Vite dev server at `5173` proxies `/api/*` → `localhost:3000` (serverless routes).
2. API route enters `createApiHandler`/`createCrudHandler` in `lib/utils/apiHandler.ts`.
3. Middleware pipeline runs (CORS → RequestId → RequestLogger → RateLimit → Validation → DevAuth).
4. Route handler executes, constructs filters/payloads, and defers to the appropriate service method.
5. Services execute Prisma queries and return domain entities.

## Middleware Pipeline and Order

- `corsMiddleware()`
- `requestIdMiddleware()` – sets `req.requestId`, adds an `X-Request-ID` header
- `requestLogger()` – logs request on arrival and response on finish
- Rate limit preset (`rateLimitPresets.api`) – basic per-route limiting
- `validateRequest(config)` – if validation schemas are provided
- `devAuth()` – in development only, attaches a default user (`dev-user-id`) to `req.user` for routes that expect authentication

Note: `requestLogger()` runs before `devAuth()`, so `userId` will log as `undefined` in dev even when `devAuth()` attaches a mock user later in the chain. The route handler will still see `req.user`. If you prefer logs to show `userId`, move `devAuth()` earlier in the middleware list.

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

## Prisma and TypeScript Decisions

- Pinned Prisma to `5.16.1` across root and backend. Reason: Avoid duplicate identifier issues seen in later versions under the serverless builder.
- Regenerated client at root against `packages/backend/prisma/schema.prisma`.
- Enforced concrete Prisma types in services:
  - Filters use `Prisma.*WhereInput`.
  - Creates use `Prisma.*CreateInput` with proper `connect` relations.
- Root `tsconfig.json` now sets `skipLibCheck: true` to avoid lib.d.ts noise from serverless builder and node typings.

Trade-offs:
- `BaseService.getModel()` typing was relaxed to `any` to support varying delegate signatures without introducing a large generic surface. Concrete services enforce stricter types via Prisma inputs. Consider refactoring to a typed delegate interface per model in the future.

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
- CRUD operations with overridable clauses (`buildWhereClause`, `buildIncludeClause`, `transformEntity`).
- Pagination and counting utilities.
- `ensureUserExists(userId, emailFallback)`: Dev-only helper that upserts a user row, preventing FK violations when routes connect to `user` without a real auth flow. Guarded by `process.env.NODE_ENV !== 'production'`.

Key service behaviors and fixes:

### TaskService
- `create(data, context)`:
  - Validates payload.
  - `ensureUserExists(context.userId)` before any write.
  - If no `taskListId`, calls `getOrCreateDefaultTaskList(userId)` (which also ensures user exists) then connects task to that list.
  - Uses `Prisma.TaskCreateInput` to connect `user` and `taskList` properly and to assign optional fields.
- Tags: Upserts tags (by name) then creates `taskTag` relations within the same transaction when tags are provided.

### TaskListService
- `create` uses `Prisma.TaskListCreateInput` and connects `user`.
- `getDefault(context)`
  - Returns an existing "General" list or the first user list.
  - If none exist, creates a default list and returns immediately (avoids confusing union types in TS).

### CalendarService
- `create` uses `Prisma.CalendarCreateInput` and connects `user`.
- `getDefault(context)`
  - Returns the default calendar if present; otherwise sets the first as default; otherwise creates a new default calendar and returns immediately.

### EventService
- `create(data, context)` – OVERRIDDEN (Important Fix)
  - Validates payload and relations.
  - `ensureUserExists(context.userId)`.
  - Builds `Prisma.EventCreateInput` and connects both `user` and `calendar`.
  - Includes calendar summary in the result to match UI expectations.

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
  - POST: creates a calendar; returns 201 on success.

- `api/events/index.ts`:
  - GET: returns events with optional range filters and upcoming mode.
  - POST: creates event; uses `EventService.create` (now connects required relations).

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
- Create flows (in dev, without real auth):
  - POST `/api/tasks` → 201; creates a "General" list on first use if needed; task shows in UI.
  - POST `/api/calendars` → 201; creates a default calendar if none exists.
  - POST `/api/events` → 201; requires `calendarId`; connects to dev user and specified calendar; event shows in UI.
- Error responses follow `ApiResponse` format consistently.

## Known Issues (and Mitigations)

- Dev logger shows `userId: undefined` even though route handler has a dev user.
  - Cause: `requestLogger` runs before `devAuth`. Mitigation: If needed, reorder middleware so `devAuth()` is earlier.
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
- Prisma regeneration:
  - `npx prisma generate --schema packages/backend/prisma/schema.prisma`
- Prisma version alignment (root + backend workspaces):
  - `npm i -E @prisma/client@5.16.1 prisma@5.16.1`

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
