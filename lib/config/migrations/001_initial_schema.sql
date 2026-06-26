-- 001_initial_schema.sql
-- Initial database schema for Taskflow Calendar.
-- Column names are double-quoted camelCase to match the service-layer SQL
-- (lib/services/*). Timestamps are TIMESTAMP WITHOUT TIME ZONE and treated as
-- UTC by the pg type parser in lib/config/database.ts. IDs are text generated
-- with gen_random_uuid()::text.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users and authentication --------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email       text NOT NULL UNIQUE,
  name        text,
  password    text,
  "googleId"  text UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bio         text,
  "avatarUrl" text,
  timezone    text NOT NULL DEFAULT 'UTC',
  "userId"    text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

-- Refresh tokens (DB-backed so sessions survive serverless cold starts).
-- Stores a SHA-256 hash of the refresh token, never the raw token.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tokenHash" text NOT NULL UNIQUE,
  "userId"    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  family      text NOT NULL,
  "issuedAt"  timestamp NOT NULL DEFAULT NOW(),
  "expiresAt" timestamp NOT NULL,
  revoked     boolean NOT NULL DEFAULT false,
  "revokedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON refresh_tokens("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON refresh_tokens(family);

-- Calendars and events ------------------------------------------------------

CREATE TABLE IF NOT EXISTS calendars (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#3B82F6',
  description text,
  "isVisible" boolean NOT NULL DEFAULT true,
  "isDefault" boolean NOT NULL DEFAULT false,
  "userId"    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", name)
);
CREATE INDEX IF NOT EXISTS "calendars_userId_idx" ON calendars("userId");

CREATE TABLE IF NOT EXISTS events (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title        text NOT NULL,
  description  text,
  "start"      timestamp NOT NULL,
  "end"        timestamp NOT NULL,
  "allDay"     boolean NOT NULL DEFAULT false,
  location     text,
  notes        text,
  recurrence   text,
  "calendarId" text NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  "userId"     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt"  timestamp NOT NULL DEFAULT NOW(),
  "updatedAt"  timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "events_userId_idx" ON events("userId");
CREATE INDEX IF NOT EXISTS "events_calendarId_idx" ON events("calendarId");
CREATE INDEX IF NOT EXISTS "events_start_end_idx" ON events("start", "end");
CREATE INDEX IF NOT EXISTS "events_userId_start_end_idx" ON events("userId", "start", "end");

-- Task lists and tasks ------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_lists (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#8B5CF6',
  icon        text,
  description text,
  "userId"    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", name)
);
CREATE INDEX IF NOT EXISTS "task_lists_userId_idx" ON task_lists("userId");

CREATE TABLE IF NOT EXISTS tasks (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title           text NOT NULL,
  completed       boolean NOT NULL DEFAULT false,
  "completedAt"   timestamp,
  "scheduledDate" timestamp,
  priority        text NOT NULL DEFAULT 'MEDIUM',
  status          text NOT NULL DEFAULT 'NOT_STARTED',
  "originalInput" text,
  "cleanTitle"    text,
  "taskListId"    text NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  "userId"        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt"     timestamp NOT NULL DEFAULT NOW(),
  "updatedAt"     timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "tasks_userId_idx" ON tasks("userId");
CREATE INDEX IF NOT EXISTS "tasks_taskListId_idx" ON tasks("taskListId");
CREATE INDEX IF NOT EXISTS "tasks_completed_idx" ON tasks(completed);
CREATE INDEX IF NOT EXISTS "tasks_scheduledDate_idx" ON tasks("scheduledDate");
CREATE INDEX IF NOT EXISTS "tasks_userId_completed_idx" ON tasks("userId", completed);
CREATE INDEX IF NOT EXISTS "tasks_userId_taskListId_completed_idx" ON tasks("userId", "taskListId", completed);
CREATE INDEX IF NOT EXISTS "tasks_userId_scheduledDate_idx" ON tasks("userId", "scheduledDate");
CREATE INDEX IF NOT EXISTS "tasks_createdAt_idx" ON tasks("createdAt");

-- Tags ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL UNIQUE,
  type        text NOT NULL,
  color       text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "tags_type_idx" ON tags(type);
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON tags(name);

CREATE TABLE IF NOT EXISTS task_tags (
  "taskId"      text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "tagId"       text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  value         text NOT NULL,
  "displayText" text NOT NULL,
  "iconName"    text NOT NULL,
  PRIMARY KEY ("taskId", "tagId")
);
CREATE INDEX IF NOT EXISTS "task_tags_taskId_idx" ON task_tags("taskId");
CREATE INDEX IF NOT EXISTS "task_tags_tagId_idx" ON task_tags("tagId");

-- Attachments ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attachments (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fileName"     text NOT NULL,
  "fileUrl"      text NOT NULL,
  "fileType"     text NOT NULL,
  "fileSize"     integer NOT NULL,
  "taskId"       text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "thumbnailUrl" text,
  "createdAt"    timestamp NOT NULL DEFAULT NOW(),
  "updatedAt"    timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "attachments_taskId_idx" ON attachments("taskId");
