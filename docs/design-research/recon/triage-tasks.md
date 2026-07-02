# Triage: issues #30, #12, #11 — taskflow-calendar

Verified against branch `finish-polish-deploy` at HEAD `3d6b329` on 2026-07-01. All paths relative to `/home/shree/dev/taskflow-calendar` unless absolute.

## Verdict table

| Issue | Title                                                               | Classification    | Fixed by commit                                                          | On HEAD?               |
| ----- | ------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------ | ---------------------- |
| #30   | Removing a task tag via PUT /api/tasks/:id ignored by backend       | **ALREADY-FIXED** | `cadf296` fix(tasks): persist tag changes on task update (2026-06-26)    | yes (ancestor of HEAD) |
| #12   | Tasks have no description column but UI references task.description | **ALREADY-FIXED** | `e7b9e8b` feat(tasks): persist task descriptions end to end (2026-06-26) | yes                    |
| #11   | Task list archiving throws NOT_IMPLEMENTED                          | **ALREADY-FIXED** | `ae94981` feat(task-lists): implement task list archiving (2026-06-26)   | yes                    |

All three GitHub issues are still **OPEN**. Each fix commit message says "Closes #NN when the finish-polish-deploy PR merges" — so they auto-close on merge to main. No code work needed; only the acceptance checks below plus three small optional follow-ups (end of doc).

Ancestry verified with `git merge-base --is-ancestor <sha> HEAD` for all three shas.

---

## Issue #30 — tag removal on task update

### Issue claim (from `gh issue view 30`)

`TaskService.update` never touched `task_tags`; `UpdateTaskDTO` had no `tags`; removed tag reappeared on refetch. Suggested fix: handle `tags` in update by rewriting `task_tags`.

### Current state: FIXED, exactly the suggested approach (full tag-set replacement, not per-tag diff)

- `lib/services/TaskService.ts:117-124` — `UpdateTaskDTO.tags?: Array<{ type: string; name?: string; value; displayText; iconName; color? }>`. Doc comment (111-116): when provided, REPLACES the full tag set; `type` accepted case-insensitively; `name` defaults to lowercased `value`; `[]` clears all tags.
- `lib/services/TaskService.ts:759-797` — `update()` runs scalar UPDATE + tag rewrite inside `withTransaction`:
  - 766-770: `DELETE FROM "task_tags" WHERE "taskId" = $1`
  - 771-786: per tag, find-or-create in `tags` via `INSERT ... ON CONFLICT (name) DO NOTHING` then `SELECT id FROM tags WHERE name = $1` (name = `(tagData.name ?? tagData.value).trim().toLowerCase()`, type = `String(tagData.type).toUpperCase()`)
  - 787-794: `INSERT INTO "task_tags" ... ON CONFLICT ("taskId","tagId") DO NOTHING`
  - Mirrors create()'s tag logic (lines 642-671).
- Schema constraints backing the ON CONFLICTs exist: `tags.name UNIQUE` (`lib/config/migrations/001_initial_schema.sql:126`), `task_tags PRIMARY KEY ("taskId","tagId")` (`001_initial_schema.sql:141`).
- API pass-through: `api/tasks/[id].ts:89-94` (PUT: `req.body` as `UpdateTaskDTO` straight into `taskService.update`) and `:161-171` (PATCH default branch, same). Dev server parity: `scripts/dev-server.ts:123-133` (`app.put('/api/tasks/:id')` passes `req.body` to `taskService.update`).
- Frontend chain intact:
  - `src/hooks/useTaskManagement.ts:278-290` — `handleRemoveTag` sends the remaining tag set: `updateTask.mutate({ id, updates: { tags: task.tags.filter(t => t.id !== tagId) || [] } })`.
  - `src/hooks/useTasks.ts:154-156` — mutationFn typed `{ id: string; updates: Partial<Task> }` → `taskApi.updateTask(id, updates)`, so `tags` typechecks and flows.
  - `src/services/api/tasks.ts:338-366` — `updateTask` body is `{ ...data, ... }`, so `tags` is serialized into the PUT body.
  - Frontend tag shape (from `reviveTaskDates`, `src/services/api/tasks.ts:116-141`) is `{ id, type: lowercase string, value, displayText, iconName, color? }` — matches what the backend now accepts (type uppercased server-side, extra `id` field ignored, `name` defaulted from `value`).
- Commit `cadf296` message records manual verification: DB round-trip on dev API — create with [work, urgent] → PUT tags=[work] → refetch shows only [work]; PUT tags=[] → refetch shows [].

### Residual gap (optional)

No automated test covers the tags-in-update path. `cadf296` touched only `lib/services/TaskService.ts` (59 insertions). `lib/services/__tests__/TaskService.test.ts` `describe('update')` (lines 305-383) tests scalar props/toggle/authz only; no `tags` case. If desired: add a unit test asserting that `update(id, { tags: [...] })` issues DELETE on `task_tags` + re-inserts, and that `tags: []` clears (mock DB helper at `lib/services/__tests__/helpers/mockDatabase.ts`).

### Acceptance checks

