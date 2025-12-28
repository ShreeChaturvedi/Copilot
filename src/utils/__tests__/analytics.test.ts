/**
 * Tests for analytics utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  GroupBy,
  RangePreset,
  getDateRange,
  bucketize,
  computeStatusCounts,
  getWeeklyCompletions,
  getOverdueCount,
} from '../analytics';

// Mock tasks for testing
const mockTasks = [
  {
    id: '1',
    title: 'Task 1',
    completed: false,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    taskListId: 'list1',
  },
  {
    id: '2',
    title: 'Task 2',
    completed: true,
    createdAt: new Date('2024-01-02T10:00:00Z'),
    completedAt: new Date('2024-01-03T10:00:00Z'),
    taskListId: 'list1',
  },
  {
    id: '3',
    title: 'Task 3',
    completed: false,
    createdAt: new Date('2024-01-05T10:00:00Z'),
    taskListId: 'list2',
    scheduledDate: new Date('2023-12-30T10:00:00Z'), // Overdue
  },
  {
    id: '4',
    title: 'Task 4',
    completed: true,
    createdAt: new Date('2024-01-07T10:00:00Z'),
    completedAt: new Date('2024-01-08T10:00:00Z'),
    taskListId: null, // No list assigned
  },
  {
    id: '5',
    title: 'Task 5 with backend status',
    completed: false,
    createdAt: new Date('2024-01-10T10:00:00Z'),
    taskListId: 'list1',
    status: 'IN_PROGRESS', // Backend status field
  },
];

describe('getDateRange', () => {
  it('should handle 7d preset correctly', () => {
    const result = getDateRange('7d');
    const today = new Date();
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() - 6);
    expectedStart.setHours(0, 0, 0, 0);

    expect(result.start.getDate()).toBe(expectedStart.getDate());
    expect(result.end.getDate()).toBe(today.getDate());
  });

  it('should handle 30d preset correctly', () => {
    const result = getDateRange('30d');
    const today = new Date();
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() - 29);
    expectedStart.setHours(0, 0, 0, 0);

    expect(result.start.getDate()).toBe(expectedStart.getDate());
    expect(result.end.getDate()).toBe(today.getDate());
  });

  it('should handle 90d preset correctly', () => {
    const result = getDateRange('90d');
    const today = new Date();
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() - 89);
    expectedStart.setHours(0, 0, 0, 0);

    expect(result.start.getDate()).toBe(expectedStart.getDate());
    expect(result.end.getDate()).toBe(today.getDate());
  });

  it('should handle ytd preset correctly', () => {
    const result = getDateRange('ytd');
    const today = new Date();

    expect(result.start.getFullYear()).toBe(today.getFullYear());
    expect(result.start.getMonth()).toBe(0); // January
    expect(result.start.getDate()).toBe(1);
    expect(result.end.getDate()).toBe(today.getDate());
  });

  it('should handle custom range correctly', () => {
    const customStart = new Date('2024-01-01T10:00:00Z');
    const customEnd = new Date('2024-01-10T15:00:00Z');

    const result = getDateRange({ start: customStart, end: customEnd });

    expect(result.start.getDate()).toBe(1);
    expect(result.start.getHours()).toBe(0); // Start of day
    expect(result.end.getDate()).toBe(10);
    expect(result.end.getHours()).toBe(23); // End of day
  });

  it('should default to 30d for unknown preset', () => {
    const result = getDateRange('invalid' as RangePreset);
    const today = new Date();
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() - 29);

    expect(result.start.getDate()).toBe(expectedStart.getDate());
    expect(result.end.getDate()).toBe(today.getDate());
  });
});

describe('bucketize', () => {
  it('should bucket tasks by day correctly', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-03T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Day, range, {
      includeCompleted: true,
    });

    // Find the buckets for the specific dates we're interested in
    const jan01Bucket = result.buckets.find((b) => b.key === 'Jan 01');
    const jan02Bucket = result.buckets.find((b) => b.key === 'Jan 02');
    const jan03Bucket = result.buckets.find((b) => b.key === 'Jan 03');

    expect(jan01Bucket).toBeDefined();
    expect(jan01Bucket!.created).toBe(1); // Task 1
    expect(jan01Bucket!.completed).toBe(0);

    expect(jan02Bucket).toBeDefined();
    expect(jan02Bucket!.created).toBe(1); // Task 2
    expect(jan02Bucket!.completed).toBe(0);

    expect(jan03Bucket).toBeDefined();
    expect(jan03Bucket!.created).toBe(0);
    expect(jan03Bucket!.completed).toBe(1); // Task 2 completed

    expect(result.totals.created).toBe(2);
    expect(result.totals.completed).toBe(1);
  });

  it('should filter by list ID correctly', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-10T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Day, range, {
      includeCompleted: true,
      listId: 'list1',
    });

    // Should only include tasks from list1 (Task 1, Task 2, Task 5)
    expect(result.totals.created).toBe(3);
    expect(result.totals.completed).toBe(1); // Only Task 2
  });

  it('should handle default list (no taskListId) correctly', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-10T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Day, range, {
      includeCompleted: true,
      listId: 'default',
    });

    // Should only include tasks with no taskListId (Task 4)
    expect(result.totals.created).toBe(1);
    expect(result.totals.completed).toBe(1); // Task 4
  });

  it('should respect includeCompleted option', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-10T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Day, range, {
      includeCompleted: false,
    });

    // Should include all 5 tasks created in the range
    expect(result.totals.created).toBe(5); // All tasks created
    expect(result.totals.completed).toBe(0); // No completed counts due to option
  });

  it('should bucket by week correctly', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-14T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Week, range, {
      includeCompleted: true,
    });

    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets[0].key).toMatch(/Wk \d+/); // Week format
  });

  it('should bucket by month correctly', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-02-28T23:59:59Z'),
    };

    const result = bucketize(mockTasks, GroupBy.Month, range, {
      includeCompleted: true,
    });

    // Check that we have at least the months we expect
    const jan2024Bucket = result.buckets.find((b) => b.key === 'Jan 2024');
    const feb2024Bucket = result.buckets.find((b) => b.key === 'Feb 2024');

    expect(jan2024Bucket).toBeDefined();
    expect(feb2024Bucket).toBeDefined();
  });
});

describe('computeStatusCounts', () => {
  it('should count statuses correctly with backend status field', () => {
    const result = computeStatusCounts(mockTasks);

    expect(result.notStarted).toBe(2); // Task 1, Task 3
    expect(result.inProgress).toBe(1); // Task 5 (has backend status)
    expect(result.done).toBe(2); // Task 2, Task 4
  });

  it('should filter by list ID correctly', () => {
    const result = computeStatusCounts(mockTasks, 'list1');

    expect(result.notStarted).toBe(1); // Task 1
    expect(result.inProgress).toBe(1); // Task 5
    expect(result.done).toBe(1); // Task 2
  });

  it('should handle default list correctly', () => {
    const result = computeStatusCounts(mockTasks, 'default');

    expect(result.notStarted).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(1); // Task 4
  });

  it('should fallback to completed flag when no backend status', () => {
    const tasksWithoutStatus = mockTasks.map((task) => {
      const taskWithoutStatus = {
        ...task,
      } as typeof task & { status?: string };
      delete taskWithoutStatus.status;
      return taskWithoutStatus;
    });

    const result = computeStatusCounts(tasksWithoutStatus);

    expect(result.notStarted).toBe(3); // Task 1, Task 3, Task 5
    expect(result.inProgress).toBe(0); // No backend status available
    expect(result.done).toBe(2); // Task 2, Task 4
  });
});

describe('getWeeklyCompletions', () => {
  it('should return completion counts for current week', () => {
    const result = getWeeklyCompletions(mockTasks);

    expect(result).toHaveLength(7); // 7 days of the week
    expect(result.every((count) => typeof count === 'number')).toBe(true);
    expect(result.every((count) => count >= 0)).toBe(true);
  });

  it('should filter by list ID correctly', () => {
    const result = getWeeklyCompletions(mockTasks, 'list1');

    expect(result).toHaveLength(7);
    expect(result.every((count) => typeof count === 'number')).toBe(true);
  });
});

describe('getOverdueCount', () => {
  it('should count overdue tasks correctly', () => {
    const result = getOverdueCount(mockTasks);

    expect(result).toBe(1); // Task 3 is overdue
  });

  it('should filter by list ID correctly', () => {
    const resultList1 = getOverdueCount(mockTasks, 'list1');
    const resultList2 = getOverdueCount(mockTasks, 'list2');

    expect(resultList1).toBe(0); // No overdue tasks in list1
    expect(resultList2).toBe(1); // Task 3 is overdue in list2
  });

  it('should not count completed tasks as overdue', () => {
    const tasksWithCompletedOverdue = [
      ...mockTasks,
      {
        id: '6',
        title: 'Completed Overdue Task',
        completed: true,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-02T10:00:00Z'),
        scheduledDate: new Date('2023-12-30T10:00:00Z'),
        taskListId: 'list1',
      },
    ];

    const result = getOverdueCount(tasksWithCompletedOverdue);

    expect(result).toBe(1); // Still only Task 3, not the completed one
  });

  it('should not count tasks without scheduled date as overdue', () => {
    const tasksWithoutScheduled = mockTasks.filter(
      (task) => !task.scheduledDate
    );

    const result = getOverdueCount(tasksWithoutScheduled);

    expect(result).toBe(0); // No tasks with scheduled dates
  });
});
