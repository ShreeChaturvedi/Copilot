# Triage dossier: issues #8, #29, #19 — taskflow-calendar

Repo: /home/shree/dev/taskflow-calendar. Branch: `finish-polish-deploy`, HEAD `3d6b329`. Triage date 2026-07-01.
All file:line references verified against the CURRENT working tree, not main and not the issue text.

## Verdict summary

| Issue | Title                                                | Classification                                            | Fix commit (already on HEAD)                   | GitHub state                      |
| ----- | ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | --------------------------------- |
| #8    | Recurring events never expanded into occurrences     | ALREADY-FIXED (core); QUICK follow-ups                    | `aa80d58` (branch wf-g2-recurring, 2026-06-26) | OPEN — close after acceptance run |
| #29   | Event color + recurrence exceptions silently dropped | ALREADY-FIXED; one op step left (apply migration per env) | `5dd0298` (2026-06-26)                         | OPEN — close after acceptance run |
| #19   | Conflict endpoint never called by UI                 | ALREADY-FIXED                                             | `8b8e89d` (branch wf-g6-dialogs, 2026-06-26)   | OPEN — close after acceptance run |

All three fix commits are ancestors of HEAD (verified `git branch --contains` lists `finish-polish-deploy`). The GitHub issues have no comments and are still open; nothing in the issue threads contradicts the code.

---

## Issue #29 — color + exceptions dropped: ALREADY-FIXED

The 7-step fix plan in the issue body was executed verbatim by commit `5dd0298`. Step-by-step verification against the working tree:

| Plan step                                     | Status           | Evidence                                                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Migration `003_event_color_exceptions.sql` | DONE             | `lib/config/migrations/003_event_color_exceptions.sql:10-11` — `ALTER TABLE events ADD COLUMN IF NOT EXISTS color text;` and `ADD COLUMN IF NOT EXISTS exceptions text[] NOT NULL DEFAULT '{}';` (001 untouched, exactly as the plan demanded) |
| 2. DTO/entity fields                          | DONE             | `lib/services/EventService.ts:69-70` (`CreateEventDTO.color/exceptions`), `:86-87` (`UpdateEventDTO`), `:33-35` (`EventEntity.color: string \| null`, `exceptions: string[]`)                                                                  |
| 3. `EventService.create` INSERT               | DONE             | `lib/services/EventService.ts:143-159` — columns `color, exceptions` as params `$9`/`$10` (`data.color \|\| null`, `data.exceptions ?? []`)                                                                                                    |
| 4. `EventService.update` SET blocks           | DONE             | `lib/services/EventService.ts:522-529` — conditional `color = $n` / `exceptions = $n`                                                                                                                                                          |
| 5. `api/events/index.ts` POST whitelist       | DONE             | `api/events/index.ts:117-118` — `color: body.color, exceptions: body.exceptions` inside the manually-built `eventData`                                                                                                                         |
| 6. FE POST payload                            | DONE             | `src/services/api/events.ts:137,140` — payload includes `color` and `exceptions`; PUT spreads `{...data}` at `:216` so update carries them too                                                                                                 |
| 7. `transformEntity` passthrough              | DONE (trivially) | `lib/services/BaseService.ts:119-121` is an identity cast; `EventService` does not override it, and `enrichEntities` (`EventService.ts:345-366`) spreads the row, so both columns flow to the client                                           |

Extras beyond the plan, also present:

- `duplicate()` carries color/exceptions over: `lib/services/EventService.ts:829-830`.
- Shared type has both fields: `packages/shared/src/types/index.ts:43,46`.
- Optimistic cache already kept them (`src/hooks/useEvents.ts:221,224` create; `:281` update spread) — now consistent with the server.

ISO-string round-trip consistency (the subtle failure mode I specifically checked): exceptions are matched by exact ISO string. Writers: `src/components/dialogs/EventDisplayDialog.tsx:331` and `src/components/dialogs/EventCreationDialog.tsx:1047-1051` write `new Date(occurrenceInstanceStart || start).toISOString()`. Readers: client expansion filters at `src/utils/recurrence.ts:243` (`start.toISOString()`), server expansion at `lib/services/EventService.ts:328-329`. Both sides derive occurrence starts from the same `rrule.between()` with `dtstart = new Date(event.start)`, and `toLocal`/`toUTC` are identity functions (`src/utils/date.ts:42-59` — `new Date(date.toISOString())` / `new Date(utcDate)`), so the instants match exactly. No timezone mismatch.

### Remaining work for #29 (op + test, QUICK)