1. Unit tests pass: `npx vitest run --config vitest.backend.config.ts lib/services/__tests__/TaskService.test.ts`
2. Live round-trip (dev stack, see "Local dev stack" below; dev-server uses a devContext, no auth header needed on :3001):
   ```bash
   # create task with 2 tags
   curl -s -X POST http://localhost:3001/api/tasks -H 'Content-Type: application/json' -d '{"title":"tagtest","tags":[{"type":"LABEL","name":"work","value":"work","displayText":"#work","iconName":"Tag"},{"type":"LABEL","name":"urgent","value":"urgent","displayText":"#urgent","iconName":"Tag"}]}'
   # remove one (send remaining set) — use returned id
   curl -s -X PUT http://localhost:3001/api/tasks/<ID> -H 'Content-Type: application/json' -d '{"tags":[{"type":"label","value":"work","displayText":"#work","iconName":"Tag"}]}'
   # refetch: must show only "work"; then clear:
   curl -s -X PUT http://localhost:3001/api/tasks/<ID> -H 'Content-Type: application/json' -d '{"tags":[]}'
   ```
3. UI: remove a tag chip from a task, reload the page → tag stays removed. Add tags via update still works.

---

## Issue #12 — task.description not persisted

### Issue claim

Tasks table and TaskService had no `description` column; four components read `.description`; anything typed was silently dropped. Proposed: add column via migration + thread through, OR remove UI references.

### Current state: FIXED via "add the column" (option A), end to end

- Migration: `lib/config/migrations/004_task_description.sql:10` — `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;` (idempotent). Migration runner: `scripts/migrate.ts` applies `lib/config/migrations/*.sql` in lexical order, records in `schema_migrations`. npm scripts: `db:migrate`, `db:migrate:status` (`package.json:40-41`).
- Backend `lib/services/TaskService.ts`:
  - `CreateTaskDTO.description?` (line 74), `UpdateTaskDTO.description?` (line 102)
  - create INSERT includes description (lines 624-629, param `data.description?.trim() || null`)
  - update SET includes description (lines 705-708)
  - `transformEntity` (line 294) explicitly maps `description: row.description ?? null` — this was the subtle bit (task columns are mapped explicitly, unlike EventService); without it the column persisted but never round-tripped. Present and correct.
  - `findMany`/`findById` use `SELECT *`, so the column is read.
- Shared type: `packages/shared/src/types/index.ts:91` — `Task.description?: string`.
- Frontend:
  - `src/services/api/tasks.ts:17` (`CreateTaskData.description?`), `:39` (`UpdateTaskData.description?`), `:204` (createTask payload sends `description: data.description`); `reviveTaskDates` spreads `...task` so description comes back on reads.
  - `src/components/smart-input/EnhancedTaskInput.tsx:92` (`descriptionText` state), `:298-333` (carried into submit in both smart and non-smart paths).
  - `src/hooks/useTaskManagement.ts:230` (`description: smartData?.description` forwarded in handleAddTask).
  - `src/components/tasks/TaskDetailSheet.tsx:201-214` displays `task.description || task.parsedMetadata?.originalInput` (the old unsafe cast was dropped in `e7b9e8b`).
- Important scoping note: the `description` references in `src/components/tasks/TaskList.tsx`, `TaskFolderGrid.tsx`, `TaskGroupList.tsx` (listed in the issue) are **task-GROUP (task list) descriptions**, backed by the real `task_lists.description` column (`001_initial_schema.sql:90`). They were never broken. Only `TaskDetailSheet.tsx` read `task.description`, and that is now backed by the new column.

### Residual gap (optional)

