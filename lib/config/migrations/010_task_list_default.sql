-- Add an explicit default flag to task lists.
--
-- TaskListService.setDefault (exposed by the PATCH /api/task-lists/[id]
-- ?action=set-default endpoint) and the api handler already expected an
-- "isDefault" concept, but the table had no column to back it, so the endpoint
-- threw at runtime ("setDefault is not a function"). This adds the flag so a
-- user can pick which list is their default; getDefault now prefers it and
-- falls back to the "General"/first-created list when none is flagged. Mirrors
-- the calendars."isDefault" design. See issue #75.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is a no-op.

ALTER TABLE task_lists
  ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false;

-- At most one default list per owner. A partial unique index enforces this
-- without blocking the many rows where isDefault = false.
CREATE UNIQUE INDEX IF NOT EXISTS "task_lists_one_default_per_user"
  ON task_lists ("userId")
  WHERE "isDefault" = true;
