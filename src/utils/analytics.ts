/**
 * Task Analytics Utility Functions
 * Pure functions for client-side analytics computation
 */

import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  format,
  startOfYear,
} from 'date-fns';
import type { Task } from '@shared/types';

/**
 * Time grouping options for analytics
 */
export enum GroupBy {
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

/**
 * String-only preset values for ViewSwitcher compatibility
 */
export type RangePresetValue = '7d' | '30d' | '90d' | 'ytd';

/**
 * Predefined time range presets or custom range
 */
export type RangePreset = RangePresetValue | { start: Date; end: Date };

/**
 * Bucket data for time series analytics
 */
export interface TimeBucket {
  /** Unique key for the bucket (e.g., '2024-01-15', 'Week 3', 'Jan 2024') */
  key: string;
  /** Start date of the bucket */
  start: Date;
  /** End date of the bucket */
  end: Date;
  /** Number of tasks created in this bucket */
  created: number;
  /** Number of tasks completed in this bucket */
  completed: number;
}

/**
 * Bucketing options
 */
export interface BucketOptions {
  /** Whether to include completed tasks in counts */
  includeCompleted?: boolean;
  /** Filter by specific list ID */
  listId?: string | null;
}

/**
 * Bucketing result with buckets and totals
 */
export interface BucketingResult {
  /** Array of time buckets with counts */
  buckets: TimeBucket[];
  /** Aggregated totals across all buckets */
  totals: {
    created: number;
    completed: number;
  };
}

/**
 * Status count breakdown
 */
export interface StatusCounts {
  /** Number of not started tasks */
  notStarted: number;
  /** Number of in progress tasks */
  inProgress: number;
  /** Number of completed tasks */
  done: number;
}

/**
 * Convert a range preset to actual start and end dates
 */
export function getDateRange(preset: RangePreset): { start: Date; end: Date } {
  const now = new Date();
  const today = startOfDay(now);

  if (typeof preset === 'object') {
    // Custom range
    return {
      start: startOfDay(preset.start),
      end: endOfDay(preset.end),
    };
  }

  switch (preset) {
    case '7d':
      return {
        start: addDays(today, -6), // Last 7 days including today
        end: endOfDay(now),
      };
    case '30d':
      return {
        start: addDays(today, -29), // Last 30 days including today
        end: endOfDay(now),
      };
    case '90d':
      return {
        start: addDays(today, -89), // Last 90 days including today
        end: endOfDay(now),
      };
    case 'ytd':
      return {
        start: startOfYear(now),
        end: endOfDay(now),
      };
    default:
      // Default to 30 days if unknown preset
      return {
        start: addDays(today, -29),
        end: endOfDay(now),
      };
  }
}

/**
 * Generate bucket start dates for a given range and grouping
 */
function generateBucketDates(start: Date, end: Date, groupBy: GroupBy): Date[] {
  const buckets: Date[] = [];
  let current: Date;

  switch (groupBy) {
    case GroupBy.Day:
      current = startOfDay(start);
      while (current <= end) {
        buckets.push(new Date(current));
        current = addDays(current, 1);
      }
      break;
    case GroupBy.Week:
      current = startOfWeek(start, { weekStartsOn: 1 }); // Monday start
      while (current <= end) {
        buckets.push(new Date(current));
        current = addWeeks(current, 1);
      }
      break;
    case GroupBy.Month:
      current = startOfMonth(start);
      while (current <= end) {
        buckets.push(new Date(current));
        current = addMonths(current, 1);
      }
      break;
  }

  return buckets;
}

/**
 * Generate a key for a bucket based on its start date and grouping
 */
function getBucketKey(date: Date, groupBy: GroupBy): string {
  switch (groupBy) {
    case GroupBy.Day:
      return format(date, 'MMM dd');
    case GroupBy.Week:
      return format(date, "'Wk' w");
    case GroupBy.Month:
      return format(date, 'MMM yyyy');
    default:
      return format(date, 'MMM dd');
  }
}

/**
 * Get the end date for a bucket
 */
function getBucketEnd(date: Date, groupBy: GroupBy): Date {
  switch (groupBy) {
    case GroupBy.Day:
      return endOfDay(date);
    case GroupBy.Week:
      return endOfWeek(date, { weekStartsOn: 1 });
    case GroupBy.Month:
      return endOfMonth(date);
    default:
      return endOfDay(date);
  }
}

/**
 * Check if a task belongs to a specific list
 */
function isTaskInList(task: Task, listId?: string | null): boolean {
  if (listId === undefined || listId === null) {
    return true; // No filter, include all tasks
  }

  if (listId === 'default') {
    // Special handling: 'default' represents tasks not assigned to a specific list
    return !task.taskListId;
  }

  return task.taskListId === listId;
}

/**
 * Check if a task was created within a date range
 */
function isTaskCreatedInRange(task: Task, start: Date, end: Date): boolean {
  if (!task.createdAt) return false;
  const createdDate = new Date(task.createdAt);
  return createdDate >= start && createdDate <= end;
}

/**
 * Check if a task was completed within a date range
 */
function isTaskCompletedInRange(task: Task, start: Date, end: Date): boolean {
  if (!task.completed || !task.completedAt) return false;
  const completedDate = new Date(task.completedAt);
  return completedDate >= start && completedDate <= end;
}

/**
 * Bucketize tasks by time periods with creation and completion counts
 */
export function bucketize(
  tasks: Task[],
  groupBy: GroupBy,
  range: { start: Date; end: Date },
  options: BucketOptions = {}
): BucketingResult {
  const { includeCompleted = true, listId } = options;

  // Filter tasks by list if specified
  const filteredTasks = tasks.filter((task) => isTaskInList(task, listId));

  // Generate bucket dates
  const bucketDates = generateBucketDates(range.start, range.end, groupBy);

  // Initialize buckets
  const buckets: TimeBucket[] = bucketDates.map((bucketStart) => ({
    key: getBucketKey(bucketStart, groupBy),
    start: bucketStart,
    end: getBucketEnd(bucketStart, groupBy),
    created: 0,
    completed: 0,
  }));

  // Count tasks in each bucket
  let totalCreated = 0;
  let totalCompleted = 0;

  for (const bucket of buckets) {
    // Count created tasks
    bucket.created = filteredTasks.filter((task) =>
      isTaskCreatedInRange(task, bucket.start, bucket.end)
    ).length;

    // Count completed tasks (if including completed)
    if (includeCompleted) {
      bucket.completed = filteredTasks.filter((task) =>
        isTaskCompletedInRange(task, bucket.start, bucket.end)
      ).length;
    }

    totalCreated += bucket.created;
    totalCompleted += bucket.completed;
  }

  return {
    buckets,
    totals: {
      created: totalCreated,
      completed: totalCompleted,
    },
  };
}

/**
 * Compute status counts for tasks (compatible with existing useTaskStats logic)
 */
export function computeStatusCounts(
  tasks: Task[],
  listId?: string | null
): StatusCounts {
  // Filter tasks by list if specified
  const filteredTasks = tasks.filter((task) => isTaskInList(task, listId));

  let notStarted = 0;
  let inProgress = 0;
  let done = 0;

  for (const task of filteredTasks) {
    // Use the same status mapping logic as useTaskStats
    // Prefer backend status if present, fallback to completed flag
    const backendStatus = (task as Task & { status?: string }).status;
    const normalizedStatus =
      typeof backendStatus === 'string'
        ? backendStatus.toLowerCase()
        : undefined;

    if (normalizedStatus) {
      switch (normalizedStatus) {
        case 'not_started':
          notStarted++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'done':
          done++;
          break;
        default:
          // Unknown status, treat as not started
          notStarted++;
      }
    } else {
      // Fallback to completed flag
      if (task.completed) {
        done++;
      } else {
        notStarted++;
      }
    }
  }

  return {
    notStarted,
    inProgress,
    done,
  };
}

/**
 * Get the current week's dates (Monday to Sunday)
 */
export function getCurrentWeekDates(): Date[] {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(weekStart, i));
  }

  return dates;
}

