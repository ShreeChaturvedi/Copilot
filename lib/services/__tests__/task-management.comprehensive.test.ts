/**
 * Comprehensive test suite for Task Management functionality
 * Tests all requirements from Task 6 with realistic scenarios
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskService } from '../TaskService';
import { TaskListService } from '../TaskListService';
import type { PrismaClient, Priority } from '@prisma/client';

// Mock Prisma client with comprehensive mocking
const createMockPrisma = () => ({
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
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tag: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  taskTag: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient);

describe('Task Management Comprehensive Tests', () => {
  let mockPrisma: PrismaClient;
  let taskService: TaskService;
  let taskListService: TaskListService;

  const mockContext = {
    userId: 'user-123',
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    taskService = new TaskService(mockPrisma);
    taskListService = new TaskListService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Requirement 5.1: Task CRUD Operations with Query Parameters', () => {
    it('should handle complex task queries with multiple filters', async () => {
      const complexFilters = {
        completed: false,
        taskListId: 'work-list-123',
        priority: 'HIGH' as Priority,
        scheduledDate: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31'),
        },
        search: 'project meeting',
        tags: ['urgent', 'work'],
        overdue: false,
        sortBy: 'scheduledDate' as const,
        sortOrder: 'asc' as const,
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Project meeting preparation',
          completed: false,
          scheduledDate: new Date('2024-01-15T10:00:00Z'),
          priority: 'HIGH',
          taskListId: 'work-list-123',
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          taskList: { id: 'work-list-123', name: 'Work', color: '#FF5722' },
          tags: [
            {
              id: 'tag-1',
              value: 'urgent',
              displayText: 'Urgent',
              iconName: 'priority',
              tag: { id: 'tag-1', name: 'urgent', type: 'LABEL', color: '#FF0000' },
            },
          ],
          attachments: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await taskService.findAll(complexFilters, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          completed: false,
          taskListId: 'work-list-123',
          priority: 'HIGH',
          scheduledDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
          OR: [
            { title: { contains: 'project meeting', mode: 'insensitive' } },
            { cleanTitle: { contains: 'project meeting', mode: 'insensitive' } },
          ],
          tags: {
            some: {
              tag: {
                name: { in: ['urgent', 'work'] },
              },
            },
          },
        },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'asc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Project meeting preparation');
    });

    it('should support cursor-based pagination with efficient queries', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `Task ${i + 1}`,
        completed: false,
        scheduledDate: new Date(`2024-01-${(i + 1).toString().padStart(2, '0')}T10:00:00Z`),
        priority: 'MEDIUM' as Priority,
        taskListId: 'list-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        taskList: { id: 'list-123', name: 'General', color: '#8B5CF6' },
        tags: [],
        attachments: [],
      }));

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
      mockPrisma.task.count.mockResolvedValue(50);

      const result = await taskService.findPaginated({}, 2, 10, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        skip: 10, // (page - 1) * limit
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(result.data).toHaveLength(10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it('should handle task creation with automatic tag association', async () => {
      const taskData = {
        title: 'Review quarterly reports',
        taskListId: 'work-list-123',
        scheduledDate: new Date('2024-01-20T14:00:00Z'),
        priority: 'HIGH' as Priority,
        originalInput: 'Review quarterly reports tomorrow 2pm high priority @john #finance',
        cleanTitle: 'Review quarterly reports',
        tags: [
          {
            type: 'PRIORITY',
            name: 'high',
            value: 'HIGH',
            displayText: 'High Priority',
            iconName: 'priority-high',
            color: '#FF0000',
          },
          {
            type: 'PERSON',
            name: 'john',
            value: '@john',
            displayText: '@john',
            iconName: 'person',
            color: '#4CAF50',
          },
          {
            type: 'LABEL',
            name: 'finance',
            value: '#finance',
            displayText: '#finance',
            iconName: 'tag',
            color: '#FF9800',
          },
        ],
      };

      const mockTaskList = {
        id: 'work-list-123',
        name: 'Work',
        color: '#FF5722',
        userId: 'user-123',
      };

      const mockCreatedTask = {
        id: 'new-task-123',
        ...taskData,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        taskList: mockTaskList,
        tags: [],
        attachments: [],
      };

      // Mock task list validation
      mockPrisma.taskList.findFirst.mockResolvedValue(mockTaskList);

      // Mock transaction for task creation with tags
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue(mockCreatedTask),
            findUnique: vi.fn().mockResolvedValue({
              ...mockCreatedTask,
              tags: taskData.tags.map((tag, index) => ({
                id: `task-tag-${index}`,
                taskId: 'new-task-123',
                tagId: `tag-${index}`,
                value: tag.value,
                displayText: tag.displayText,
                iconName: tag.iconName,
                tag: {
                  id: `tag-${index}`,
                  name: tag.name,
                  type: tag.type,
                  color: tag.color,
                },
              })),
            }),
          },
          tag: {
            upsert: vi.fn().mockImplementation(({ where }) => ({
              id: `tag-${where.name}`,
              name: where.name,
              type: 'LABEL',
              color: '#FF0000',
            })),
          },
          taskTag: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(mockTx);
      });

      const result = await taskService.create(taskData, mockContext);

      expect(result.title).toBe('Review quarterly reports');
      expect(result.priority).toBe('HIGH');
      expect(result.originalInput).toBe('Review quarterly reports tomorrow 2pm high priority @john #finance');
    });
  });

  describe('Requirement 5.2: Advanced Task Filtering and Sorting', () => {
    it('should support full-text search across title and clean title', async () => {
      const searchQuery = 'project documentation';
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Update project documentation',
          cleanTitle: 'Update project documentation',
          completed: false,
          userId: 'user-123',
          taskList: { id: 'list-1', name: 'Work', color: '#FF5722' },
          tags: [],
          attachments: [],
        },
        {
          id: 'task-2',
          title: 'Review docs',
          cleanTitle: 'Review project documentation',
          completed: false,
          userId: 'user-123',
          taskList: { id: 'list-1', name: 'Work', color: '#FF5722' },
          tags: [],
          attachments: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await taskService.search(searchQuery, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { cleanTitle: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should identify and filter overdue tasks correctly', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const mockOverdueTasks = [
        {
          id: 'overdue-task-1',
          title: 'Overdue task',
          completed: false,
          scheduledDate: yesterday,
          userId: 'user-123',
          taskList: { id: 'list-1', name: 'Work', color: '#FF5722' },
          tags: [],
          attachments: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockOverdueTasks);

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
      expect(result[0].title).toBe('Overdue task');
    });

    it('should support multiple sorting options', async () => {
      const sortingScenarios = [
        { sortBy: 'scheduledDate', sortOrder: 'asc' },
        { sortBy: 'priority', sortOrder: 'desc' },
        { sortBy: 'title', sortOrder: 'asc' },
        { sortBy: 'createdAt', sortOrder: 'desc' },
        { sortBy: 'updatedAt', sortOrder: 'asc' },
      ];

      for (const scenario of sortingScenarios) {
        mockPrisma.task.findMany.mockResolvedValue([]);

        await taskService.findAll(scenario as any, mockContext);

        expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
          where: { userId: 'user-123' },
          include: expect.any(Object),
          orderBy: { [scenario.sortBy]: scenario.sortOrder },
        });
      }
    });
  });

  describe('Requirement 5.3: Bulk Operations and Performance', () => {
    it('should handle bulk task updates efficiently', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];
      const updates = {
        completed: true,
        priority: 'LOW' as Priority,
      };

      // Mock ownership validation
      mockPrisma.task.findMany.mockResolvedValueOnce(
        taskIds.map((id) => ({ id }))
      );

      // Mock bulk update
      mockPrisma.task.updateMany.mockResolvedValue({ count: 5 });

      // Mock fetching updated tasks
      const updatedTasks = taskIds.map((id) => ({
        id,
        title: `Task ${id}`,
        completed: true,
        priority: 'LOW',
        userId: 'user-123',
        taskList: { id: 'list-1', name: 'General', color: '#8B5CF6' },
        tags: [],
        attachments: [],
      }));
      mockPrisma.task.findMany.mockResolvedValueOnce(updatedTasks);

      const result = await taskService.bulkUpdate(taskIds, updates, mockContext);

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: taskIds } },
        data: {
          ...updates,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toHaveLength(5);
      expect(result.every((task) => task.completed)).toBe(true);
      expect(result.every((task) => task.priority === 'LOW')).toBe(true);
    });

    it('should handle bulk task deletion with proper authorization', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      // Mock ownership validation
      mockPrisma.task.findMany.mockResolvedValue(
        taskIds.map((id) => ({ id }))
      );

      // Mock bulk delete
      mockPrisma.task.deleteMany.mockResolvedValue({ count: 3 });

      await taskService.bulkDelete(taskIds, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: taskIds },
          userId: 'user-123',
        },
        select: { id: true },
      });

      expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: taskIds } },
      });
    });

    it('should prevent bulk operations on unauthorized tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const updates = { completed: true };

      // Mock partial ownership (only 2 out of 3 tasks found)
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-1' },
        { id: 'task-2' },
      ]);

      await expect(taskService.bulkUpdate(taskIds, updates, mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Some tasks not found or access denied'
      );

      expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 5.4: Task Completion Toggle with Timestamps', () => {
    it('should toggle task from incomplete to complete with timestamp', async () => {
      const taskId = 'task-123';
      const incompleteTask = {
        id: taskId,
        title: 'Test Task',
        completed: false,
        completedAt: null,
        userId: 'user-123',
      };

      const completedTask = {
        ...incompleteTask,
        completed: true,
        completedAt: new Date(),
      };

      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(incompleteTask);
      // Mock current state check
      mockPrisma.task.findUnique.mockResolvedValue(incompleteTask);
      // Mock update
      mockPrisma.task.update.mockResolvedValue({
        ...completedTask,
        taskList: { id: 'list-1', name: 'General', color: '#8B5CF6' },
        tags: [],
        attachments: [],
      });

      const result = await taskService.toggleCompletion(taskId, mockContext);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
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

    it('should toggle task from complete to incomplete and clear timestamp', async () => {
      const taskId = 'task-123';
      const completedTask = {
        id: taskId,
        title: 'Test Task',
        completed: true,
        completedAt: new Date(),
        userId: 'user-123',
      };

      const incompleteTask = {
        ...completedTask,
        completed: false,
        completedAt: null,
      };

      // Mock ownership check
      mockPrisma.task.findFirst.mockResolvedValue(completedTask);
      // Mock current state check
      mockPrisma.task.findUnique.mockResolvedValue(completedTask);
      // Mock update
      mockPrisma.task.update.mockResolvedValue({
        ...incompleteTask,
        taskList: { id: 'list-1', name: 'General', color: '#8B5CF6' },
        tags: [],
        attachments: [],
      });

      const result = await taskService.toggleCompletion(taskId, mockContext);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
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
  });

  describe('Requirement 6.1-6.4: Task List Management', () => {
    it('should create task list with proper validation', async () => {
      const taskListData = {
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
        _count: { tasks: 0 },
      };

      // Mock uniqueness check
      mockPrisma.taskList.findFirst.mockResolvedValue(null);
      // Mock creation
      mockPrisma.taskList.create.mockResolvedValue(createdTaskList);

      const result = await taskListService.create(taskListData, mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Work Projects',
          userId: 'user-123',
        },
      });

      expect(mockPrisma.taskList.create).toHaveBeenCalledWith({
        data: {
          name: 'Work Projects',
          color: '#FF5722',
          icon: 'work',
          description: 'Tasks related to work projects and deadlines',
          userId: 'user-123',
        },
        include: expect.any(Object),
      });

      expect(result.name).toBe('Work Projects');
      expect(result.color).toBe('#FF5722');
    });

    it('should get task lists with comprehensive task counts', async () => {
      const mockTaskListsWithTasks = [
        {
          id: 'list-1',
          name: 'Work',
          color: '#FF5722',
          userId: 'user-123',
          _count: { tasks: 10 },
          tasks: [
            { id: 'task-1', completed: false },
            { id: 'task-2', completed: true },
            { id: 'task-3', completed: false },
            { id: 'task-4', completed: true },
            { id: 'task-5', completed: false },
          ],
        },
        {
          id: 'list-2',
          name: 'Personal',
          color: '#4CAF50',
          userId: 'user-123',
          _count: { tasks: 5 },
          tasks: [
            { id: 'task-6', completed: true },
            { id: 'task-7', completed: true },
            { id: 'task-8', completed: false },
          ],
        },
      ];

      mockPrisma.taskList.findMany.mockResolvedValue(mockTaskListsWithTasks);

      const result = await taskListService.getWithTaskCount(mockContext);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'list-1',
        name: 'Work',
        taskCount: 5, // Only showing first 5 tasks in mock
        completedTaskCount: 2,
        pendingTaskCount: 3,
      });
      expect(result[1]).toMatchObject({
        id: 'list-2',
        name: 'Personal',
        taskCount: 3,
        completedTaskCount: 2,
        pendingTaskCount: 1,
      });
    });

    it('should handle task list deletion with task reassignment', async () => {
      const taskListId = 'list-to-delete';
      const defaultTaskList = {
        id: 'default-list',
        name: 'General',
        color: '#8B5CF6',
        userId: 'user-123',
      };

      // Mock ownership check
      mockPrisma.taskList.findFirst.mockResolvedValueOnce({
        id: taskListId,
        name: 'Old List',
        userId: 'user-123',
      });

      // Mock count check (more than 1 task list exists)
      mockPrisma.taskList.count.mockResolvedValue(3);

      // Mock default task list retrieval
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(defaultTaskList);

      // Mock task reassignment
      mockPrisma.task.updateMany.mockResolvedValue({ count: 5 });

      // Mock deletion
      mockPrisma.taskList.delete.mockResolvedValue({
        id: taskListId,
        name: 'Old List',
      });

      const result = await taskListService.delete(taskListId, mockContext);

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          taskListId: taskListId,
          userId: 'user-123',
        },
        data: {
          taskListId: 'default-list',
        },
      });

      expect(mockPrisma.taskList.delete).toHaveBeenCalledWith({
        where: { id: taskListId },
      });

      expect(result).toBe(true);
    });

    it('should prevent deletion of the only task list', async () => {
      const taskListId = 'only-list';

      // Mock ownership check
      mockPrisma.taskList.findFirst.mockResolvedValue({
        id: taskListId,
        name: 'Only List',
        userId: 'user-123',
      });

      // Mock count check (only 1 task list exists)
      mockPrisma.taskList.count.mockResolvedValue(1);

      await expect(taskListService.delete(taskListId, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Cannot delete the only task list'
      );

      expect(mockPrisma.taskList.delete).not.toHaveBeenCalled();
    });
  });

  describe('Statistics and Analytics', () => {
    it('should provide comprehensive task statistics', async () => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Mock all count queries
      mockPrisma.task.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60)  // completed
        .mockResolvedValueOnce(8)   // overdue
        .mockResolvedValueOnce(5)   // completed today
        .mockResolvedValueOnce(15)  // completed this week
        .mockResolvedValueOnce(45); // completed this month

      const result = await taskService.getStats(mockContext);

      expect(result).toEqual({
        total: 100,
        completed: 60,
        pending: 40,
        overdue: 8,
        completedToday: 5,
        completedThisWeek: 15,
        completedThisMonth: 45,
      });

      // Verify all count queries were called with correct parameters
      expect(mockPrisma.task.count).toHaveBeenCalledTimes(6);
    });

    it('should provide task list statistics', async () => {
      // Mock task list statistics
      mockPrisma.taskList.count.mockResolvedValue(8); // total lists
      mockPrisma.task.count
        .mockResolvedValueOnce(120) // total tasks
        .mockResolvedValueOnce(75); // completed tasks

      const result = await taskListService.getStatistics(mockContext);

      expect(result).toEqual({
        totalLists: 8,
        totalTasks: 120,
        completedTasks: 75,
        pendingTasks: 45,
        averageTasksPerList: 15, // 120 / 8
      });
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    it('should handle concurrent task updates gracefully', async () => {
      const taskId = 'concurrent-task';
      const updateData = { title: 'Updated Title' };

      // Simulate concurrent update scenario
      mockPrisma.task.findFirst.mockResolvedValue({
        id: taskId,
        title: 'Original Title',
        userId: 'user-123',
      });

      mockPrisma.task.update.mockRejectedValueOnce(
        new Error('Record not found or already updated')
      );

      await expect(taskService.update(taskId, updateData, mockContext)).rejects.toThrow();
    });

    it('should handle database constraints and foreign key violations', async () => {
      const taskData = {
        title: 'Test Task',
        taskListId: 'non-existent-list',
      };

      // Mock task list validation failure
      mockPrisma.taskList.findFirst.mockResolvedValue(null);

      await expect(taskService.create(taskData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list not found or access denied'
      );
    });

    it('should handle large dataset queries efficiently', async () => {
      // Test with large pagination
      const largePageSize = 1000;
      const largePage = 10;

      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(50000);

      const result = await taskService.findPaginated({}, largePage, largePageSize, mockContext);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        skip: 9000, // (10 - 1) * 1000
        take: 1000,
        orderBy: { createdAt: 'desc' },
      });

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
        const taskListData = {
          name: 'Test List',
          color: invalidColor,
        };

        await expect(taskListService.create(taskListData, mockContext)).rejects.toThrow(
          'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
        );
      }

      // Test valid color formats
      const validColorFormats = ['#FF0000', '#00FF00', '#0000FF', '#FFF', '#000'];

      for (const validColor of validColorFormats) {
        const taskListData = {
          name: `Test List ${validColor}`,
          color: validColor,
        };

        const createdTaskList = {
          id: `list-${validColor}`,
          ...taskListData,
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { tasks: 0 },
        };

        mockPrisma.taskList.findFirst.mockResolvedValue(null);
        mockPrisma.taskList.create.mockResolvedValue(createdTaskList);

        await expect(taskListService.create(taskListData, mockContext)).resolves.toBeDefined();
      }
    });
  });
});