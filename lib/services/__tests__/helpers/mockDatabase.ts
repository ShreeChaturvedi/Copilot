/**
 * Database mock helpers for testing SQL-backed services
 */
import { vi } from 'vitest';

/**
 * Create a mock query function that can be configured per test
 */
export const mockQuery = vi.fn();

/**
 * Create a mock withTransaction function
 */
export const mockWithTransaction = vi.fn().mockImplementation(async (callback) => {
  return callback(mockQuery);
});

/**
 * Mock pool object
 */
export const mockPool = {
  query: mockQuery,
  connect: vi.fn(),
  end: vi.fn(),
};

/**
 * Reset all database mocks
 */
export function resetDatabaseMocks() {
  mockQuery.mockReset();
  mockWithTransaction.mockReset();
  mockWithTransaction.mockImplementation(async (callback) => callback(mockQuery));
}

/**
 * Helper to create a mock query result
 */
export function createQueryResult<T>(rows: T[], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

/**
 * Setup common mock responses for task-related queries
 */
export function setupTaskMocks(options: {
  tasks?: any[];
  taskLists?: any[];
  tags?: any[];
  attachments?: any[];
}) {
  const { tasks = [], taskLists = [], tags = [], attachments = [] } = options;

  // Default implementation chains for common queries
  mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('from tasks') && sqlLower.includes('select')) {
      return createQueryResult(tasks);
    }
    if (sqlLower.includes('from task_lists') || sqlLower.includes('from "task_lists"')) {
      return createQueryResult(taskLists);
    }
    if (sqlLower.includes('from task_tags') || sqlLower.includes('from "task_tags"')) {
      return createQueryResult(tags);
    }
    if (sqlLower.includes('from attachments')) {
      return createQueryResult(attachments);
    }
    if (sqlLower.includes('insert')) {
      return createQueryResult([{ id: 'new-id', ...params }], 1);
    }
    if (sqlLower.includes('update')) {
      return createQueryResult([], 1);
    }
    if (sqlLower.includes('delete')) {
      return createQueryResult([], 1);
    }
    if (sqlLower.includes('count')) {
      return createQueryResult([{ count: '0' }]);
    }
    
    return createQueryResult([]);
  });
}
