-- Add a description column to tasks.
--
-- The task UI (EnhancedTaskInput's description field, TaskDetailSheet) lets the
-- user enter/view a task description, but the tasks table had no column for it,
-- so anything typed was silently dropped. See issue #12. Events already have a
-- description column; this brings tasks in line.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is a no-op.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