1. **Apply the migration in every environment.** The migration runner is `scripts/migrate.ts` (lexical order, once, transactional, tracked in `schema_migrations`). Commands:
   - Dev: `docker compose up -d` (repo `docker-compose.yml`, Postgres at `postgresql://postgres:postgres@localhost:5432/react_calendar_dev`), then `npm run db:migrate`; verify with `npm run db:migrate:status` (expect `003_event_color_exceptions.sql` in the applied list). Docker was NOT running during this triage, so dev-DB state is unverified.
   - Prod (Neon): run `npm run db:migrate` with `DATABASE_URL` pointed at Neon before deploy.
2. **No automated test covers the round-trip.** `lib/services/__tests__/EventService.test.ts` never asserts color/exceptions persistence (grep for `exceptions` in the file: zero hits). Add: create-with-color/exceptions asserts INSERT params include them; update-exceptions asserts the SET clause. Run: `npm run test:backend:run`.

### Acceptance checks (from the issue, how to run)

- Set a per-event color in the edit dialog → PUT `/api/events/:id` body has `color` → reload → color survives. Also on create.
- "Delete this occurrence" on a recurring event (EventDisplayDialog) → PUT with `exceptions: [iso]` → reload → occurrence stays gone.
- API-level: `curl -X POST http://localhost:3001/api/events -H 'Content-Type: application/json' -d '{"title":"t","start":"2026-07-02T10:00:00.000Z","end":"2026-07-02T11:00:00.000Z","calendarId":"<id>","color":"#ff0000","exceptions":[]}'` then GET it back and check both fields (dev server is `scripts/dev-server.ts` on :3001; Vite must run as `npx vite --port 5180 --strictPort`).

---

## Issue #8 — recurrence expansion: ALREADY-FIXED (core), with an explicit architecture answer

### Where expansion lives today (the question the triage was asked to answer)

**The frontend does NOT use FullCalendar's rrule plugin.** `package.json:49-54` has only `@fullcalendar/core|daygrid|interaction|list|react|timegrid` (^6.1.18); there is no `@fullcalendar/rrule`. The `rrule` package (^2.8.1, `package.json:109`) is used directly on both sides.

**Recurrence IS rendered client-side today, and that is the live path.** Chain:

- `useEvents` (`src/hooks/useEvents.ts:94-100`) fetches `GET /api/events` with **no date range** via `eventApi.fetchEvents` (`src/services/api/events.ts:87-119`), so the client receives raw masters (recurrence string + exceptions intact).
- `CalendarView` expands masters per visible range: `src/components/calendar/CalendarView.tsx` — `expandOccurrences` import at `:18`, range-bounded expansion block at ~`:355-390` (iterates `events`, calls `expandOccurrences(...)`, emits one entry per occurrence with `occurrenceInstanceStart/End`), unique per-instance FullCalendar ids `${event.id}::${instanceISO}` at `:194`.
- The expander is `src/utils/recurrence.ts:212-250`: `rrulestr(recurrence, { dtstart: new Date(event.start) })`, `rule.between(rangeStart, rangeEnd, true)`, filters exceptions by ISO string, memoized via `expansionCache` keyed on id+range+rule+duration+sorted exceptions (`:195-210`).

**Server-side expansion also exists since `aa80d58`,** but only fires on date-range reads and conflict checks:

- `EventService.findAll` (`lib/services/EventService.ts:252-258`): when `filters.start && filters.end`, calls `expandRecurringInRange` (`:274-293`) → `generateOccurrences` (`:302-343`). Virtual occurrences get composite `id = ${master.id}::${occISO}`, `masterId`, `isRecurringInstance`, `occurrenceInstanceStart/End`; never persisted; unparseable RRULE falls back to returning the master (`:313-323`).
- `buildWhereClause` (`:197-214`) includes ALL recurring masters in range queries (`recurrence IS NOT NULL OR (date overlap)`) so masters whose stored start sits outside the window still expand.
- `getConflicts` (`:619-725`) pulls overlapping non-recurring events plus every recurring master, expands with a window padded back by the occurrence duration (`:670-684`) so an instance starting before the range but ending inside it is caught.
- The GET range path in both `api/events/index.ts:49-63` and the dev server `scripts/dev-server.ts` (`app.get('/api/events')`, range branch commented "findAll expands recurring masters into occurrences") wire through to it.
- Shared type documents the contract: `packages/shared/src/types/index.ts:48-55` (`isRecurringInstance`, `masterId`, composite id note).

### Recommendation: keep the current hybrid (client-side rendering, server-side for conflicts/range API). Do not migrate rendering to server expansion, do not adopt @fullcalendar/rrule.

Evidence-based reasons:

