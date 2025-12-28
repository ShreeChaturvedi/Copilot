/**
 * Task statistics computation hook
 */

import { useMemo } from 'react';
import type { Task } from '@shared/types';

/**
 * Task status counts for analytics
 */
export interface TaskStatusCounts {
  /** Number of tasks not started */
  notStarted: number;
  /** Number of tasks in progress */
  inProgress: number;
  /** Number of completed tasks */
  done: number;
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks (alias for done) */
  completed: number;
  /** Completion percentage (0-100) */
  completionPct: number;
}

/**
 * Scope configuration for task filtering
 */
export interface TaskStatsScope {
  /** Filter by task list ID */
  taskListId?: string | null;
}

/**
 * Hook to compute task statistics from a task array
 *
 * @param tasks - Array of tasks to analyze
 * @param scope - Optional scope configuration for filtering
 * @returns Computed statistics with memoization
 */
export function useTaskStats(
  tasks: Task[],
  scope?: TaskStatsScope
): TaskStatusCounts {
  return useMemo(() => {
    // Filter tasks by scope if provided
    let filteredTasks = tasks;
    if (scope?.taskListId !== undefined && scope?.taskListId !== null) {
      if (scope.taskListId === 'default') {
        // Special handling: 'default' represents tasks not assigned to a specific list
        filteredTasks = tasks.filter((task) => !task.taskListId);
      } else {
        filteredTasks = tasks.filter(
          (task) => task.taskListId === scope.taskListId
        );
      }
    }

    // Initialize counters
    let notStarted = 0;
    let inProgress = 0;
    let done = 0;

    // Count tasks by status
    filteredTasks.forEach((task) => {
      // Check for backend status field (may be added in future)
      const backendStatus = task.status;

      if (backendStatus && typeof backendStatus === 'string') {
        // Map backend status values to our counts
        switch (backendStatus.toUpperCase()) {
          case 'NOT_STARTED':
          case 'NOT STARTED':
          case 'PENDING':
            notStarted++;
            break;
          case 'IN_PROGRESS':
          case 'IN PROGRESS':
          case 'ACTIVE':
            inProgress++;
            break;
          case 'DONE':
          case 'COMPLETED':
          case 'FINISHED':
            done++;
            break;
          default:
            // Fallback to completed flag for unknown status
            if (task.completed) {
              done++;
            } else {
              notStarted++;
            }
        }
      } else {
        // Current schema: only use completed boolean
        // For now, all non-completed tasks are "not started"
        // TODO: Add in_progress support when backend status field is available
        if (task.completed) {
          done++;
        } else {
          notStarted++;
        }
      }
    });

    const total = filteredTasks.length;
    const completed = done;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      notStarted,
      inProgress,
      done,
      total,
      completed,
      completionPct,
    };
  }, [tasks, scope?.taskListId]);
}
