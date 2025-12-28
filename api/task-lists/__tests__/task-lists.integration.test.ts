/**
 * Integration tests for Task Lists API endpoints
 * Tests the complete flow from API routes to database operations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import taskListsHandler from '../index';
import taskListHandler from '../[id]';
import { getAllServices } from '../../../lib/services/index.js';
import type { CreateTaskListDTO, UpdateTaskListDTO } from '../../../lib/services/TaskListService';
import {
  createMockAuthRequest,
  createMockResponse,
  mockUser,
  testTaskLists,
} from '../../../lib/__tests__/helpers';

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

const mockTaskListService = {
  findAll: vi.fn(),
  getWithTaskCount: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setDefault: vi.fn(),
};

const mockServices = {
  taskList: mockTaskListService,
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

// Test data
const mockTaskList = testTaskLists.work;

const mockTaskListWithCounts = {
  ...mockTaskList,
  taskCount: 5,
  completedTaskCount: 2,
  pendingTaskCount: 3,
};

describe('Task Lists API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/task-lists', () => {
    it('should fetch all task lists for authenticated user', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      mockTaskListService.findAll.mockResolvedValue([mockTaskList]);

      await taskListsHandler(req, res);

      expect(mockTaskListService.findAll).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, [mockTaskList]);
    });

    it('should fetch task lists with task counts when requested', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { withTaskCount: 'true' },
      });
      const res = createMockResponse();

      mockTaskListService.getWithTaskCount.mockResolvedValue([mockTaskListWithCounts]);

      await taskListsHandler(req, res);

      expect(mockTaskListService.getWithTaskCount).toHaveBeenCalledWith({
        userId: 'user-123',
        requestId: 'test-request-123',
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(res, [mockTaskListWithCounts]);
    });

    it('should apply search filter from query parameters', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { search: 'work' },
      });
      const res = createMockResponse();

      mockTaskListService.findAll.mockResolvedValue([mockTaskList]);

      await taskListsHandler(req, res);

      expect(mockTaskListService.findAll).toHaveBeenCalledWith(
        { search: 'work' },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        user: undefined,
      });
      const res = createMockResponse();

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
    });

    it('should handle service errors gracefully', async () => {
      const req = createMockAuthRequest(mockUser, { method: 'GET' });
      const res = createMockResponse();

      mockTaskListService.findAll.mockRejectedValue(new Error('Database connection failed'));

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Database connection failed',
      });
    });
  });

  describe('POST /api/task-lists', () => {
    const createTaskListData: CreateTaskListDTO = {
      name: 'Work Tasks',
      color: '#FF5722',
      icon: 'work',
      description: 'Tasks related to work projects',
    };

    it('should create a new task list successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskListData,
      });
      const res = createMockResponse();

      const createdTaskList = { ...mockTaskList, ...createTaskListData, id: 'new-list-123' };
      mockTaskListService.create.mockResolvedValue(createdTaskList);

      await taskListsHandler(req, res);

      expect(mockTaskListService.create).toHaveBeenCalledWith(
        createTaskListData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, createdTaskList, 201);
    });

    it('should return 400 for missing name', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: { ...createTaskListData, name: '' },
      });
      const res = createMockResponse();

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task list name is required',
      });
    });

    it('should return 400 for missing color', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: { ...createTaskListData, color: undefined },
      });
      const res = createMockResponse();

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task list color is required',
      });
    });

    it('should handle validation errors from service', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskListData,
      });
      const res = createMockResponse();

      mockTaskListService.create.mockRejectedValue(
        new Error('VALIDATION_ERROR: Task list name already exists')
      );

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task list name already exists',
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createTaskListData,
        user: undefined,
      });
      const res = createMockResponse();

      await taskListsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
    });
  });

  describe('GET /api/task-lists/[id]', () => {
    it('should fetch a specific task list by ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'list-123' },
      });
      const res = createMockResponse();

      mockTaskListService.findById.mockResolvedValue(mockTaskList);

      await taskListHandler(req, res);

      expect(mockTaskListService.findById).toHaveBeenCalledWith(
        'list-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockTaskList);
    });

    it('should return 404 for non-existent task list', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockTaskListService.findById.mockResolvedValue(null);

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task list not found',
      });
    });

    it('should return 400 for missing task list ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Task list ID is required',
      });
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'list-123' },
      });
      const res = createMockResponse();

      mockTaskListService.findById.mockRejectedValue(
        new Error('AUTHORIZATION_ERROR: Access denied')
      );

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    });
  });

  describe('PUT /api/task-lists/[id]', () => {
    const updateData: UpdateTaskListDTO = {
      name: 'Updated Task List',
      color: '#4CAF50',
      icon: 'updated',
      description: 'Updated description',
    };

    it('should update a task list successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'list-123' },
        body: updateData,
      });
      const res = createMockResponse();

      const updatedTaskList = { ...mockTaskList, ...updateData };
      mockTaskListService.update.mockResolvedValue(updatedTaskList);

      await taskListHandler(req, res);

      expect(mockTaskListService.update).toHaveBeenCalledWith(
        'list-123',
        updateData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, updatedTaskList);
    });

    it('should return 404 for non-existent task list', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'non-existent' },
        body: updateData,
      });
      const res = createMockResponse();

      mockTaskListService.update.mockResolvedValue(null);

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task list not found',
      });
    });

    it('should handle validation errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'list-123' },
        body: updateData,
      });
      const res = createMockResponse();

      mockTaskListService.update.mockRejectedValue(
        new Error('VALIDATION_ERROR: Invalid color format')
      );

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid color format',
      });
    });
  });

  describe('PATCH /api/task-lists/[id]', () => {
    it('should set task list as default', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'list-123', action: 'set-default' },
      });
      const res = createMockResponse();

      const defaultTaskList = { ...mockTaskList, isDefault: true };
      mockTaskListService.setDefault.mockResolvedValue(defaultTaskList);

      await taskListHandler(req, res);

      expect(mockTaskListService.setDefault).toHaveBeenCalledWith(
        'list-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, defaultTaskList);
    });

    it('should perform regular patch update when no action specified', async () => {
      const patchData = { name: 'Patched Name' };
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'list-123' },
        body: patchData,
      });
      const res = createMockResponse();

      const patchedTaskList = { ...mockTaskList, ...patchData };
      mockTaskListService.update.mockResolvedValue(patchedTaskList);

      await taskListHandler(req, res);

      expect(mockTaskListService.update).toHaveBeenCalledWith(
        'list-123',
        patchData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, patchedTaskList);
    });

    it('should return 404 for non-existent task list', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'non-existent', action: 'set-default' },
      });
      const res = createMockResponse();

      mockTaskListService.setDefault.mockResolvedValue(null);

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task list not found',
      });
    });
  });

  describe('DELETE /api/task-lists/[id]', () => {
    it('should delete a task list successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'list-123' },
      });
      const res = createMockResponse();

      mockTaskListService.delete.mockResolvedValue(true);

      await taskListHandler(req, res);

      expect(mockTaskListService.delete).toHaveBeenCalledWith(
        'list-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { deleted: true });
    });

    it('should return 404 for non-existent task list', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockTaskListService.delete.mockResolvedValue(false);

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Task list not found',
      });
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'list-123' },
      });
      const res = createMockResponse();

      mockTaskListService.delete.mockRejectedValue(
        new Error('AUTHORIZATION_ERROR: Access denied')
      );

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    });

    it('should handle validation errors (cannot delete only task list)', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'list-123' },
      });
      const res = createMockResponse();

      mockTaskListService.delete.mockRejectedValue(
        new Error('VALIDATION_ERROR: Cannot delete the only task list')
      );

      await taskListHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete the only task list',
      });
    });
  });
});
