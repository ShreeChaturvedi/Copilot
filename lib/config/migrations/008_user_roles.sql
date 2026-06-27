-- Add a role column to users so requireRole can enforce real authorization.
-- Defaults every existing and new user to the baseline 'USER' role; promote to
-- 'ADMIN' manually when an account needs elevated access.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'USER';
