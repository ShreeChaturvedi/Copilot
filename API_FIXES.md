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

