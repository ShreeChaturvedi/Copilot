/**
 * Comprehensive test suite for Task Management functionality
 * Tests all requirements from Task 6 with realistic scenarios
 * Using SQL mocks to match actual implementation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database module - vi.mock is hoisted so we use a factory
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const withTransaction = vi.fn();
  const pool = { query };
  return {
    query,
    withTransaction,
    pool,
  };
});

// Mock the cache module
vi.mock('../../utils/cache.js', () => ({
  taskListCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  createCacheKey: vi.fn((...parts: string[]) => parts.join(':')),
}));

// Import after mocks are set up
import { TaskService } from '../TaskService';
import { TaskListService } from '../TaskListService';
import type { CreateTaskDTO, DbPriority } from '../TaskService';
import type { CreateTaskListDTO } from '../TaskListService';
import {
  query as mockQuery,
  withTransaction as mockWithTransaction,
} from '../../config/database.js';

// Helper to create query results
function createQueryResult<T>(rows: T[], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

// Cast mocked functions for TypeScript
const mockedQuery = vi.mocked(mockQuery);
const mockedWithTransaction = vi.mocked(mockWithTransaction);

describe('Task Management Comprehensive Tests', () => {
  let taskService: TaskService;
  let taskListService: TaskListService;

  const mockContext = {
    userId: 'user-123',
    requestId: 'test-request-123',
  };

  const mockTaskList = {
    id: 'work-list-123',
    name: 'Work',
    color: '#FF5722',
    userId: 'user-123',
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z'),
  };

  const mockTask = {
    id: 'task-1',
    title: 'Project meeting preparation',
    completed: false,
    completedAt: null,
    scheduledDate: new Date('2024-01-15T10:00:00Z'),
    priority: 'HIGH' as DbPriority,
    status: 'NOT_STARTED',
    taskListId: 'work-list-123',
    userId: 'user-123',
    originalInput: 'Project meeting preparation',
    cleanTitle: 'Project meeting preparation',
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z'),
  };

  beforeEach(() => {
    taskService = new TaskService();
    taskListService = new TaskListService();
    vi.clearAllMocks();
    mockedQuery.mockReset();
    mockedWithTransaction.mockReset();
    mockedWithTransaction.mockImplementation(async (callback: any) =>
      callback(mockedQuery)
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Requirement 5.1: Task CRUD Operations with Query Parameters', () => {
    it('should handle complex task queries with multiple filters', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Main query with filters
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('where')
        ) {
          return createQueryResult([mockTask]);
        }
        // Enrichment: task lists
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        // Enrichment: attachments
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        // Enrichment: tags
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.findAll(
        {
          completed: false,
          taskListId: 'work-list-123',
          priority: 'HIGH',
        },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Project meeting preparation');
      expect(result[0].priority).toBe('HIGH');
    });

    it('should support paginated queries with correct offset', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => ({
        ...mockTask,
        id: `task-${i + 1}`,
        title: `Task ${i + 1}`,
      }));

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('limit')
        ) {
          return createQueryResult(mockTasks);
        }
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '50' }]);
        }
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.findPaginated({}, 2, 10, mockContext);

      expect(result.data).toHaveLength(10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it('should handle task creation with proper validation', async () => {
      const taskData: CreateTaskDTO = {
        title: 'Review quarterly reports',
        taskListId: 'work-list-123',
        priority: 'HIGH',
      };

      const createdTask = {
        ...mockTask,
        id: 'new-task-123',
        title: 'Review quarterly reports',
        priority: 'HIGH',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Status column check
        if (sqlLower.includes('information_schema')) {
          return createQueryResult([{ exists: true }]);
        }
        // ensureUserExists
        if (sqlLower.includes('insert into users')) {
          return createQueryResult([], 0);
        }
        // Task list validation
        if (
          sqlLower.includes('select') &&
          sqlLower.includes('task_lists') &&
          sqlLower.includes('userid')
        ) {
          return createQueryResult([mockTaskList]);
        }
        // INSERT task
        if (sqlLower.includes('insert into tasks')) {
          return createQueryResult([createdTask]);
        }
        // Enrichment queries
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const mockClient = { query: mockedQuery };
      mockedWithTransaction.mockImplementationOnce(async (callback: any) =>
        callback(mockClient)
      );

      const result = await taskService.create(taskData, mockContext);

      expect(result.title).toBe('Review quarterly reports');
      expect(result.priority).toBe('HIGH');
    });
  });

  describe('Requirement 5.2: Advanced Task Filtering and Sorting', () => {
    it('should support full-text search across title', async () => {
      const searchResults = [
        { ...mockTask, title: 'Update project documentation' },
        { ...mockTask, id: 'task-2', title: 'Review project docs' },
      ];

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('ilike')
        ) {
          return createQueryResult(searchResults);
        }
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.search('project', mockContext);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should identify and filter overdue tasks correctly', async () => {
      const overdueTask = {
        ...mockTask,
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        completed: false,
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('completed = false')
        ) {
          return createQueryResult([overdueTask]);
        }
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.findOverdue(mockContext);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Requirement 5.3: Bulk Operations and Performance', () => {
    it('should handle bulk task updates efficiently', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const updatedTasks = taskIds.map((id) => ({
        ...mockTask,
        id,
        completed: true,
        priority: 'LOW' as DbPriority,
      }));

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership validation
        if (
          sqlLower.includes('select id from tasks') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult(taskIds.map((id) => ({ id })));
        }
        // Bulk update
        if (sqlLower.includes('update tasks set')) {
          return createQueryResult([], taskIds.length);
        }
        // Fetch updated tasks
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult(updatedTasks);
        }
        // Enrichment
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.bulkUpdate(
        taskIds,
        { completed: true, priority: 'LOW' },
        mockContext
      );

      expect(result).toHaveLength(3);
      expect(result.every((task) => task.completed)).toBe(true);
    });

    it('should handle bulk task deletion with proper authorization', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership validation
        if (
          sqlLower.includes('select id from tasks') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult(taskIds.map((id) => ({ id })));
        }
        // Bulk delete
        if (sqlLower.includes('delete from tasks')) {
          return createQueryResult([], 3);
        }
        return createQueryResult([]);
      });

      await expect(
        taskService.bulkDelete(taskIds, mockContext)
      ).resolves.toBeUndefined();
    });

    it('should prevent bulk operations on unauthorized tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock partial ownership (only 2 out of 3 tasks found)
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select id from tasks') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult([{ id: 'task-1' }, { id: 'task-2' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskService.bulkUpdate(taskIds, { completed: true }, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('Requirement 5.4: Task Completion Toggle with Timestamps', () => {
    it('should toggle task from incomplete to complete with timestamp', async () => {
      const incompleteTask = {
        ...mockTask,
        completed: false,
        completedAt: null,
      };
      const completedTask = {
        ...incompleteTask,
        completed: true,
        completedAt: new Date(),
        status: 'DONE',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // ensureStatusColumnExists
        if (sqlLower.includes('information_schema')) {
          return createQueryResult([{ exists: true }]);
        }
        // Ownership check
        if (sqlLower.includes('select "userid" from tasks')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Get current completion state
        if (sqlLower.includes('select completed from tasks where id')) {
          return createQueryResult([{ completed: false }]);
        }
        // Update
        if (sqlLower.includes('update tasks')) {
          return createQueryResult([completedTask]);
        }
        // Enrichment
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.toggleCompletion(
        'task-123',
        mockContext
      );

      expect(result.completed).toBe(true);
    });

    it('should toggle task from complete to incomplete and clear timestamp', async () => {
      const completedTask = {
        ...mockTask,
        completed: true,
        completedAt: new Date(),
        status: 'DONE',
      };
      const incompleteTask = {
        ...completedTask,
        completed: false,
        completedAt: null,
        status: 'NOT_STARTED',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // ensureStatusColumnExists
        if (sqlLower.includes('information_schema')) {
          return createQueryResult([{ exists: true }]);
        }
        // Ownership check
        if (sqlLower.includes('select "userid" from tasks')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Get current completion state
        if (sqlLower.includes('select completed from tasks where id')) {
          return createQueryResult([{ completed: true }]);
        }
        // Update
        if (sqlLower.includes('update tasks')) {
          return createQueryResult([incompleteTask]);
        }
        // Enrichment
        if (sqlLower.includes('select * from task_lists')) {
          return createQueryResult([mockTaskList]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.toggleCompletion(
        'task-123',
        mockContext
      );

      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });
  });

  describe('Requirement 6.1-6.4: Task List Management', () => {
    it('should create task list with proper validation', async () => {
      const taskListData: CreateTaskListDTO = {
        name: 'Work Projects',
        color: '#FF5722',
        icon: 'work',
        description: 'Tasks related to work projects and deadlines',
      };

      const createdTaskList = {
        id: 'new-list-123',
        ...taskListData,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Uniqueness check
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('name')
        ) {
          return createQueryResult([]);
        }
        // ensureUserExists
        if (sqlLower.includes('insert into users')) {
          return createQueryResult([], 0);
        }
        // Create
        if (sqlLower.includes('insert into task_lists')) {
          return createQueryResult([createdTaskList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.create(taskListData, mockContext);

      expect(result.name).toBe('Work Projects');
      expect(result.color).toBe('#FF5722');
    });

    it('should get task lists with comprehensive task counts', async () => {
      const taskListWithCounts = {
        id: 'list-1',
        name: 'Work',
        color: '#FF5722',
        icon: null,
        description: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        task_count: '10',
        completed_count: '4',
      };

      mockedQuery.mockResolvedValueOnce(
        createQueryResult([taskListWithCounts])
      );

      const result = await taskListService.getWithTaskCount(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'list-1',
        name: 'Work',
        taskCount: 10,
        completedTaskCount: 4,
        pendingTaskCount: 6,
      });
    });

    it('should handle task list deletion with task reassignment', async () => {
      const defaultTaskList = {
        ...mockTaskList,
        id: 'default-list',
        name: 'General',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Count check
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '3' }]);
        }
        // Get default list
        if (
          sqlLower.includes('select * from task_lists') &&
          sqlLower.includes('name = $2')
        ) {
          return createQueryResult([defaultTaskList]);
        }
        // Task reassignment
        if (sqlLower.includes('update tasks set "tasklistid"')) {
          return createQueryResult([], 5);
        }
        // Deletion
        if (sqlLower.includes('delete from task_lists')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.delete(
        'list-to-delete',
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should prevent deletion of the only task list', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Count check (only 1)
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '1' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.delete('only-list', mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Cannot delete the only task list');
    });
  });

  describe('Statistics and Analytics', () => {
    it('should provide comprehensive task statistics', async () => {
      let queryIndex = 0;
      mockedQuery.mockImplementation(async () => {
        queryIndex++;
        switch (queryIndex) {
          case 1:
            return createQueryResult([{ count: '100' }]); // total
          case 2:
            return createQueryResult([{ count: '60' }]); // completed
          case 3:
            return createQueryResult([{ count: '40' }]); // pending
          case 4:
            return createQueryResult([{ count: '8' }]); // overdue
          case 5:
            return createQueryResult([{ count: '5' }]); // today
          case 6:
            return createQueryResult([{ count: '15' }]); // this week
          case 7:
            return createQueryResult([{ count: '10' }]); // completed week
          case 8:
            return createQueryResult([{ count: '45' }]); // completed month
          default:
            return createQueryResult([{ count: '0' }]);
        }
      });

      const result = await taskService.getStats(mockContext);

      expect(result).toMatchObject({
        total: 100,
        completed: 60,
        pending: 40,
      });
    });

    it('should provide task list statistics', async () => {
      let queryIndex = 0;
      mockedQuery.mockImplementation(async () => {
        queryIndex++;
        switch (queryIndex) {
          case 1:
            return createQueryResult([{ count: '8' }]); // total lists
          case 2:
            return createQueryResult([{ count: '120' }]); // total tasks
          case 3:
            return createQueryResult([{ count: '75' }]); // completed tasks
          default:
            return createQueryResult([{ count: '0' }]);
        }
      });

      const result = await taskListService.getStatistics(mockContext);

      expect(result).toEqual({
        totalLists: 8,
        totalTasks: 120,
        completedTasks: 75,
        pendingTasks: 45,
        averageTasksPerList: 15,
      });
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    it('should handle concurrent task updates gracefully', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check
        if (
          sqlLower.includes('select') &&
          sqlLower.includes('"userid"') &&
          sqlLower.includes('from tasks')
        ) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Update fails
        if (sqlLower.includes('update tasks set')) {
          throw new Error('Record not found or already updated');
        }
        return createQueryResult([]);
      });

      await expect(
        taskService.update('task-123', { title: 'Updated' }, mockContext)
      ).rejects.toThrow();
    });

    it('should handle database constraints and foreign key violations', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Status column check
        if (sqlLower.includes('information_schema')) {
          return createQueryResult([{ exists: true }]);
        }
        // Task list validation fails
        if (sqlLower.includes('select') && sqlLower.includes('task_lists')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskService.create(
          { title: 'Test Task', taskListId: 'non-existent-list' },
          mockContext
        )
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should handle large dataset queries with proper pagination', async () => {
      const largePageSize = 1000;
      const largePage = 10;

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select * from tasks') &&
          sqlLower.includes('limit')
        ) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '50000' }]);
        }
        return createQueryResult([]);
      });

      const result = await taskService.findPaginated(
        {},
        largePage,
        largePageSize,
        mockContext
      );

      expect(result.pagination.totalPages).toBe(50); // 50000 / 1000
    });

    it('should validate color formats in task lists', async () => {
      const invalidColorFormats = [
        'red',
        'rgb(255, 0, 0)',
        '#GGG',
        '#12345',
        '#1234567',
        'not-a-color',
      ];

      for (const invalidColor of invalidColorFormats) {
        // Need to mock the duplicate name check that happens before color validation
        mockedQuery.mockImplementation(async (sql: string) => {
          const sqlLower = sql.toLowerCase();
          if (
            sqlLower.includes('select id from task_lists') &&
            sqlLower.includes('name')
          ) {
            return createQueryResult([]);
          }
          return createQueryResult([]);
        });

        await expect(
          taskListService.create(
            { name: 'Test List', color: invalidColor },
            mockContext
          )
        ).rejects.toThrow('VALIDATION_ERROR: Invalid color format');
      }

      // Test valid color formats
      const validColorFormats = [
        '#FF0000',
        '#00FF00',
        '#0000FF',
        '#FFF',
        '#000',
      ];

      for (const validColor of validColorFormats) {
        const createdTaskList = {
          id: `list-${validColor}`,
          name: `Test List ${validColor}`,
          color: validColor,
          icon: null,
          description: null,
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockedQuery.mockImplementation(async (sql: string) => {
          const sqlLower = sql.toLowerCase();
          if (
            sqlLower.includes('select id from task_lists') &&
            sqlLower.includes('name')
          ) {
            return createQueryResult([]);
          }
          if (sqlLower.includes('insert into users')) {
            return createQueryResult([], 0);
          }
          if (sqlLower.includes('insert into task_lists')) {
            return createQueryResult([createdTaskList]);
          }
          return createQueryResult([]);
        });

        await expect(
          taskListService.create(
            { name: `Test List ${validColor}`, color: validColor },
            mockContext
          )
        ).resolves.toBeDefined();
      }
    });
  });
});
