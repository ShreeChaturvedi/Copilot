## Kanban View and Task Status Implementation

### Overview
This document summarizes the end-to-end implementation of the task status model and the new Kanban view in the task-focused experience. It covers data model changes, backend service logic, API surface and client normalization, UI integrations (list view, detail sheet, and Kanban), drag-and-drop behavior, and UX decisions. The goal was to introduce a cohesive status workflow while preserving existing features and visual language across the app.

### Status model and semantics
- Canonical statuses (frontend): `not_started | in_progress | done`
- Canonical statuses (backend/DB): `NOT_STARTED | IN_PROGRESS | DONE`
- Checkbox linkage (bidirectional):
  - Ticked checkbox -> DONE; DONE -> ticked
  - Unticked checkbox -> NOT_STARTED; NOT_STARTED/IN_PROGRESS -> unticked
- Defaults: New tasks default to NOT_STARTED and are unticked

### Backend (pure SQL) changes
- File: `lib/services/TaskService.ts`
  - Added `status` to `TaskEntity`
  - Runtime migration guard `ensureStatusColumnExists()`
    - Adds `status TEXT NOT NULL DEFAULT 'NOT_STARTED'` if missing
    - Backfills: rows with `completed=true` become `DONE`, others `NOT_STARTED`
  - Create: inserts tasks with `status='NOT_STARTED'` unless provided otherwise
  - Update: keeps `status` ↔ `completed` in sync
    - If `status` is set: DONE forces `completed=true`; others force `completed=false` unless explicitly overridden
    - If only `completed` is set: sets `status` to `DONE`/`NOT_STARTED` accordingly
  - Toggle completion: flips `completed` and sets `status` to `DONE`/`NOT_STARTED`
  - Transform: derives `status` from row (falls back to `DONE`/`NOT_STARTED` when older data lacks the column)

### Shared types
- File: `packages/shared/src/types/index.ts`
  - `Task` now includes optional `status?: 'not_started' | 'in_progress' | 'done'`

### API surface & client normalization
- Files: `api/tasks/index.ts`, `api/tasks/[id].ts`
  - PATCH/PUT normalization: if `status` is provided without `completed`, the route sets `completed` from `status` before delegating to the service
- File: `src/services/api/tasks.ts`
  - Request mapping: frontend status -> backend enum (e.g., `done` -> `DONE`)
  - Response mapping: backend enum -> frontend string (e.g., `IN_PROGRESS` -> `in_progress`)
  - If `status` is sent without `completed`, we infer `completed` (DONE => true; others => false) to keep client/server in lockstep

### React Query hooks
- File: `src/hooks/useTasks.ts`
  - `updateTask` optimistic updates now keep checkbox and status linked in cache; when status changes to `done`, `completed` and `completedAt` are set optimistically

### List view (right pane)
- File: `src/components/tasks/TaskItem.tsx`
  - Inline status tag (small badge/dropdown) to the left of the title when not completed
  - Hidden in contexts where it is redundant: left-pane summary and Kanban (see visibility rules below)
  - No change to the 3-dot menu; existing options preserved

### Detail sheet (right pane)
- File: `src/components/tasks/TaskDetailSheet.tsx`
  - Added a status property at the top of the property list with a lucide `Loader` icon to the left
  - Reuses the same status badge component for consistency

### Kanban view
- Access
  - `src/stores/uiStore.ts`: added `kanban` to `TaskViewMode`
  - `src/components/tasks/TaskFolderGrid.tsx`: clicking a folder switches the right pane to Kanban for that task list
  - `src/components/layout/TaskFocusPane.tsx`: lazy-loads `TaskKanbanBoard` for the `kanban` view mode
- Board
  - File: `src/components/tasks/TaskKanbanBoard.tsx`
  - Three fixed columns: Not Started, In Progress, Done
  - Columns filter tasks per active task list; order is stable and responsive (1 column on small screens, 3 on larger)
  - Removed the redundant local “back to folders” row; users can switch via the existing UI

### Drag & drop (dnd-kit)
- Dependency: `@dnd-kit/core` (minimal bundle)
- Provider/usage: local to `TaskKanbanBoard.tsx`
  - `DndContext` + `PointerSensor`
  - `useDroppable` for columns (exposes `columnKey`); subtle outline highlight on hover
  - `useDraggable` for cards; transforms apply to the actual element (no ghost copy) with high z-index so the card stays above columns during drag
  - On drop, status is committed; DONE also sets `completed=true`
- References:
  - dnd-kit docs: https://docs.dndkit.com/
  - dnd-kit repo: https://github.com/clauderic/dnd-kit

### Status badge visibility rules
- Visible: Right-pane list view (TaskItem), when a task is not completed
- Hidden:
  - Left-pane task summary (uses `calendarMode`) to avoid redundancy in the compact list
  - Kanban cards (column headers already represent status)

### Styling & responsiveness
- Kanban columns: bordered containers with muted background; column headers use the app’s label styling without chip background
- Draggable card: subtle ring during drag; z-index raised for proper stacking above columns
- Status badge: single line (no wrapping next to title) to preserve compact row height

### Compatibility & constraints
- No existing flows were removed; checkbox semantics remain intact and now drive status explicitly
- No new filter endpoints added; the groundwork is laid to filter by status in the future without breaking changes

### Files changed (high-level)
- Backend
  - `lib/services/TaskService.ts` (status column, linkage, toggling, transform)
- Shared types
  - `packages/shared/src/types/index.ts` (Task.status)
- API
  - `api/tasks/[id].ts` (status↔completed normalization for partial updates)
- Client API
  - `src/services/api/tasks.ts` (status mapping request/response)
- Hooks
  - `src/hooks/useTasks.ts` (optimistic linkage)
- UI (list/detail)
  - `src/components/tasks/TaskItem.tsx` (inline status badge; hidden in compact contexts)
  - `src/components/tasks/TaskDetailSheet.tsx` (status property with Loader icon)
- Kanban
  - `src/stores/uiStore.ts` (add `kanban` view)
  - `src/components/tasks/TaskFolderGrid.tsx` (folder click → Kanban view)
  - `src/components/layout/TaskFocusPane.tsx` (lazy-load Kanban)
  - `src/components/tasks/TaskKanbanBoard.tsx` (board, dnd-kit behavior)

### Developer notes
- The backend uses a guard to add the `status` column at runtime in development; proper migrations are recommended for production environments
- If server filters by status are needed, extend `TaskFilters` and `buildWhereClause` accordingly

### Future enhancements (optional)
- Column-wise color accents and per-column actions (bulk move, collapse)
- Keyboard and touch sensors for drag-and-drop
- Drag overlay preview
- Status-aware filtering and sorting controls


