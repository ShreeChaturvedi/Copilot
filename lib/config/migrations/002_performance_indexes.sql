-- Performance optimization indexes
-- Created: 2025-01-XX
-- Purpose: Add strategic indexes for common query patterns

-- Tasks table optimizations
-- Priority index for filtering and sorting by priority
CREATE INDEX IF NOT EXISTS "tasks_priority_idx" ON "public"."tasks"("priority");

-- UpdatedAt index for "recently modified" queries
CREATE INDEX IF NOT EXISTS "tasks_updatedAt_idx" ON "public"."tasks"("updatedAt");

-- Composite index for priority + completed filtering (common in task views)
CREATE INDEX IF NOT EXISTS "tasks_priority_completed_idx" ON "public"."tasks"("priority", "completed");

-- Composite index for scheduled date + priority (calendar view sorting)
CREATE INDEX IF NOT EXISTS "tasks_scheduledDate_priority_idx" ON "public"."tasks"("scheduledDate", "priority");

-- User-scoped composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "tasks_userId_priority_idx" ON "public"."tasks"("userId", "priority");

CREATE INDEX IF NOT EXISTS "tasks_userId_updatedAt_idx" ON "public"."tasks"("userId", "updatedAt");

-- Calendars table optimization
-- UpdatedAt for sync/refresh operations
CREATE INDEX IF NOT EXISTS "calendars_updatedAt_idx" ON "public"."calendars"("updatedAt");

-- Task lists table optimization
CREATE INDEX IF NOT EXISTS "task_lists_updatedAt_idx" ON "public"."task_lists"("updatedAt");

-- Events table optimization
-- Composite index for calendar + date range queries (very common)
CREATE INDEX IF NOT EXISTS "events_calendarId_start_end_idx" ON "public"."events"("calendarId", "start", "end");

-- UpdatedAt for sync operations
CREATE INDEX IF NOT EXISTS "events_updatedAt_idx" ON "public"."events"("updatedAt");

-- Performance notes:
-- 1. These indexes optimize common query patterns without significantly increasing write overhead
-- 2. Composite indexes are ordered by cardinality (high to low) for optimal query planning
-- 3. All indexes use IF NOT EXISTS to allow safe re-running
