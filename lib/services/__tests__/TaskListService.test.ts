/**
 * Unit tests for TaskListService
 * Tests business logic and data access operations using SQL mocks
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database module - vi.mock is hoisted so we use a factory
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const pool = { query };
  return {
    query,
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
import { TaskListService } from '../TaskListService';
import type {
  CreateTaskListDTO,
  UpdateTaskListDTO,
  TaskListFilters,
} from '../TaskListService';
import { query as mockQuery } from '../../config/database.js';

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

// Test data
const mockTaskList = {
  id: 'list-123',
  name: 'General',
  color: '#8B5CF6',
  icon: 'list',
  description: 'Default task list',
  userId: 'user-123',
  createdAt: new Date('2024-01-14T10:00:00Z'),
  updatedAt: new Date('2024-01-14T10:00:00Z'),
};

const mockContext = {
  userId: 'user-123',
  requestId: 'test-request-123',
};

// Cast mocked functions for TypeScript
const mockedQuery = vi.mocked(mockQuery);

describe('TaskListService', () => {
  let taskListService: TaskListService;

  beforeEach(() => {
    taskListService = new TaskListService();
    vi.clearAllMocks();
    mockedQuery.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should find all task lists for a user', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));

      const result = await taskListService.findAll({}, mockContext);

      expect(mockedQuery).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('list-123');
    });

    it('should apply search filter', async () => {
      const filters: TaskListFilters = { search: 'work' };
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskListService.findAll(filters, mockContext);

      expect(mockedQuery).toHaveBeenCalled();
      // Verify the query contains ILIKE for search
      const queryCall = mockedQuery.mock.calls[0];
      expect(queryCall[0]).toContain('ILIKE');
      expect(result).toHaveLength(0);
    });

    it('should apply hasActiveTasks filter', async () => {
      const filters: TaskListFilters = { hasActiveTasks: true };
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));

      const result = await taskListService.findAll(filters, mockContext);

      expect(mockedQuery).toHaveBeenCalled();
      // Verify the query contains EXISTS subquery for active tasks
      const queryCall = mockedQuery.mock.calls[0];
      expect(queryCall[0]).toContain('EXISTS');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no task lists found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskListService.findAll({}, mockContext);

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    const createTaskListData: CreateTaskListDTO = {
      name: 'Work Tasks',
      color: '#FF5722',
      icon: 'work',
      description: 'Tasks related to work projects',
    };

    it('should create a task list successfully', async () => {
      const createdTaskList = {
        ...mockTaskList,
        ...createTaskListData,
        id: 'new-list-123',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Duplicate name check - no existing list with this name
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
        // INSERT task list
        if (sqlLower.includes('insert into task_lists')) {
          return createQueryResult([createdTaskList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.create(
        createTaskListData,
        mockContext
      );

      expect(result.name).toBe('Work Tasks');
      expect(result.color).toBe('#FF5722');
    });

    it('should throw validation error for empty name', async () => {
      const invalidData = { ...createTaskListData, name: '' };

      await expect(
        taskListService.create(invalidData, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Task list name is required');
    });

    it('should throw validation error for duplicate name', async () => {
      // Mock existing task list with same name
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('name')
        ) {
          return createQueryResult([{ id: 'existing-list' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.create(createTaskListData, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Task list name already exists');
    });

    it('should throw validation error for invalid color format', async () => {
      const invalidData = { ...createTaskListData, color: 'invalid-color' };

      // Mock the duplicate check that happens before color validation
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
        taskListService.create(invalidData, mockContext)
      ).rejects.toThrow(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    });

    it('should accept valid hex colors', async () => {
      const validColors = ['#FF0000', '#00FF00', '#0000FF', '#FFF', '#000'];

      for (const color of validColors) {
        const dataWithColor = { ...createTaskListData, color };
        const createdTaskList = {
          ...mockTaskList,
          ...dataWithColor,
          id: `list-${color}`,
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
          taskListService.create(dataWithColor, mockContext)
        ).resolves.toBeDefined();
      }
    });
  });

  describe('update', () => {
    const updateData: UpdateTaskListDTO = {
      name: 'Updated Task List',
      color: '#4CAF50',
      icon: 'updated',
      description: 'Updated description',
    };

    it('should update a task list successfully', async () => {
      const updatedTaskList = { ...mockTaskList, ...updateData };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check (checkOwnership in validateUpdate)
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Duplicate name check
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('name')
        ) {
          return createQueryResult([]);
        }
        // UPDATE query
        if (sqlLower.includes('update task_lists')) {
          return createQueryResult([updatedTaskList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.update(
        'list-123',
        updateData,
        mockContext
      );

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Task List');
      expect(result?.color).toBe('#4CAF50');
    });

    it('should throw validation error for empty name', async () => {
      const invalidData = { ...updateData, name: '' };

      await expect(
        taskListService.update('list-123', invalidData, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Task list name cannot be empty');
    });

    it('should throw authorization error for non-owned task list', async () => {
      // Mock ownership check fails (different userId)
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'other-user' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.update('list-123', updateData, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR: Access denied');
    });

    it('should throw authorization error when task list not found', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.update('non-existent', updateData, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR: Access denied');
    });

    it('should throw validation error for duplicate name', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check passes
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Duplicate name check fails (different list with same name exists)
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('name')
        ) {
          return createQueryResult([{ id: 'other-list-123' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.update('list-123', updateData, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Task list name already exists');
    });

    it('should throw validation error for invalid color format', async () => {
      const invalidData = { ...updateData, color: 'not-a-hex-color' };

      // Mock ownership check passes
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.update('list-123', invalidData, mockContext)
      ).rejects.toThrow(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    });
  });

  describe('getDefault', () => {
    it('should return existing General task list', async () => {
      const generalTaskList = { ...mockTaskList, name: 'General' };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // First query looks for General by name = $2
        if (
          sqlLower.includes('select * from task_lists') &&
          sqlLower.includes('name = $2')
        ) {
          return createQueryResult([generalTaskList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.getDefault(mockContext);

      expect(result.name).toBe('General');
    });

    it('should return first task list if no General list exists', async () => {
      const firstTaskList = { ...mockTaskList, name: 'First List' };
      let generalQueryCalled = false;

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // First call: look for General - not found
        if (sqlLower.includes('name = $2') && !generalQueryCalled) {
          generalQueryCalled = true;
          return createQueryResult([]);
        }
        // Second call: get first task list
        if (sqlLower.includes('order by "createdat" asc')) {
          return createQueryResult([firstTaskList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.getDefault(mockContext);

      expect(result.name).toBe('First List');
    });

    it('should create General task list if none exist', async () => {
      const newGeneralList = {
        ...mockTaskList,
        name: 'General',
        id: 'new-general-id',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Look for General - not found
        if (
          sqlLower.includes('select * from task_lists') &&
          sqlLower.includes('name = $2')
        ) {
          return createQueryResult([]);
        }
        // Look for any task list - not found
        if (sqlLower.includes('order by "createdat" asc')) {
          return createQueryResult([]);
        }
        // Check for duplicate name during create
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
        // Create new General list
        if (sqlLower.includes('insert into task_lists')) {
          return createQueryResult([newGeneralList]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.getDefault(mockContext);

      expect(result.name).toBe('General');
    });

    it('should throw error when no user context provided', async () => {
      await expect(taskListService.getDefault()).rejects.toThrow(
        'AUTHORIZATION_ERROR: User ID required'
      );
    });
  });

  describe('getWithTaskCount', () => {
    it('should return task lists with task counts', async () => {
      const taskListWithCounts = {
        id: 'list-123',
        name: 'General',
        color: '#8B5CF6',
        icon: 'list',
        description: 'Default task list',
        userId: 'user-123',
        createdAt: new Date('2024-01-14T10:00:00Z'),
        updatedAt: new Date('2024-01-14T10:00:00Z'),
        task_count: '3',
        completed_count: '1',
      };

      mockedQuery.mockResolvedValueOnce(
        createQueryResult([taskListWithCounts])
      );

      const result = await taskListService.getWithTaskCount(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'list-123',
        taskCount: 3,
        completedTaskCount: 1,
        pendingTaskCount: 2,
      });
    });

    it('should throw error when no user context provided', async () => {
      await expect(taskListService.getWithTaskCount()).rejects.toThrow(
        'AUTHORIZATION_ERROR: User ID required'
      );
    });
  });

  describe('getWithTasks', () => {
    it('should return task lists with detailed task information', async () => {
      const taskListRow = {
        id: 'list-123',
        name: 'General',
        color: '#8B5CF6',
        icon: 'list',
        description: 'Default task list',
        userId: 'user-123',
        createdAt: new Date('2024-01-14T10:00:00Z'),
        updatedAt: new Date('2024-01-14T10:00:00Z'),
      };

      const taskRows = [
        {
          id: 'task-1',
          title: 'Task 1',
          completed: false,
          scheduledDate: new Date('2024-01-15T10:00:00Z'),
          priority: 'MEDIUM',
          taskListId: 'list-123',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          completed: true,
          scheduledDate: new Date('2024-01-16T10:00:00Z'),
          priority: 'HIGH',
          taskListId: 'list-123',
        },
      ];

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Get task lists
        if (
          sqlLower.includes('select * from task_lists') &&
          sqlLower.includes('order by name')
        ) {
          return createQueryResult([taskListRow]);
        }
        // Get tasks for those lists
        if (sqlLower.includes('select id, title')) {
          return createQueryResult(taskRows);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.getWithTasks(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].tasks).toHaveLength(2);
    });

    it('should throw error when no user context provided', async () => {
      await expect(taskListService.getWithTasks()).rejects.toThrow(
        'AUTHORIZATION_ERROR: User ID required'
      );
    });
  });

  describe('reorder', () => {
    it('should reorder task lists successfully', async () => {
      const taskListIds = ['list-1', 'list-2', 'list-3'];
      const taskLists = taskListIds.map((id) => ({ ...mockTaskList, id }));

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership validation
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult(taskListIds.map((id) => ({ id })));
        }
        // Individual fetches for ordering
        if (sqlLower.includes('select * from task_lists where id = $1')) {
          // Return the appropriate task list based on the param
          const matchingList = taskLists[0];
          return createQueryResult([matchingList || taskLists[0]]);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.reorder(taskListIds, mockContext);

      expect(result).toHaveLength(3);
    });

    it('should throw validation error if some task lists are not owned', async () => {
      const taskListIds = ['list-1', 'list-2', 'list-3'];

      // Mock partial ownership (only 2 out of 3 found)
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (
          sqlLower.includes('select id from task_lists') &&
          sqlLower.includes('in')
        ) {
          return createQueryResult([{ id: 'list-1' }, { id: 'list-2' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.reorder(taskListIds, mockContext)
      ).rejects.toThrow(
        'VALIDATION_ERROR: Some task lists not found or access denied'
      );
    });

    it('should throw error when no user context provided', async () => {
      await expect(
        taskListService.reorder(['list-1'], undefined)
      ).rejects.toThrow('AUTHORIZATION_ERROR: User ID required');
    });
  });

  describe('delete', () => {
    it('should delete a task list and move tasks to default list', async () => {
      const defaultTaskList = {
        ...mockTaskList,
        id: 'default-list',
        name: 'General',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check (checkOwnership)
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Count check (more than 1 task list) - uses BaseService.count via buildWhereClause
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '2' }]);
        }
        // Get default task list (General)
        if (
          sqlLower.includes('select * from task_lists') &&
          sqlLower.includes('name = $2')
        ) {
          return createQueryResult([defaultTaskList]);
        }
        // Task reassignment
        if (sqlLower.includes('update tasks set "tasklistid"')) {
          return createQueryResult([], 3);
        }
        // Deletion
        if (sqlLower.includes('delete from task_lists')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const result = await taskListService.delete('list-123', mockContext);

      expect(result).toBe(true);
    });

    it('should throw validation error when trying to delete the only task list', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Ownership check passes
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([{ userId: 'user-123' }]);
        }
        // Count check (only 1 task list)
        if (sqlLower.includes('select count(*)')) {
          return createQueryResult([{ count: '1' }]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.delete('list-123', mockContext)
      ).rejects.toThrow('VALIDATION_ERROR: Cannot delete the only task list');
    });

    it('should throw authorization error for non-owned task list', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select "userid" from task_lists')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      await expect(
        taskListService.delete('list-123', mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR: Access denied');
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive task list statistics', async () => {
      let queryIndex = 0;
      mockedQuery.mockImplementation(async () => {
        queryIndex++;
        // The service uses Promise.all with 3 queries in parallel
        switch (queryIndex) {
          case 1:
            return createQueryResult([{ count: '5' }]); // total lists
          case 2:
            return createQueryResult([{ count: '25' }]); // total tasks
          case 3:
            return createQueryResult([{ count: '15' }]); // completed tasks
          default:
            return createQueryResult([{ count: '0' }]);
        }
      });

      const result = await taskListService.getStatistics(mockContext);

      expect(result).toEqual({
        totalLists: 5,
        totalTasks: 25,
        completedTasks: 15,
        pendingTasks: 10,
        averageTasksPerList: 5,
      });
    });

    it('should handle zero task lists gracefully', async () => {
      mockedQuery.mockResolvedValue(createQueryResult([{ count: '0' }]));

      const result = await taskListService.getStatistics(mockContext);

      expect(result.averageTasksPerList).toBe(0);
    });

    it('should throw error when no user context provided', async () => {
      await expect(taskListService.getStatistics()).rejects.toThrow(
        'AUTHORIZATION_ERROR: User ID required'
      );
    });
  });

  describe('archive', () => {
    it('should throw not implemented error', async () => {
      await expect(taskListService.archive()).rejects.toThrow(
        'NOT_IMPLEMENTED: Archive functionality not yet implemented'
      );
    });
  });

  describe('getArchived', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await taskListService.getArchived(mockContext);
      expect(result).toEqual([]);
    });
  });

  describe('findById (inherited from BaseService)', () => {
    it('should return task list by ID', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));

      const result = await taskListService.findById('list-123', mockContext);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('list-123');
    });

    it('should return null for non-existent task list', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskListService.findById(
        'non-existent',
        mockContext
      );

      expect(result).toBeNull();
    });
  });

  describe('count (inherited from BaseService)', () => {
    it('should return count of task lists for user', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '5' }]));

      const result = await taskListService.count({}, mockContext);

      expect(result).toBe(5);
    });
  });

  describe('exists (inherited from BaseService)', () => {
    it('should return true for existing task list', async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ '?column?': 1 }], 1)
      );

      const result = await taskListService.exists('list-123', mockContext);

      expect(result).toBe(true);
    });

    it('should return false for non-existent task list', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 0));

      const result = await taskListService.exists('non-existent', mockContext);

      expect(result).toBe(false);
    });
  });
});
