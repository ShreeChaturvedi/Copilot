/**
 * Integration tests for Calendar API endpoints
 * Tests the complete request-response cycle with full middleware integration
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  createMockAuthRequest,
  createMockResponse,
  mockUser,
} from '../../../lib/__tests__/helpers';
import type { CreateCalendarDTO, UpdateCalendarDTO } from '../../../lib/services/CalendarService';

const {
  mockCalendarService,
  mockSendSuccess,
  mockSendError,
  mockGetAllServices,
} = vi.hoisted(() => {
  const service = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleVisibility: vi.fn(),
    setDefault: vi.fn(),
    getWithEventCounts: vi.fn(),
  };

  return {
    mockCalendarService: service,
    mockSendSuccess: vi.fn((res, data, statusCode = 200) => {
      res.status(statusCode).json({ success: true, data });
    }),
    mockSendError: vi.fn((res, error) => {
      const statusCode = error.statusCode ?? 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }),
    mockGetAllServices: vi.fn(() => ({ calendar: service })),
  };
});

vi.mock('../../../lib/services/index.js', () => ({
  getAllServices: mockGetAllServices,
}));

vi.mock('../../../lib/middleware/errorHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    asyncHandler: (handler: any) => handler,
    sendSuccess: mockSendSuccess,
    sendError: mockSendError,
  };
});

vi.mock('../../../lib/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    devAuth: () => (_req: any, _res: any, next: any) => next(),
  };
});

let calendarsHandler: typeof import('../index').default;
let calendarHandler: typeof import('../[id]').default;

beforeAll(async () => {
  calendarsHandler = (await import('../index')).default;
  calendarHandler = (await import('../[id]')).default;
});

// Test data
const mockCalendar = {
  id: 'cal-123',
  name: 'Work Calendar',
  color: '#3B82F6',
  isVisible: true,
  isDefault: true,
  userId: 'user-123',
  createdAt: new Date('2024-01-10T00:00:00Z'),
  updatedAt: new Date('2024-01-10T00:00:00Z'),
};

const mockCalendar2 = {
  id: 'cal-456',
  name: 'Personal',
  color: '#10B981',
  isVisible: true,
  isDefault: false,
  userId: 'user-123',
  createdAt: new Date('2024-01-11T00:00:00Z'),
  updatedAt: new Date('2024-01-11T00:00:00Z'),
};

describe('Calendar API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/calendars', () => {
    it('should fetch all calendars for authenticated user', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      mockCalendarService.findAll.mockResolvedValue([mockCalendar, mockCalendar2]);

      await calendarsHandler(req, res);

      expect(mockCalendarService.findAll).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, [mockCalendar, mockCalendar2]);
    });

    it('should filter calendars by visibility', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { isVisible: 'true' },
      });
      const res = createMockResponse();

      mockCalendarService.findAll.mockResolvedValue([mockCalendar]);

      await calendarsHandler(req, res);

      expect(mockCalendarService.findAll).toHaveBeenCalledWith(
        { isVisible: true },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should search calendars by name', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { search: 'work' },
      });
      const res = createMockResponse();

      mockCalendarService.findAll.mockResolvedValue([mockCalendar]);

      await calendarsHandler(req, res);

      expect(mockCalendarService.findAll).toHaveBeenCalledWith(
        { search: 'work' },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should fetch calendars with event counts', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { withEventCounts: 'true' },
      });
      const res = createMockResponse();

      const calendarsWithCounts = [
        { ...mockCalendar, eventCount: 5 },
        { ...mockCalendar2, eventCount: 3 },
      ];

      mockCalendarService.getWithEventCounts.mockResolvedValue(calendarsWithCounts);

      await calendarsHandler(req, res);

      expect(mockCalendarService.getWithEventCounts).toHaveBeenCalledWith({
        userId: 'user-123',
        requestId: 'test-request-123',
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(res, calendarsWithCounts);
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      delete req.user;
      const res = createMockResponse();

      await calendarsHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('UNAUTHORIZED');
    });

    it('should handle service errors gracefully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      mockCalendarService.findAll.mockRejectedValue(new Error('Database connection failed'));

      await calendarsHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/calendars', () => {
    it('should create a new calendar', async () => {
      const createDTO: CreateCalendarDTO = {
        name: 'New Calendar',
        color: '#FF5733',
        isVisible: true,
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createDTO,
      });
      const res = createMockResponse();

      const createdCalendar = {
        ...mockCalendar,
        ...createDTO,
        id: 'cal-new',
        userId: 'user-123',
      };

      mockCalendarService.create.mockResolvedValue(createdCalendar);

      await calendarsHandler(req, res);

      expect(mockCalendarService.create).toHaveBeenCalledWith(
        createDTO,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, createdCalendar, 201);
    });

    it('should validate required name field', async () => {
      const createDTO: CreateCalendarDTO = {
        name: '  ',
        color: '#FF5733',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createDTO,
      });
      const res = createMockResponse();

      await calendarsHandler(req, res);

      expect(mockCalendarService.create).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
      expect(errorArg.message).toContain('name');
    });

    it('should validate required color field', async () => {
      const createDTO = {
        name: 'Test Calendar',
        color: '',
      } as CreateCalendarDTO;

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createDTO,
      });
      const res = createMockResponse();

      await calendarsHandler(req, res);

      expect(mockCalendarService.create).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
      expect(errorArg.message).toContain('color');
    });

    it('should return 401 when user is not authenticated', async () => {
      const createDTO: CreateCalendarDTO = {
        name: 'Test',
        color: '#FF5733',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createDTO,
      });
      delete req.user;
      const res = createMockResponse();

      await calendarsHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('UNAUTHORIZED');
    });

    it('should handle validation errors from service', async () => {
      const createDTO: CreateCalendarDTO = {
        name: 'Test',
        color: 'invalid-color',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: createDTO,
      });
      const res = createMockResponse();

      const error = new Error('VALIDATION_ERROR: Invalid color format');
      mockCalendarService.create.mockRejectedValue(error);

      await calendarsHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/calendars/[id]', () => {
    it('should fetch specific calendar by ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'cal-123' },
      });
      const res = createMockResponse();

      mockCalendarService.findById.mockResolvedValue(mockCalendar);

      await calendarHandler(req, res);

      expect(mockCalendarService.findById).toHaveBeenCalledWith(
        'cal-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockCalendar);
    });

    it('should return 404 when calendar not found', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockCalendarService.findById.mockResolvedValue(null);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('NOT_FOUND');
    });

    it('should validate calendar ID parameter', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
      expect(errorArg.message).toContain('ID');
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'cal-123' },
      });
      delete req.user;
      const res = createMockResponse();

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('UNAUTHORIZED');
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'cal-123' },
      });
      const res = createMockResponse();

      const error = new Error('AUTHORIZATION_ERROR: Access denied');
      mockCalendarService.findById.mockRejectedValue(error);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/calendars/[id]', () => {
    it('should update calendar properties', async () => {
      const updateDTO: UpdateCalendarDTO = {
        name: 'Updated Calendar',
        color: '#10B981',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'cal-123' },
        body: updateDTO,
      });
      const res = createMockResponse();

      const updatedCalendar = {
        ...mockCalendar,
        ...updateDTO,
        updatedAt: new Date(),
      };

      mockCalendarService.update.mockResolvedValue(updatedCalendar);

      await calendarHandler(req, res);

      expect(mockCalendarService.update).toHaveBeenCalledWith(
        'cal-123',
        updateDTO,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, updatedCalendar);
    });

    it('should return 404 when calendar not found', async () => {
      const updateDTO: UpdateCalendarDTO = {
        name: 'Updated',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'non-existent' },
        body: updateDTO,
      });
      const res = createMockResponse();

      mockCalendarService.update.mockResolvedValue(null);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('NOT_FOUND');
    });

    it('should validate calendar ID parameter', async () => {
      const updateDTO: UpdateCalendarDTO = {
        name: 'Updated',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: {},
        body: updateDTO,
      });
      const res = createMockResponse();

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
    });

    it('should handle validation errors from service', async () => {
      const updateDTO: UpdateCalendarDTO = {
        color: 'invalid',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'cal-123' },
        body: updateDTO,
      });
      const res = createMockResponse();

      const error = new Error('VALIDATION_ERROR: Invalid color format');
      mockCalendarService.update.mockRejectedValue(error);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
    });

    it('should handle authorization errors', async () => {
      const updateDTO: UpdateCalendarDTO = {
        name: 'Updated',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'cal-123' },
        body: updateDTO,
      });
      const res = createMockResponse();

      const error = new Error('AUTHORIZATION_ERROR: Not owner');
      mockCalendarService.update.mockRejectedValue(error);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /api/calendars/[id]', () => {
    it('should toggle calendar visibility', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'cal-123', action: 'toggle-visibility' },
      });
      const res = createMockResponse();

      const toggledCalendar = {
        ...mockCalendar,
        isVisible: false,
      };

      mockCalendarService.toggleVisibility.mockResolvedValue(toggledCalendar);

      await calendarHandler(req, res);

      expect(mockCalendarService.toggleVisibility).toHaveBeenCalledWith(
        'cal-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, toggledCalendar);
    });

    it('should set calendar as default', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'cal-456', action: 'set-default' },
      });
      const res = createMockResponse();

      const defaultCalendar = {
        ...mockCalendar2,
        isDefault: true,
      };

      mockCalendarService.setDefault.mockResolvedValue(defaultCalendar);

      await calendarHandler(req, res);

      expect(mockCalendarService.setDefault).toHaveBeenCalledWith(
        'cal-456',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, defaultCalendar);
    });

    it('should perform regular patch update without action', async () => {
      const updateDTO: UpdateCalendarDTO = {
        name: 'Patched Calendar',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'cal-123' },
        body: updateDTO,
      });
      const res = createMockResponse();

      const patchedCalendar = {
        ...mockCalendar,
        ...updateDTO,
      };

      mockCalendarService.update.mockResolvedValue(patchedCalendar);

      await calendarHandler(req, res);

      expect(mockCalendarService.update).toHaveBeenCalledWith(
        'cal-123',
        updateDTO,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should return 404 when calendar not found for toggle', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'PATCH',
        query: { id: 'non-existent', action: 'toggle-visibility' },
      });
      const res = createMockResponse();

      mockCalendarService.toggleVisibility.mockResolvedValue(null);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/calendars/[id]', () => {
    it('should delete calendar successfully', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'cal-123' },
      });
      const res = createMockResponse();

      mockCalendarService.delete.mockResolvedValue(true);

      await calendarHandler(req, res);

      expect(mockCalendarService.delete).toHaveBeenCalledWith(
        'cal-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { deleted: true });
    });

    it('should return 404 when calendar not found', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockCalendarService.delete.mockResolvedValue(false);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('NOT_FOUND');
    });

    it('should validate calendar ID parameter', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: {},
      });
      const res = createMockResponse();

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'cal-123' },
      });
      delete req.user;
      const res = createMockResponse();

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('UNAUTHORIZED');
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'cal-123' },
      });
      const res = createMockResponse();

      const error = new Error('AUTHORIZATION_ERROR: Cannot delete');
      mockCalendarService.delete.mockRejectedValue(error);

      await calendarHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
      const errorArg = mockSendError.mock.calls[0][1];
      expect(errorArg.code).toBe('FORBIDDEN');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent requests gracefully', async () => {
      const req1 = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res1 = createMockResponse();

      const req2 = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: { name: 'New', color: '#FF5733' },
      });
      const res2 = createMockResponse();

      mockCalendarService.findAll.mockResolvedValue([mockCalendar]);
      mockCalendarService.create.mockResolvedValue(mockCalendar);

      await Promise.all([
        calendarsHandler(req1, res1),
        calendarsHandler(req2, res2),
      ]);

      expect(mockCalendarService.findAll).toHaveBeenCalled();
      expect(mockCalendarService.create).toHaveBeenCalled();
    });

    it('should handle service timeout errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockCalendarService.findAll.mockRejectedValue(timeoutError);

      await calendarsHandler(req, res);

      expect(mockSendError).toHaveBeenCalled();
    });

    it('should preserve request context through operations', async () => {
      const requestId = 'custom-request-789';
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
        headers: {
          'x-request-id': requestId,
        },
      });
      const res = createMockResponse();

      mockCalendarService.findAll.mockResolvedValue([]);

      await calendarsHandler(req, res);

      expect(mockCalendarService.findAll).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          requestId,
        })
      );
    });
  });
});
