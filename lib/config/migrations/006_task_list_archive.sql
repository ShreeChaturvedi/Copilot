-- Add archive support to task lists.
--
-- Task list archiving was exposed in TaskListService (archive/getArchived) but
-- always threw NOT_IMPLEMENTED / returned [] because the table had no column to
-- back it. This adds an "isArchived" flag plus an "archivedAt" timestamp so a
-- list can be soft-hidden from the default views and restored later. See issue #11.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is a no-op.

ALTER TABLE task_lists
  ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false;

ALTER TABLE task_lists
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz;