No UI affordance to edit the description of an EXISTING task. TaskDetailSheet is display-only for description; the task edit flow sends title only (`src/hooks/useTaskManagement.ts:258-263`, `updates: { title }`). The backend PUT fully supports `description` updates. This is polish, not the filed bug (the issue's core — "silently fail to persist" — is resolved: entry at create time persists and displays).

### Deployment prerequisite

Migration 004 must actually be applied to the target DB (Neon for prod, Docker PG for dev). Could not verify applied-state locally: Docker Postgres is NOT currently running (`docker compose ps` empty). Check with:

```bash
cd /home/shree/dev/taskflow-calendar && docker compose up -d && npm run db:migrate:status
# prod: DATABASE_URL=<neon-url> npm run db:migrate:status  (then db:migrate if pending)
```

### Acceptance checks

1. `npm run db:migrate` applies 004 cleanly (idempotent, safe to re-run).
2. Live: create a task with a description via EnhancedTaskInput's secondary field → reload → TaskDetailSheet shows it. API round-trip:
   ```bash
   curl -s -X POST http://localhost:3001/api/tasks -H 'Content-Type: application/json' -d '{"title":"desc test","description":"hello"}'
   curl -s http://localhost:3001/api/tasks/<ID>   # data.description == "hello"
   curl -s -X PUT http://localhost:3001/api/tasks/<ID> -H 'Content-Type: application/json' -d '{"description":"edited"}'
   ```

---

## Issue #11 — task list archiving NOT_IMPLEMENTED

### Issue claim

`TaskListService.archive()` threw `NOT_IMPLEMENTED`, `getArchived()` returned `[]`, no schema support. Proposed: implement (migration + service + exclude from defaults + UI affordance) OR remove dead methods.

### Current state: FIXED via full implementation (wf-g5-archive merge, commit `ae94981`)

- Migration: `lib/config/migrations/006_task_list_archive.sql:11,14` — `ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false;` + `"archivedAt" timestamptz`.
- Service `lib/services/TaskListService.ts`:
  - Entity fields `isArchived` / `archivedAt` (lines 20-21); filter `includeArchived?` (line 66)
  - Default queries exclude archived: `findAll` adds `"isArchived" = false` unless `includeArchived` (lines 162-163); `getDefault` lookups filter `"isArchived" = false` (lines 348, 357)
  - `archive()` (lines 671-703): ownership-checked UPDATE `SET "isArchived" = true, "archivedAt" = NOW()`
  - `unarchive()` (lines 708-739): clears both
  - `getArchived()` (lines 745-760): real query ordered by `archivedAt DESC NULLS LAST`
  - The old NOT_IMPLEMENTED throw is gone (no `NOT_IMPLEMENTED` anywhere in the file).
- API: `api/task-lists/[id].ts:131-146` — PATCH `?action=archive` / `?action=unarchive`; `api/task-lists/index.ts:22-28` — GET `?archived=true` returns `getArchived()`.
- Dev server parity: `scripts/dev-server.ts:402` (`req.query.archived === 'true'`), `:446-449` (archive/unarchive actions).
- UI affordance (archive): `src/components/ui/BaseList.tsx:584-589` — "Archive" dropdown item (hidden for the default list, `!item.isDefault`); wired `TaskGroupList.tsx:96-98,146` → `LeftPane.tsx:104,286-287,517` → `useTaskManagement.ts:436-447` `handleArchiveTaskGroup` calls `PATCH /api/task-lists/:id?action=archive`.
- Unit tests: `lib/services/__tests__/TaskListService.test.ts:742-813` — describe blocks for `archive` (marks archived, non-owner throws, no-context throws), `unarchive` (clears flag), `getArchived` (returns archived lists, no-context throws).

### Residual gap (optional)

No UI to VIEW archived lists or unarchive. `grep -rn "archived=true\|getArchived\|unarchive" src/` (excluding tests) returns nothing — a user who archives a list can only get it back via the API (`PATCH ?action=unarchive`). The issue's acceptance bullet "list archived" is satisfied at the API level; an "Archived lists" view + Unarchive button would complete the loop. Small MEDIUM enhancement if wanted: add an "Archived" section/dialog in LeftPane fetching `GET /api/task-lists?archived=true`, with per-item Unarchive.

### Deployment prerequisite

Migration 006 must be applied (same `npm run db:migrate` as above; also brings 005, 007, 008 if pending).

### Acceptance checks

1. `npx vitest run --config vitest.backend.config.ts lib/services/__tests__/TaskListService.test.ts`
2. Live:
   ```bash
   curl -s -X PATCH 'http://localhost:3001/api/task-lists/<ID>?action=archive'
   curl -s http://localhost:3001/api/task-lists            # archived list absent
   curl -s 'http://localhost:3001/api/task-lists?archived=true'  # archived list present
   curl -s -X PATCH 'http://localhost:3001/api/task-lists/<ID>?action=unarchive'
   ```
3. UI: three-dot menu on a non-default task list shows "Archive"; archiving hides the list; tasks default queries unaffected.

---

## Local dev stack (for acceptance runs)

```bash
cd /home/shree/dev/taskflow-calendar
docker compose up -d                       # Postgres (postgres:postgres@localhost:5432/react_calendar_dev)
npm run db:migrate                         # applies 001-008 idempotently
npx tsx scripts/dev-server.ts              # Express dev API on :3001 (devContext, no auth header needed)
npx vite --port 5180 --strictPort          # UI; /api proxies to :3001. MUST be 5180 (5173/5174 taken)
```

Docker Postgres was NOT running during this recon, so applied-migration state and live round-trips were not re-executed; the fix commits' own messages record DB round-trip verification for #30 and #12, and #11 has unit tests.

## Recommended actions

1. Nothing to code for these three issues. Leave them open — each fix commit closes its issue automatically when the finish-polish-deploy PR merges to main (commit messages contain "Closes #NN"). If closing earlier, comment with the fixing sha.
2. Before deploy: run `npm run db:migrate` against the production (Neon) DATABASE_URL — migrations 004 and 006 are hard prerequisites for #12 and #11.
3. Optional follow-ups (file as new gh issues per the project's standing log-issues rule; not filed during this recon because it ran in plan mode / read-only):
   - test gap: no unit test for tags-in-update (`TaskService.update` tags path) — `lib/services/__tests__/TaskService.test.ts`
   - UI gap: no way to view/unarchive archived task lists (API-only)
   - UI gap: no way to edit an existing task's description (backend supports it; edit flow is title-only)
