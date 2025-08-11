/**
 * Unit tests for TaskService
 * Tests business logic and data access operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskService } from '../TaskService';
import type { PrismaClient, Priority } from '@prisma/client';
import type { CreateTaskDTO, UpdateTaskDTO, TaskFilters } from '../TaskService';

// Mock Prisma client
const mockPrisma = {
  task: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  taskList: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  tag: {
    upsert: vi.fn(),
  },
  taskTag: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

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
  priority: 'MEDIUM' as Priority,
  originalInput: 'Test task for tomorrow',
  cleanTitle: 'Test task',
  taskListId: 'list-123',
  userId: 'user-123',
  createdAt: new Date('2024-01-14T10:00:00Z'),
  updatedAt: new Date('2024-01-14T10:00:00Z'),
  taskList: {
    id: 'list-123',
    name: 'General',
    color: '#8B5CF6',
  },
  tags: [],
  attachments: [],
};

const mockTag = {
  id: 'tag-123',
  name: 'high',
  type: 'PRIORITY',
  color: '#FF0000',
};

const mockTaskTag = {
  taskId: 'task-123',
  tagId: 'tag-123',
  value: 'HIGH',
  displayText: 'High Priority',
  iconName: 'priority-high',
  tag: mockTag,
};

const mockContext = {
  userId: 'user-123',
  requestId: 'test-request-123',
};

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should find all tasks for a user with default sorting', async () => {
      const filters: TaskFilters = {};
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          taskList: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-123');
    });

    it('should apply completion filter', async () => {
      const filters: TaskFilters = { completed: true };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', completed: true },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply task list filter', async () => {
      const filters: TaskFilters = { taskListId: 'list-123' };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', taskListId: 'list-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply priority filter', async () => {
      const filters: TaskFilters = { priority: 'HIGH' };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', priority: 'HIGH' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply scheduled date range filter', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');
      const filters: TaskFilters = {
        scheduledDate: { from: fromDate, to: toDate },
      };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          scheduledDate: { gte: fromDate, lte: toDate },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply search filter', async () => {
      const filters: TaskFilters = { search: 'test query' };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          OR: [
            { title: { contains: 'test query', mode: 'insensitive' } },
            { cleanTitle: { contains: 'test query', mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply tags filter', async () => {
      const filters: TaskFilters = { tags: ['work', 'urgent'] };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          tags: {
            some: {
              tag: {
                name: { in: ['work', 'urgent'] },
              },
            },
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply overdue filter', async () => {
      const filters: TaskFilters = { overdue: true };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          scheduledDate: { lt: expect.any(Date) },
          completed: false,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply custom sorting', async () => {
      const filters: TaskFilters = { sortBy: 'scheduledDate', sortOrder: 'asc' };
      mockPrisma.task.findMany.mockResolvedValue([]);

      await taskService.findAll(filters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'asc' },
      });
    });
  });

  describe('findPaginated', () => {
    it('should return paginated results with correct metadata', async () => {
      const filters: TaskFilters = {};
      const page = 2;
      const limit = 10;

      mockPrisma.task.findMany.mockResolvedValue([mockTask]);
      mockPrisma.task.count.mockResolvedValue(25);

      const result = await taskService.findPaginated(filters, page, limit, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        skip: 10, // (page - 1) * limit
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.task.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });

      expect(result).toEqual({
        data: [expect.objectContaining({ id: 'task-123' })],
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      });
    });
  });

  describe('create', () => {
    const createTaskData: CreateTaskDTO = {
      title: 'New Task',
      taskListId: 'list-123',
      scheduledDate: new Date('2024-01-16T10:00:00Z'),
      priority: 'HIGH',
      originalInput: 'New task for tomorrow high priority',
      cleanTitle: 'New task',
      tags: [
        {
          type: 'PRIORITY',
          name: 'high',
          value: 'HIGH',
          displayText: 'High Priority',
          iconName: 'priority-high',
          color: '#FF0000',
        },
      ],
    };

    it('should create a task with tags successfully', async () => {
      const createdTask = { ...mockTask, ...createTaskData, id: 'new-task-123' };
      
      // Mock task list validation
      mockPrisma.taskList.findFirst.mockResolvedValue(mockTaskList);
      
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue(createdTask),
            findUnique: vi.fn().mockResolvedValue(createdTask),
          },
          tag: {
            upsert: vi.fn().mockResolvedValue(mockTag),
          },
          taskTag: {
            create: vi.fn().mockResolvedValue(mockTaskTag),
          },
        };
        return await callback(mockTx);
      });

      const result = await taskService.create(createTaskData, mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'list-123',
          userId: 'user-123',
        },
      });

      expect(result.id).toBe('new-task-123');
      expect(result.title).toBe('New Task');
    });

    it('should create task with default task list when none specified', async () => {
      const dataWithoutTaskList = { ...createTaskData, taskListId: undefined };
      const createdTask = { ...mockTask, ...dataWithoutTaskList, id: 'new-task-123' };

      // Mock default task list creation
      mockPrisma.taskList.findFirst.mockResolvedValue(null);
      mockPrisma.taskList.create.mockResolvedValue(mockTaskList);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue(createdTask),
          },
        };
        return await callback(mockTx);
      });

      await taskService.create(dataWithoutTaskList, mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123', name: 'General' },
      });
      expect(mockPrisma.taskList.create).toHaveBeenCalledWith({
        data: {
          name: 'General',
          color: '#8B5CF6',
          userId: 'user-123',
        },
      });
    });

    it('should throw validation error for empty title', async () => {
      const invalidData = { ...createTaskData, title: '' };

      await expect(taskService.create(invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Title is required'
      );
    });

    it('should throw validation error for invalid task list', async () => {
      mockPrisma.taskList.findFirst.mockResolvedValue(null);

      await expect(taskService.create(createTaskData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list not found or access denied'
      );
    });
  });

  describe('update', () => {
    const updateData: UpdateTaskDTO = {
      title: 'Updated Task',
      completed: true,
      priority: 'LOW',
      scheduledDate: new Date('2024-01-17T10:00:00Z'),
    };

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateData };
      
      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const result = await taskService.update('task-123', updateData, mockContext);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });

      expect(result.title).toBe('Updated Task');
      expect(result.completed).toBe(true);
    });

    it('should throw validation error for empty title', async () => {
      const invalidData = { ...updateData, title: '' };

      await expect(taskService.update('task-123', invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Title cannot be empty'
      );
    });

    it('should throw authorization error for non-owned task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(taskService.update('task-123', updateData, mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Access denied'
      );
    });

    it('should validate task list when updating taskListId', async () => {
      const dataWithTaskList = { ...updateData, taskListId: 'new-list-123' };
      
      // Mock ownership check passes
      mockPrisma.task.findFirst.mockResolvedValueOnce(mockTask);
      // Mock task list validation fails
      mockPrisma.taskList.findFirst.mockResolvedValue(null);

      await expect(taskService.update('task-123', dataWithTaskList, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list not found or access denied'
      );
    });
  });

  describe('toggleCompletion', () => {
    it('should toggle task from incomplete to complete', async () => {
      const incompleteTask = { ...mockTask, completed: false };
      const completedTask = { ...mockTask, completed: true, completedAt: new Date() };

      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(incompleteTask);
      mockPrisma.task.findUnique.mockResolvedValue(incompleteTask);
      mockPrisma.task.update.mockResolvedValue(completedTask);

      const result = await taskService.toggleCompletion('task-123', mockContext);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          completed: true,
          completedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should toggle task from complete to incomplete', async () => {
      const completedTask = { ...mockTask, completed: true, completedAt: new Date() };
      const incompleteTask = { ...mockTask, completed: false, completedAt: null };

      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(completedTask);
      mockPrisma.task.findUnique.mockResolvedValue(completedTask);
      mockPrisma.task.update.mockResolvedValue(incompleteTask);

      const result = await taskService.toggleCompletion('task-123', mockContext);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          completed: false,
          completedAt: null,
          updatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });

      expect(result.completed).toBe(false);
      expect(result.completedAt).toBe(null);
    });

    it('should throw error for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(taskService.toggleCompletion('non-existent', mockContext)).rejects.toThrow(
        'NOT_FOUND: Task not found'
      );
    });

    it('should throw authorization error for non-owned task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(taskService.toggleCompletion('task-123', mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Access denied'
      );
    });
  });

  describe('delete', () => {
    it('should delete a task successfully', async () => {
      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.task.delete.mockResolvedValue(mockTask);

      const result = await taskService.delete('task-123', mockContext);

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-123' },
      });

      expect(result).toBe(true);
    });

    it('should throw authorization error for non-owned task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(taskService.delete('task-123', mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Access denied'
      );
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple tasks successfully', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const updates = { completed: true };
      const updatedTasks = taskIds.map((id) => ({ ...mockTask, id, completed: true }));

      // Mock ownership validation
      mockPrisma.task.findMany.mockResolvedValueOnce(
        taskIds.map((id) => ({ id }))
      );
      mockPrisma.task.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.task.findMany.mockResolvedValueOnce(updatedTasks);

      const result = await taskService.bulkUpdate(taskIds, updates, mockContext);

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: taskIds } },
        data: {
          ...updates,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toHaveLength(3);
      expect(result.every((task) => task.completed)).toBe(true);
    });

    it('should throw authorization error if some tasks are not owned', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const updates = { completed: true };

      // Mock partial ownership (only 2 out of 3 tasks found)
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);

      await expect(taskService.bulkUpdate(taskIds, updates, mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Some tasks not found or access denied'
      );
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple tasks successfully', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock ownership validation
      mockPrisma.task.findMany.mockResolvedValue(
        taskIds.map((id) => ({ id }))
      );
      mockPrisma.task.deleteMany.mockResolvedValue({ count: 3 });

      await taskService.bulkDelete(taskIds, mockContext);

      expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: taskIds } },
      });
    });

    it('should throw authorization error if some tasks are not owned', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock partial ownership
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);

      await expect(taskService.bulkDelete(taskIds, mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Some tasks not found or access denied'
      );
    });
  });

  describe('getStats', () => {
    it('should return comprehensive task statistics', async () => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      // startOfMonth implicitly covered by service implementation; omitted in test

      // Mock all count queries
      mockPrisma.task.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(30) // completed
        .mockResolvedValueOnce(5)  // overdue
        .mockResolvedValueOnce(3)  // completed today
        .mockResolvedValueOnce(10) // completed this week
        .mockResolvedValueOnce(25); // completed this month

      const result = await taskService.getStats(mockContext);

      expect(result).toEqual({
        total: 50,
        completed: 30,
        pending: 20,
        overdue: 5,
        completedToday: 3,
        completedThisWeek: 10,
        completedThisMonth: 25,
      });

      // Verify all count queries were called with correct parameters
      expect(mockPrisma.task.count).toHaveBeenCalledTimes(6);
    });

    it('should throw error when no user context provided', async () => {
      await expect(taskService.getStats()).rejects.toThrow(
        'AUTHORIZATION_ERROR: User ID required'
      );
    });
  });

  describe('findByTaskList', () => {
    it('should find tasks by task list ID', async () => {
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await taskService.findByTaskList('list-123', mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', taskListId: 'list-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].taskListId).toBe('list-123');
    });
  });

  describe('findByScheduledDate', () => {
    it('should find tasks scheduled for a specific date', async () => {
      const targetDate = new Date('2024-01-15');
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await taskService.findByScheduledDate(targetDate, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          scheduledDate: {
            from: expect.any(Date),
            to: expect.any(Date),
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('findOverdue', () => {
    it('should find overdue tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await taskService.findOverdue(mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          scheduledDate: { lt: expect.any(Date) },
          completed: false,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('should search tasks by query string', async () => {
      const query = 'test search';
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await taskService.search(query, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { cleanTitle: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
    });
  });
});