1. The live SPA path is range-less fetch + client expansion, and it works end-to-end including exceptions (same rrule lib, same ISO convention, identity toLocal/toUTC). Switching rendering to server range fetch would require per-view-range query keys (cache churn on every navigation) and would surface composite virtual ids to the edit paths — `PUT /api/events/master::iso` would 404 because `BaseService.findById` looks up the raw id. Nothing strips or resolves `masterId` client-side today.
2. `@fullcalendar/rrule` expects exceptions as EXDATE inside the rrule string; this app stores exceptions as a separate `text[]` of ISO strings, and the occurrence click-through/edit plumbing (`occurrenceInstanceStart/End` on `CalendarEvent`, `CalendarView.tsx:268-280` handleEventClick) is already built around the manual expansion. Adopting the plugin would be a rewrite for zero user-visible gain.
3. Server-side expansion is still needed and present where the client can't do it: conflict detection (#19 path) and any external/range API consumer.
   Document this as: "expansion is client-side for rendering (fed by the range-less GET), server-side for range queries and conflict checks" — which is literally what the `createRecurring` docblock now says (`EventService.ts:781-789`).

### Occurrence-vs-series edit/delete semantics (issue acceptance): implemented

- Delete THIS occurrence: `src/components/dialogs/EventDisplayDialog.tsx:330-333` — adds occurrence ISO to `exceptions`, PUTs master.
- Delete this AND FOLLOWING: `:343-345` — `clampRRuleUntil(recurrence, occStart)` (util at `src/utils/recurrence.ts`, replaces COUNT with UNTIL just before the occurrence), PUTs master.
- Edit THIS occurrence: `:378-383` — adds exception, then opens editor to create a one-off.
- Edit scope dialog on saving a recurring event: `src/components/dialogs/EventCreationDialog.tsx:616-646` (defers save, opens scope dialog) and `:1032-1130` — "This event" (exception + one-off create), "This and following" (clamp master + create new series with edited rule), "All events" (update master).
- Drag/drop of a recurring occurrence is intentionally reverted to force dialog editing: `CalendarView.tsx:287-290`.

### Acceptance criteria mapping (issue #8)

- [x] Daily recurring renders all occurrences in range — client expansion, CalendarView.
- [x] Weekly recurring renders all occurrences — same path.
- [x] Date-range reads and conflict checks account for occurrences server-side — `findAll` + `getConflicts` (above).
- [x] Edit distinguishes occurrence vs series — scope dialog.
- [x] Delete distinguishes occurrence vs series — EventDisplayDialog.

### Remaining gaps for #8 (QUICK follow-ups, none block closing the core issue)

1. **Zero automated tests for expansion.** `lib/services/__tests__/EventService.test.ts` tests CRUD-with-recurrence-field and conflicts (`:333,499,615-690`) but never calls `findAll` with a range against a recurring master, never tests exceptions filtering or the padded conflict window. There is no `src/utils/__tests__/recurrence.test.ts` at all. Add both; commands `npm run test:backend:run` and `npm run test:frontend:run`.
2. **Upcoming lists ignore recurrence.** `src/components/calendar/EventOverview.tsx:34-45` filters raw masters by `event.start`, so a recurring series whose master start is in the past shows no upcoming occurrences in the sidebar. Server `findUpcoming` (`EventService.ts:573-603`) has the same blind spot (`e.start >= now`, no expansion) — though no frontend code calls `?upcoming=true` today. Decide whether to fix (expand in EventOverview using `expandOccurrences` over [now, now+N days]) or explicitly document as out of scope.
3. **Latent double-expansion / composite-id trap.** Server virtual occurrences spread the master and therefore RETAIN the `recurrence` string (`EventService.ts:331-341`). If any client ever fetches with `?start=&end=` and feeds the result to CalendarView, each server occurrence would be re-expanded client-side (N^2 duplicates) and edits would PUT composite ids (404). Currently unreachable: `fetchEventsByDateRange` (`src/services/api/events.ts:310`) and `useEventsByDateRange` (`src/hooks/useEvents.ts:176`) have **no callers** in app code (grep verified; only definitions/exports). Cheap hardening: set `recurrence: null` on virtual instances in `generateOccurrences`, or have CalendarView skip events with `isRecurringInstance`.

---

## Issue #19 — conflict detection UI: ALREADY-FIXED

Implemented by `8b8e89d` ("feat(dialogs): implement Task tab and wire conflict detection (#17, #19)"). Verified in the working tree:

