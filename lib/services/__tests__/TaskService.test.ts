/**
 * Unit tests for TaskService
 * Tests business logic and data access operations using SQL mocks
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database module - vi.mock is hoisted so we use a factory
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const withTransaction = vi.fn();
  return {
    query,
    withTransaction,
    pool: { query },
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
import type { CreateTaskDTO, UpdateTaskDTO, DbPriority } from '../TaskService';
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

// Test data
const mockTaskList = {
  id: 'list-123',
  name: 'General',
  color: '#8B5CF6',
  userId: 'user-123',
  createdAt: new Date('2024-01-14T10:00:00Z'),
  updatedAt: new Date('2024-01-14T10:00:00Z'),
};

const mockTask = {
  id: 'task-123',
  title: 'Test Task',
  completed: false,
  completedAt: null,
  scheduledDate: new Date('2024-01-15T10:00:00Z'),
  priority: 'MEDIUM' as DbPriority,
  status: 'NOT_STARTED',
  originalInput: 'Test task for tomorrow',
  cleanTitle: 'Test task',
  taskListId: 'list-123',
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
const mockedWithTransaction = vi.mocked(mockWithTransaction);

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
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

  describe('findAll', () => {
    it('should return all tasks for a user', async () => {
      // Mock main task query
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));
      // Mock task list enrichment
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      // Mock attachments enrichment
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      // Mock tags enrichment
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findAll({}, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-123');
      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should filter by completed status', async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ ...mockTask, completed: true }])
      );
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findAll(
        { completed: true },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(true);
    });

    it('should filter by task list', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findAll(
        { taskListId: 'list-123' },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].taskListId).toBe('list-123');
    });

    it('should filter by priority', async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ ...mockTask, priority: 'HIGH' }])
      );
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findAll(
        { priority: 'HIGH' },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('HIGH');
    });

    it('should return empty array when no tasks found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findAll({}, mockContext);

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return task by ID', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findById('task-123', mockContext);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('task-123');
    });

    it('should return null for non-existent task', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findById('non-existent', mockContext);

      expect(result).toBeNull();
    });

    it('should return task even if owned by different user (no ownership check in findById)', async () => {
      // findById does not check ownership - it returns any task by ID
      // Ownership checks should be done at the route/API level
      const otherUserTask = { ...mockTask, userId: 'other-user' };

      // SELECT query
      mockedQuery.mockResolvedValueOnce(createQueryResult([otherUserTask]));
      // enrichEntities: task lists (uses cache key with context userId)
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      // enrichEntities: attachments
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      // enrichEntities: tags
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findById('task-123', mockContext);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('other-user');
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createData: CreateTaskDTO = {
        title: 'New Task',
        taskListId: 'list-123',
        priority: 'HIGH',
      };

      const newTaskRow = {
        id: 'new-task-123',
        title: 'New Task',
        taskListId: 'list-123',
        priority: 'HIGH',
        userId: mockContext.userId,
        completed: false,
        status: 'NOT_STARTED',
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledDate: null,
        completedAt: null,
        originalInput: null,
        cleanTitle: null,
      };

      // Use a smart mock that returns appropriate data based on query content
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('information_schema')) {
          return createQueryResult([{ exists: true }]); // ensureStatusColumnExists
        }
        if (sqlLower.includes('insert into users')) {
          return createQueryResult([], 0); // ensureUserExists - no-op
        }
        if (
          sqlLower.includes('select') &&
          sqlLower.includes('task_lists') &&
          sqlLower.includes('userid')
        ) {
          return createQueryResult([mockTaskList]); // validateCreate or enrichEntities
        }
        if (sqlLower.includes('insert into tasks')) {
          return createQueryResult([newTaskRow]); // INSERT task
        }
        if (sqlLower.includes('from tasks') && sqlLower.includes('select')) {
          return createQueryResult([newTaskRow]);
        }
        if (sqlLower.includes('attachments')) {
          return createQueryResult([]);
        }
        if (sqlLower.includes('task_tags') || sqlLower.includes('tags')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      // Mock transaction with a mock client that uses our mockedQuery
      const mockClient = { query: mockedQuery };
      mockedWithTransaction.mockImplementationOnce(async (callback: any) => {
        return callback(mockClient);
      });

      const result = await taskService.create(createData, mockContext);

      expect(result.title).toBe('New Task');
      expect(result.priority).toBe('HIGH');
    });

    it('should throw error for invalid task list', async () => {
      const createData: CreateTaskDTO = {
        title: 'New Task',
        taskListId: 'invalid-list',
      };

      // Mock task list not found during validation
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('task_lists')) {
          return createQueryResult([]); // No task list found
        }
        return createQueryResult([{ exists: true }]);
      });

      await expect(taskService.create(createData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });
  });

  describe('update', () => {
    it('should update task properties', async () => {
      const updateData: UpdateTaskDTO = {
        title: 'Updated Task',
        priority: 'HIGH',
      };

      // Mock ownership check
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));

      // Mock UPDATE query
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            ...mockTask,
            ...updateData,
            updatedAt: new Date(),
          },
        ])
      );

      // Mock enrichment queries
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.update(
        'task-123',
        updateData,
        mockContext
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Updated Task');
      expect(result?.priority).toBe('HIGH');
    });

    it('should toggle completion status', async () => {
      // Mock ownership check
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));

      // Mock UPDATE query
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            ...mockTask,
            completed: true,
            completedAt: new Date(),
            status: 'DONE',
            updatedAt: new Date(),
          },
        ])
      );

      // Mock enrichment queries
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.update(
        'task-123',
        { completed: true },
        mockContext
      );

      expect(result?.completed).toBe(true);
      expect(result?.completedAt).not.toBeNull();
    });

    it('should throw error for non-existent task (authorization)', async () => {
      // When checkOwnership returns false (no rows), it throws
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        taskService.update('non-existent', { title: 'Updated' }, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('delete', () => {
    it('should delete task', async () => {
      // Mock DELETE query
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));

      const result = await taskService.delete('task-123', mockContext);

      expect(result).toBe(true);
    });

    it('should return true even for non-existent task (no ownership check in delete)', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 0));

      const result = await taskService.delete('non-existent', mockContext);

      // delete() always returns true in current implementation
      expect(result).toBe(true);
    });
  });

  describe('findPaginated', () => {
    it('should return paginated results', async () => {
      // Mock data query
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTask]));

      // Mock count query
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '10' }]));

      // Mock enrichment queries (task lists, attachments, tags)
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.findPaginated({}, 1, 10, mockContext);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should handle empty results', async () => {
      // Mock data query
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      // Mock count query
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '0' }]));

      const result = await taskService.findPaginated({}, 1, 10, mockContext);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock ownership check
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          { id: 'task-1' },
          { id: 'task-2' },
          { id: 'task-3' },
        ])
      );

      // Mock UPDATE query
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 3));

      // Mock SELECT to get updated tasks
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          { ...mockTask, id: 'task-1', completed: true },
          { ...mockTask, id: 'task-2', completed: true },
          { ...mockTask, id: 'task-3', completed: true },
        ])
      );

      // Mock enrichment queries
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTaskList]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await taskService.bulkUpdate(
        taskIds,
        { completed: true },
        mockContext
      );

      // bulkUpdate returns TaskEntity[]
      expect(result).toHaveLength(3);
      expect(result[0].completed).toBe(true);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2'];

      // Mock ownership check
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([{ id: 'task-1' }, { id: 'task-2' }])
      );

      // Mock DELETE query
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 2));

      // bulkDelete returns void
      await expect(
        taskService.bulkDelete(taskIds, mockContext)
      ).resolves.toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return task statistics', async () => {
      // Mock total count
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '100' }]));
      // Mock completed count
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '45' }]));
      // Mock pending count
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '55' }]));
      // Mock overdue count
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '5' }]));
      // Mock today count
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '10' }]));
      // Mock this week
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '25' }]));
      // Mock completed this week
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '8' }]));
      // Mock completed this month
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ count: '30' }]));

      const result = await taskService.getStats(mockContext);

      expect(result.total).toBe(100);
      expect(result.completed).toBe(45);
      expect(result.pending).toBe(55);
    });
  });
});