/**
 * Get completion counts for the current week (for sparkline)
 */
export function getWeeklyCompletions(
  tasks: Task[],
  listId?: string | null
): number[] {
  const weekDates = getCurrentWeekDates();
  const filteredTasks = tasks.filter((task) => isTaskInList(task, listId));

  return weekDates.map((date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    return filteredTasks.filter((task) =>
      isTaskCompletedInRange(task, dayStart, dayEnd)
    ).length;
  });
}

/**
 * Calculate overdue task count
 */
export function getOverdueCount(tasks: Task[], listId?: string | null): number {
  const now = new Date();
  const filteredTasks = tasks.filter((task) => isTaskInList(task, listId));

  return filteredTasks.filter(
    (task) =>
      !task.completed &&
      task.scheduledDate &&
      new Date(task.scheduledDate) < now
  ).length;
}

/**
 * Weekly status data for enhanced heatmap
 */
export interface WeeklyStatusData {
  day: string;
  date: Date;
  completed: number;
  inProgress: number;
  overdue: number;
  scheduled: number;
}

/**
 * Get status breakdown for each day of the current week
 * Shows completed, in-progress, and overdue tasks per day
 */
export function getWeeklyStatusBreakdown(
  tasks: Task[],
  listId?: string | null
): WeeklyStatusData[] {
  const weekDates = getCurrentWeekDates();
  const filteredTasks = tasks.filter((task) => isTaskInList(task, listId));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();

  return weekDates.map((date, index) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Tasks completed on this day
    const completed = filteredTasks.filter((task) =>
      isTaskCompletedInRange(task, dayStart, dayEnd)
    ).length;

    // Tasks that were/are in progress on this day (status = 'in_progress' and scheduled for this day)
    const inProgress = filteredTasks.filter(
      (task) =>
        !task.completed &&
        task.status === 'in_progress' &&
        task.scheduledDate &&
        startOfDay(new Date(task.scheduledDate)) <= dayEnd &&
        startOfDay(new Date(task.scheduledDate)) >= dayStart
    ).length;

    // Tasks that were overdue on this day (scheduled before this day and not completed)
    const overdue = filteredTasks.filter((task) => {
      if (task.completed) return false;
      if (!task.scheduledDate) return false;
      const scheduledDate = new Date(task.scheduledDate);
      // For past days: was overdue on that day
      // For today: currently overdue
      if (dayEnd < now) {
        return scheduledDate < dayStart;
      } else if (dayStart <= now && now <= dayEnd) {
        return scheduledDate < now;
      }
      return false;
    }).length;

    // Tasks scheduled for this day (regardless of status)
    const scheduled = filteredTasks.filter((task) => {
      if (!task.scheduledDate) return false;
      const scheduledDate = startOfDay(new Date(task.scheduledDate));
      return scheduledDate >= dayStart && scheduledDate <= dayEnd;
    }).length;

    return {
      day: days[index],
      date,
      completed,
      inProgress,
      overdue,
      scheduled,
    };
  });
}
