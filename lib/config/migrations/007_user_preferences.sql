-- 007_user_preferences.sql
-- Workspace preference columns for the Settings > Preferences tab.
-- Stored on user_profiles (one row per user, created at registration). Column
-- names are double-quoted camelCase to match the service-layer SQL.
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is safe.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS "defaultView" text NOT NULL DEFAULT 'calendar';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS "weekStartsOn" integer NOT NULL DEFAULT 0;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS "notificationsEnabled" boolean NOT NULL DEFAULT false;
