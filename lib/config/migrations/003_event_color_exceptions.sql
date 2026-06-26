-- Add per-event color and recurrence exceptions.
--
-- The frontend sends `color` (per-event override of the calendar color) and
-- `exceptions` (ISO date strings identifying deleted/edited occurrences of a
-- recurring event) on create/update, but the events table had nowhere to store
-- them, so those edits were silently dropped on refetch. See issue #29.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is a no-op.

ALTER TABLE events ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS exceptions text[] NOT NULL DEFAULT '{}';
