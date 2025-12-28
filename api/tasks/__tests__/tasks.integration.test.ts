/**
 * Integration tests for Task Management API endpoints
 * Tests the complete flow from API routes to database operations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import tasksHandler from '../index';
import taskHandler from '../[id]';
import { getAllServices } from '../../../lib/services/index.js';
import {
  createMockAuthRequest,
  createMockResponse,
  mockUser,
} from '../../../lib/__tests__/helpers';
import type { CreateTaskDTO, UpdateTaskDTO } from '../../../lib/services/TaskService';

// Mock the services
vi.mock('../../../lib/services/index.js');
vi.mock('../../../lib/middleware/errorHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    asyncHandler: (handler: any) => handler,
    sendSuccess: vi.fn(),
    sendError: vi.fn(),
  };
});

vi.mock('../../../lib/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    devAuth: () => (_req: any, _res: any, next: any) => next(),
  };
});

const mockTaskService = {
  findAll: vi.fn(),
  findPaginated: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  toggleCompletion: vi.fn(),
};

const mockServices = {
  task: mockTaskService,
};

// Mock error handler functions
const mockSendSuccess = vi.fn();
const mockSendError = vi.fn();

vi.mocked(getAllServices).mockReturnValue(mockServices as unknown as ReturnType<typeof getAllServices>);

// Import mocked functions
const { sendSuccess, sendError } = await import('../../../lib/middleware/errorHandler.js');
vi.mocked(sendSuccess).mockImplementation(mockSendSuccess);
vi.mocked(sendError).mockImplementation((res, error) => {
  mockSendError(res, {
    statusCode: error?.statusCode,
    code: error?.code,
    message: error?.message,
  });
});

const mockTask = {
  id: 'task-123',
  title: 'Test Task',
  completed: false,
  completedAt: null,
  scheduledDate: new Date('2024-01-15T10:00:00Z'),
  priority: 'MEDIUM' as const,
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

// Mock helpers now imported from shared helpers

describe('Tasks API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('should fetch all tasks for authenticated user', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      mockTaskService.findAll.mockResolvedValue([mockTask]);

      await tasksHandler(req, res);

      expect(mockTaskService.findAll).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { data: [mockTask] });
    });

    it('should apply filters from query parameters', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {
          completed: 'true',
          taskListId: 'list-123',
          priority: 'HIGH',
          search: 'test',
          overdue: 'true',
          scheduledDateFrom: '2024-01-01',
          scheduledDateTo: '2024-01-31',
          tags: ['work', 'urgent'],
          sortBy: 'scheduledDate',
          sortOrder: 'asc',
        },
      });
      const res = createMockResponse();

      mockTaskService.findAll.mockResolvedValue([mockTask]);

      await tasksHandler(req, res);

      expect(mockTaskService.findAll).toHaveBeenCalledWith(
        {
          completed: true,
          taskListId: 'list-123',
          priority: 'HIGH',
          search: 'test',
          overdue: true,
          scheduledDate: {
            from: new Date('2024-01-01'),
            to: new Date('2024-01-31'),
          },
          tags: ['work', 'urgent'],
          sortBy: 'scheduledDate',
          sortOrder: 'asc',
        },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should use pagination when requested', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {
          page: '2',
          limit: '10',
        },
      });
      const res = createMockResponse();

      const paginatedResult = {
        data: [mockTask],
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      };

      mockTaskService.findPaginated.mockResolvedValue(paginatedResult);

      await tasksHandler(req, res);

      expect(mockTaskService.findPaginated).toHaveBeenCalledWith(
        {},
        2,
        10,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, paginatedResult);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        user: undefined,
      });
      const res = createMockResponse();

      await tasksHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
    });

    it('should handle service errors gracefully', async () => {
      const req = createMockAuthRequest(mockUser, { method: 'GET' });
      const res = createMockResponse();

      mockTaskService.findAll.mockRejectedValue(new Error('Database connection failed'));

      await tasksHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Database connection failed',
      });
    });
  });

  describe('POST /api/tasks', () => {
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

    it('should create a new task successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskData,
      });
      const res = createMockResponse();

      const createdTask = { ...mockTask, ...createTaskData, id: 'new-task-123' };
      mockTaskService.create.mockResolvedValue(createdTask);

      await tasksHandler(req, res);

      expect(mockTaskService.create).toHaveBeenCalledWith(
        createTaskData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, createdTask, 201);
    });

    it('should return 400 for missing title', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: { ...createTaskData, title: '' },
      });
      const res = createMockResponse();

      await tasksHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task title is required',
      });
    });

    it('should handle validation errors from service', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskData,
      });
      const res = createMockResponse();

      mockTaskService.create.mockRejectedValue(
        new Error('VALIDATION_ERROR: Task list not found')
      );

      await tasksHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task list not found',
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskData,
        user: undefined,
      });
      const res = createMockResponse();

      await tasksHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
    });
  });

  describe('GET /api/tasks/[id]', () => {
    it('should fetch a specific task by ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'task-123' },
      });
      const res = createMockResponse();

      mockTaskService.findById.mockResolvedValue(mockTask);

      await taskHandler(req, res);

      expect(mockTaskService.findById).toHaveBeenCalledWith(
        'task-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockTask);
    });

    it('should return 404 for non-existent task', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockTaskService.findById.mockResolvedValue(null);

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task not found',
      });
    });

    it('should return 400 for missing task ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task ID is required',
      });
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'task-123' },
      });
      const res = createMockResponse();

      mockTaskService.findById.mockRejectedValue(
        new Error('AUTHORIZATION_ERROR: Access denied')
      );

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    });
  });

  describe('PUT /api/tasks/[id]', () => {
    const updateData: UpdateTaskDTO = {
      title: 'Updated Task',
      completed: true,
      priority: 'LOW',
      scheduledDate: new Date('2024-01-17T10:00:00Z'),
    };

    it('should update a task successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'task-123' },
        body: updateData,
      });
      const res = createMockResponse();

      const updatedTask = { ...mockTask, ...updateData };
      mockTaskService.update.mockResolvedValue(updatedTask);

      await taskHandler(req, res);

      expect(mockTaskService.update).toHaveBeenCalledWith(
        'task-123',
        updateData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, updatedTask);
    });

    it('should return 404 for non-existent task', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'non-existent' },
        body: updateData,
      });
      const res = createMockResponse();

      mockTaskService.update.mockResolvedValue(null);

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task not found',
      });
    });

    it('should handle validation errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'task-123' },
        body: updateData,
      });
      const res = createMockResponse();

      mockTaskService.update.mockRejectedValue(
        new Error('VALIDATION_ERROR: Invalid priority value')
      );

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid priority value',
      });
    });
  });

  describe('PATCH /api/tasks/[id]', () => {
    it('should toggle task completion', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'task-123', action: 'toggle' },
      });
      const res = createMockResponse();

      const toggledTask = { ...mockTask, completed: true, completedAt: new Date() };
      mockTaskService.toggleCompletion.mockResolvedValue(toggledTask);

      await taskHandler(req, res);

      expect(mockTaskService.toggleCompletion).toHaveBeenCalledWith(
        'task-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, toggledTask);
    });

    it('should perform regular patch update when no action specified', async () => {
      const patchData = { title: 'Patched Title' };
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'task-123' },
        body: patchData,
      });
      const res = createMockResponse();

      const patchedTask = { ...mockTask, ...patchData };
      mockTaskService.update.mockResolvedValue(patchedTask);

      await taskHandler(req, res);

      expect(mockTaskService.update).toHaveBeenCalledWith(
        'task-123',
        patchData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, patchedTask);
    });
  });

  describe('DELETE /api/tasks/[id]', () => {
    it('should delete a task successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'task-123' },
      });
      const res = createMockResponse();

      mockTaskService.delete.mockResolvedValue(true);

      await taskHandler(req, res);

      expect(mockTaskService.delete).toHaveBeenCalledWith(
        'task-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { deleted: true });
    });

    it('should return 404 for non-existent task', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockTaskService.delete.mockResolvedValue(false);

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task not found',
      });
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'task-123' },
      });
      const res = createMockResponse();

      mockTaskService.delete.mockRejectedValue(
        new Error('AUTHORIZATION_ERROR: Access denied')
      );

      await taskHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    });
  });
});
