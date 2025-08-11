/**
 * Unit tests for TaskListService
 * Tests business logic and data access operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskListService } from '../TaskListService';
import type { PrismaClient } from '@prisma/client';
import type { CreateTaskListDTO, UpdateTaskListDTO, TaskListFilters } from '../TaskListService';

// Mock Prisma client
const mockPrisma = {
  taskList: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  task: {
    updateMany: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

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
  _count: {
    tasks: 5,
  },
};

const mockTaskListWithTasks = {
  ...mockTaskList,
  tasks: [
    {
      id: 'task-1',
      title: 'Task 1',
      completed: false,
      scheduledDate: new Date('2024-01-15T10:00:00Z'),
      priority: 'MEDIUM',
    },
    {
      id: 'task-2',
      title: 'Task 2',
      completed: true,
      scheduledDate: new Date('2024-01-16T10:00:00Z'),
      priority: 'HIGH',
    },
  ],
};

const mockContext = {
  userId: 'user-123',
  requestId: 'test-request-123',
};

describe('TaskListService', () => {
  let taskListService: TaskListService;

  beforeEach(() => {
    taskListService = new TaskListService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should find all task lists for a user', async () => {
      const filters: TaskListFilters = {};
      mockPrisma.taskList.findMany.mockResolvedValue([mockTaskList]);

      const result = await taskListService.findAll(filters, mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('list-123');
    });

    it('should apply search filter', async () => {
      const filters: TaskListFilters = { search: 'work' };
      mockPrisma.taskList.findMany.mockResolvedValue([]);

      await taskListService.findAll(filters, mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          OR: [
            { name: { contains: 'work', mode: 'insensitive' } },
            { description: { contains: 'work', mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
      });
    });

    it('should apply hasActiveTasks filter', async () => {
      const filters: TaskListFilters = { hasActiveTasks: true };
      mockPrisma.taskList.findMany.mockResolvedValue([]);

      await taskListService.findAll(filters, mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          tasks: {
            some: {
              completed: false,
            },
          },
        },
        include: expect.any(Object),
      });
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
      const createdTaskList = { ...mockTaskList, ...createTaskListData, id: 'new-list-123' };
      
      // Mock uniqueness check
      mockPrisma.taskList.findFirst.mockResolvedValue(null);
      mockPrisma.taskList.create.mockResolvedValue(createdTaskList);

      const result = await taskListService.create(createTaskListData, mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Work Tasks',
          userId: 'user-123',
        },
      });

      expect(mockPrisma.taskList.create).toHaveBeenCalledWith({
        data: {
          name: 'Work Tasks',
          color: '#FF5722',
          icon: 'work',
          description: 'Tasks related to work projects',
          userId: 'user-123',
        },
        include: expect.any(Object),
      });

      expect(result.name).toBe('Work Tasks');
      expect(result.color).toBe('#FF5722');
    });

    it('should throw validation error for empty name', async () => {
      const invalidData = { ...createTaskListData, name: '' };

      await expect(taskListService.create(invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name is required'
      );
    });

    it('should throw validation error for duplicate name', async () => {
      // Mock existing task list with same name
      mockPrisma.taskList.findFirst.mockResolvedValue(mockTaskList);

      await expect(taskListService.create(createTaskListData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name already exists'
      );
    });

    it('should throw validation error for invalid color format', async () => {
      const invalidData = { ...createTaskListData, color: 'invalid-color' };

      await expect(taskListService.create(invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    });

    it('should accept valid hex colors', async () => {
      const validColors = ['#FF0000', '#00FF00', '#0000FF', '#FFF', '#000'];
      
      for (const color of validColors) {
        const dataWithColor = { ...createTaskListData, color };
        const createdTaskList = { ...mockTaskList, ...dataWithColor, id: `list-${color}` };
        
        mockPrisma.taskList.findFirst.mockResolvedValue(null);
        mockPrisma.taskList.create.mockResolvedValue(createdTaskList);

        await expect(taskListService.create(dataWithColor, mockContext)).resolves.toBeDefined();
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
      
      // Mock ownership check
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(mockTaskList);
      // Mock uniqueness check for new name
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(null);
      mockPrisma.taskList.update.mockResolvedValue(updatedTaskList);

      const result = await taskListService.update('list-123', updateData, mockContext);

      expect(mockPrisma.taskList.update).toHaveBeenCalledWith({
        where: { id: 'list-123' },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });

      expect(result.name).toBe('Updated Task List');
      expect(result.color).toBe('#4CAF50');
    });

    it('should throw validation error for empty name', async () => {
      const invalidData = { ...updateData, name: '' };

      await expect(taskListService.update('list-123', invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name cannot be empty'
      );
    });

    it('should throw authorization error for non-owned task list', async () => {
      mockPrisma.taskList.findFirst.mockResolvedValue(null);

      await expect(taskListService.update('list-123', updateData, mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Access denied'
      );
    });

    it('should throw validation error for duplicate name', async () => {
      // Mock ownership check passes
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(mockTaskList);
      // Mock duplicate name check fails
      mockPrisma.taskList.findFirst.mockResolvedValueOnce({
        ...mockTaskList,
        id: 'other-list-123',
        name: updateData.name,
      });

      await expect(taskListService.update('list-123', updateData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Task list name already exists'
      );
    });

    it('should throw validation error for invalid color format', async () => {
      const invalidData = { ...updateData, color: 'not-a-hex-color' };
      
      // Mock ownership check passes
      mockPrisma.taskList.findFirst.mockResolvedValue(mockTaskList);

      await expect(taskListService.update('list-123', invalidData, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    });
  });

  describe('getDefault', () => {
    it('should return existing General task list', async () => {
      const generalTaskList = { ...mockTaskList, name: 'General' };
      mockPrisma.taskList.findFirst.mockResolvedValue(generalTaskList);

      const result = await taskListService.getDefault(mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          name: 'General',
        },
        include: expect.any(Object),
      });

      expect(result.name).toBe('General');
    });

    it('should return first task list if no General list exists', async () => {
      const firstTaskList = { ...mockTaskList, name: 'First List' };
      
      // Mock no General list found
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(null);
      // Mock first task list found
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(firstTaskList);

      const result = await taskListService.getDefault(mockContext);

      expect(mockPrisma.taskList.findFirst).toHaveBeenCalledTimes(2);
      expect(result.name).toBe('First List');
    });

    it('should create General task list if none exist', async () => {
      const newGeneralList = { ...mockTaskList, name: 'General' };
      
      // Mock no existing task lists
      mockPrisma.taskList.findFirst.mockResolvedValue(null);
      mockPrisma.taskList.create.mockResolvedValue(newGeneralList);

      const result = await taskListService.getDefault(mockContext);

      expect(mockPrisma.taskList.create).toHaveBeenCalledWith({
        data: {
          name: 'General',
          color: '#8B5CF6',
          description: 'Default task list',
          userId: 'user-123',
        },
        include: expect.any(Object),
      });

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
      const taskListsWithTasks = [
        {
          ...mockTaskList,
          tasks: [
            { id: 'task-1', completed: false },
            { id: 'task-2', completed: true },
            { id: 'task-3', completed: false },
          ],
        },
      ];

      mockPrisma.taskList.findMany.mockResolvedValue(taskListsWithTasks);

      const result = await taskListService.getWithTaskCount(mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
          tasks: {
            select: {
              id: true,
              completed: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

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
      mockPrisma.taskList.findMany.mockResolvedValue([mockTaskListWithTasks]);

      const result = await taskListService.getWithTasks(mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              completed: true,
              scheduledDate: true,
              priority: true,
            },
            orderBy: [
              { completed: 'asc' },
              { scheduledDate: 'asc' },
              { createdAt: 'desc' },
            ],
            take: 10,
          },
        },
        orderBy: { name: 'asc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].tasks).toHaveLength(2);
    });
  });

  describe('reorder', () => {
    it('should reorder task lists successfully', async () => {
      const taskListIds = ['list-1', 'list-2', 'list-3'];
      const taskLists = taskListIds.map((id) => ({ ...mockTaskList, id }));

      // Mock ownership validation
      mockPrisma.taskList.findMany.mockResolvedValue(taskLists);
      // Mock individual finds for reordering
      taskLists.forEach((taskList) => {
        mockPrisma.taskList.findUnique.mockResolvedValueOnce(taskList);
      });

      const result = await taskListService.reorder(taskListIds, mockContext);

      expect(mockPrisma.taskList.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: taskListIds },
          userId: 'user-123',
        },
      });

      expect(result).toHaveLength(3);
      expect(result.map((tl) => tl.id)).toEqual(taskListIds);
    });

    it('should throw validation error if some task lists are not owned', async () => {
      const taskListIds = ['list-1', 'list-2', 'list-3'];
      
      // Mock partial ownership (only 2 out of 3 found)
      mockPrisma.taskList.findMany.mockResolvedValue([
        { ...mockTaskList, id: 'list-1' },
        { ...mockTaskList, id: 'list-2' },
      ]);

      await expect(taskListService.reorder(taskListIds, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Some task lists not found or access denied'
      );
    });
  });

  describe('delete', () => {
    it('should delete a task list and move tasks to default list', async () => {
      const defaultTaskList = { ...mockTaskList, id: 'default-list', name: 'General' };
      
      // Mock ownership check
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(mockTaskList);
      // Mock count check (more than 1 task list)
      mockPrisma.taskList.count.mockResolvedValue(2);
      // Mock default task list retrieval
      mockPrisma.taskList.findFirst.mockResolvedValueOnce(defaultTaskList);
      // Mock task reassignment
      mockPrisma.task.updateMany.mockResolvedValue({ count: 3 });
      // Mock deletion
      mockPrisma.taskList.delete.mockResolvedValue(mockTaskList);

      const result = await taskListService.delete('list-123', mockContext);

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          taskListId: 'list-123',
          userId: 'user-123',
        },
        data: {
          taskListId: 'default-list',
        },
      });

      expect(mockPrisma.taskList.delete).toHaveBeenCalledWith({
        where: { id: 'list-123' },
      });

      expect(result).toBe(true);
    });

    it('should throw validation error when trying to delete the only task list', async () => {
      // Mock ownership check
      mockPrisma.taskList.findFirst.mockResolvedValue(mockTaskList);
      // Mock count check (only 1 task list)
      mockPrisma.taskList.count.mockResolvedValue(1);

      await expect(taskListService.delete('list-123', mockContext)).rejects.toThrow(
        'VALIDATION_ERROR: Cannot delete the only task list'
      );
    });

    it('should throw authorization error for non-owned task list', async () => {
      mockPrisma.taskList.findFirst.mockResolvedValue(null);

      await expect(taskListService.delete('list-123', mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR: Access denied'
      );
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive task list statistics', async () => {
      // Mock all count queries
      mockPrisma.taskList.count.mockResolvedValue(5); // total lists
      mockPrisma.task.count
        .mockResolvedValueOnce(25) // total tasks
        .mockResolvedValueOnce(15); // completed tasks

      const result = await taskListService.getStatistics(mockContext);

      expect(result).toEqual({
        totalLists: 5,
        totalTasks: 25,
        completedTasks: 15,
        pendingTasks: 10,
        averageTasksPerList: 5,
      });

      expect(mockPrisma.taskList.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockPrisma.task.count).toHaveBeenCalledTimes(2);
    });

    it('should handle zero task lists gracefully', async () => {
      mockPrisma.taskList.count.mockResolvedValue(0);
      mockPrisma.task.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

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
      await expect(taskListService.archive('list-123', mockContext)).rejects.toThrow(
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
});