- **API client**: `eventApi.getConflicts` at `src/services/api/events.ts:363-405`. GET `/api/events/conflicts?start=&end=[&calendarId=][&excludeEventId=]`, parses `{conflicts, hasConflicts, count}`, returns `[]` on non-JSON responses so it degrades to advisory. Exported type `EventConflict` (`:50-55`), re-exported via `src/services/api/index.ts:22`.
- **Dialog wiring**: `src/components/dialogs/EventCreationDialog.tsx:482-524` — useEffect, 400ms debounce, runs only on the event tab with a valid start<end range, passes `excludeEventId: initialEventData?.id` (so editing an event doesn't conflict with itself) and `calendarId: selectedCalendarId` (memo at `:477-480` resolving the selected calendar name to id). Errors and cancellation clear the list.
- **Warning UI**: `:970-1006` — `role="alert"` yellow banner, "This time overlaps N existing events", lists each conflicting event's title + formatted time range, footer "You can still save, or adjust the time to avoid the overlap."
- **Non-blocking**: Save button at `:1017-1019` is gated only on `isFormValid || isSubmitting`; conflicts never disable it.
- **Backend endpoint**: `api/events/conflicts.ts:12-63` (GET, accepts `start/end` and legacy `startTime/endTime`, `excludeEventId`, `calendarId`). Service logic `EventService.getConflicts` (`lib/services/EventService.ts:619-725`) including recurring-occurrence expansion. Dev-server mirror route: `scripts/dev-server.ts:686-719`.
- **Backend tests exist** for the service: `lib/services/__tests__/EventService.test.ts:615-690` (same-slot, cross-calendar, adjacent, partial overlap, exclude-current).

### Acceptance criteria mapping (issue #19)

- [x] Overlap on create shows a warning sourced from `api/events/conflicts.ts` — yes (fetch is to that endpoint).
- [x] Warning lists the overlapping events — yes (title + time per conflict).
- [x] Non-blocking, user can proceed or adjust — yes.

### Nuances (informational, not defects vs. the issue)

- Conflicts are **scoped to the selected calendar** (dialog passes `calendarId`; backend then filters `e."calendarId" = $n` at `EventService.ts:653-656`). An overlap on a different calendar will not warn. The code comment at `EventCreationDialog.tsx:476` marks this deliberate. If cross-calendar warnings are wanted, drop the `calendarId` param in the dialog call — one-line change.
- Drag/drop rescheduling in CalendarView does not run a conflict check (the issue only required the dialog).
- No frontend component test asserts the banner renders; `src/components/dialogs/__tests__/` has no conflict test. Optional QUICK add.

---

## New defects found during triage (NOT yet filed — plan-mode recon; parent should `gh issue create` these per the standing log-issues rule)

1. **Changing an event's calendar in the edit dialog is silently dropped** (same silent-loss family as #29). The edit dialog sends `calendarName` in the update payload (`EventCreationDialog.tsx` handleSubmit `:637/:656`, scope-dialog "All events" `:1121`), `eventApi.updateEvent` spreads it straight through (`src/services/api/events.ts:216`), but `UpdateEventDTO` only understands `calendarId` (`EventService.ts:83`) and `update()` has no `calendarName` handling — unlike create, which resolves calendarName→calendarId client-side (`events.ts:144-151`) with a server-side legacy bridge (`api/events/index.ts:170-189`). Repro: edit an event, switch its calendar, save, hard reload → calendar reverts. Fix options: resolve calendarName→calendarId in `eventApi.updateEvent` (mirror the create path), or accept calendarName in the PUT handler. Suggested labels: bug, area: frontend, area: backend.
2. **Upcoming lists ignore recurring occurrences** (detailed under #8 gap 2). `EventOverview.tsx:34-45`, `EventService.findUpcoming:573-603`. Suggested label: bug (minor), area: frontend.
3. **Latent double-expansion/composite-id hazard on the unused range-fetch path** (detailed under #8 gap 3). Suggested label: tech-debt / hardening.

---

## Combined verification runbook (for the acceptance pass)

```bash
cd /home/shree/dev/taskflow-calendar
docker compose up -d                      # Postgres (react_calendar_dev)
npm run db:migrate && npm run db:migrate:status   # expect 003 applied
npm run dev:api                           # Express dev API on :3001 (scripts/dev-server.ts)
npx vite --port 5180 --strictPort         # 5173/5174 are held by other projects
```

Browser at http://localhost:5180:

1. #29: create event with a custom color → reload → color persists. Open a recurring event occurrence → "delete this occurrence" → reload → still gone.
2. #8: create a daily event (RRULE:FREQ=DAILY) → month view shows it every day; weekly likewise. Edit an occurrence → scope dialog offers This event / This and following / All events; each behaves per spec above.
3. #19: create an event overlapping an existing one on the same calendar → yellow banner appears after ~400ms listing the conflict; Save still enabled.
   API spot-checks: `GET http://localhost:3001/api/events?start=2026-07-01T00:00:00.000Z&end=2026-07-31T23:59:59.999Z` (Bearer token required; dev server may use devContext) → recurring masters appear as `master::ISO` composite-id occurrences with `isRecurringInstance: true`.

## Recommended issue disposition

- **#29**: run migration in dev + prod, run acceptance checks, close. Optionally add the round-trip test first.
- **#19**: run the one browser check, close. Note the same-calendar scoping in the closing comment.
- **#8**: close as fixed after acceptance checks, and file the follow-ups (tests for expansion, upcoming-list gap, virtual-instance hardening) as separate small issues rather than holding #8 open.
