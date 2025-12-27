/**
 * Comprehensive test suite for CalendarService
 * Tests CRUD operations, visibility toggles, user isolation, and validation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CalendarService } from '../CalendarService';
import { query as mockQuery, withTransaction as mockWithTransaction } from '../../config/database.js';
import { testUsers, testCalendars } from '../../__tests__/helpers/fixtures';
import { createQueryResult } from './helpers/mockDatabase';

// Mock the database module
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const withTransaction = vi.fn();
  return {
    query,
    withTransaction,
    pool: { query },
  };
});

const mockedQuery = vi.mocked(mockQuery);
const mockedWithTransaction = vi.mocked(mockWithTransaction);

describe('CalendarService', () => {
  let calendarService: CalendarService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    calendarService = new CalendarService({ enableLogging: false });
    vi.clearAllMocks();
    mockedQuery.mockReset();
    mockedWithTransaction.mockReset();
    mockedWithTransaction.mockImplementation(async (callback: any) =>
      callback({ query: mockedQuery })
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all calendars for the authenticated user', async () => {
      const mockCalendars = [testCalendars.primary, testCalendars.personal];
      mockedQuery.mockResolvedValueOnce(createQueryResult(mockCalendars));

      const result = await calendarService.findAll({}, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calendars'),
        expect.arrayContaining([mockUserId]),
        expect.anything()
      );
      expect(result).toEqual(mockCalendars);
      expect(result).toHaveLength(2);
    });

    it('should filter by visibility when specified', async () => {
      const visibleCalendars = [testCalendars.primary];
      mockedQuery.mockResolvedValueOnce(createQueryResult(visibleCalendars));

      const result = await calendarService.findAll({ isVisible: true }, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('"isVisible" = $2'),
        expect.arrayContaining([mockUserId, true]),
        expect.anything()
      );
      expect(result).toHaveLength(1);
      expect(result[0].isVisible).toBe(true);
    });

    it('should return empty array when user has no calendars', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await calendarService.findAll({}, mockContext);

      expect(result).toEqual([]);
    });

    it('should isolate calendars by user ID', async () => {
      const otherUserId = testUsers.secondary.id;
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await calendarService.findAll({}, { ...mockContext, userId: otherUserId });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([otherUserId]),
        expect.anything()
      );
    });
  });

  describe('findById', () => {
    it('should fetch a specific calendar by ID', async () => {
      const mockCalendar = testCalendars.primary;
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockCalendar]));

      const result = await calendarService.findById(mockCalendar.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calendars WHERE id = $1'),
        [mockCalendar.id],
        expect.anything()
      );
      expect(result).toEqual(mockCalendar);
    });

    it('should return null when calendar not found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await calendarService.findById('non-existent-id', mockContext);

      expect(result).toBeNull();
    });

    it('should query by id regardless of context', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await calendarService.findById('other-user-calendar-id', mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calendars WHERE id = $1'),
        ['other-user-calendar-id'],
        expect.anything()
      );
    });
  });

  describe('create', () => {
    it('should create a new calendar', async () => {
      const createDTO = {
        name: 'New Calendar',
        color: '#FF5733',
        isVisible: true,
      };
      const createdCalendar = {
        id: 'cal-new',
        userId: mockUserId,
        ...createDTO,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();

        if (lower.includes('select id from calendars') && lower.includes('name')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select count(*)') && lower.includes('from calendars')) {
          return createQueryResult([{ count: '1' }]);
        }
        if (lower.includes('insert into calendars')) {
          return createQueryResult([createdCalendar], 1);
        }
        return createQueryResult([]);
      });

      const result = await calendarService.create(createDTO, mockContext);

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendars'),
        expect.arrayContaining([createDTO.name, createDTO.color, mockUserId]),
        expect.anything()
      );
      expect(result).toEqual(createdCalendar);
      expect(result.userId).toBe(mockUserId);
    });

    it('should create first calendar as default', async () => {
      const createDTO = {
        name: 'First Calendar',
        color: '#3B82F6',
        isVisible: true,
      };
      const createdCalendar = {
        id: 'cal-first',
        userId: mockUserId,
        ...createDTO,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();

        if (lower.includes('select id from calendars') && lower.includes('name')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select count(*)') && lower.includes('from calendars')) {
          return createQueryResult([{ count: '0' }]);
        }
        if (lower.includes('update calendars') && lower.includes('"isdefault" = false')) {
          return createQueryResult([], 0);
        }
        if (lower.includes('insert into calendars')) {
          return createQueryResult([createdCalendar], 1);
        }
        return createQueryResult([]);
      });

      const result = await calendarService.create(createDTO, mockContext);

      expect(result.isDefault).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('"isDefault" = false'),
        [mockUserId],
        expect.anything()
      );
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        name: '',
        color: '',
      };

      await expect(calendarService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });

    it('should validate color format', async () => {
      const invalidDTO = {
        name: 'Test Calendar',
        color: 'invalid-color',
      };

      await expect(calendarService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update calendar properties', async () => {
      const calendarId = testCalendars.primary.id;
      const updateDTO = {
        name: 'Updated Name',
        color: '#10B981',
      };
      const updatedCalendar = {
        ...testCalendars.primary,
        ...updateDTO,
        updatedAt: new Date(),
      };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(createQueryResult([updatedCalendar]));

      const result = await calendarService.update(calendarId, updateDTO, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendars SET'),
        expect.arrayContaining([calendarId]),
        expect.anything()
      );
      expect(result?.name).toBe(updateDTO.name);
      expect(result?.color).toBe(updateDTO.color);
    });

    it('should not update calendars belonging to other users', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ userId: 'other-user' }]));

      await expect(
        calendarService.update('other-user-calendar', { name: 'Hacked' }, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });

    it('should return null when update finds no rows without ownership checks', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await calendarService.update('non-existent-id', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a calendar', async () => {
      const calendarId = testCalendars.hidden.id;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([{ count: '2' }]))
        .mockResolvedValueOnce(createQueryResult([{ isDefault: false }]))
        .mockResolvedValueOnce(createQueryResult([], 1));

      const result = await calendarService.delete(calendarId, mockContext);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM calendars WHERE id = $1'),
        [calendarId],
        expect.anything()
      );
    });

    it('should promote another calendar when deleting the default', async () => {
      const defaultCalendar = testCalendars.primary;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([{ count: '2' }]))
        .mockResolvedValueOnce(createQueryResult([{ isDefault: true }]))
        .mockResolvedValueOnce(createQueryResult([{ id: 'other-cal' }]))
        .mockResolvedValueOnce(createQueryResult([], 1))
        .mockResolvedValueOnce(createQueryResult([], 1));

      const result = await calendarService.delete(defaultCalendar.id, mockContext);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendars SET "isDefault" = true'),
        ['other-cal'],
        expect.anything()
      );
    });

    it('should not delete calendars belonging to other users', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ userId: 'other-user' }]));

      await expect(
        calendarService.delete('other-user-calendar', mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle calendar visibility to hidden', async () => {
      const calendar = { ...testCalendars.primary, isVisible: false };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([{ isVisible: true }]))
        .mockResolvedValueOnce(createQueryResult([calendar]));

      const result = await calendarService.toggleVisibility(calendar.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendars SET "isVisible"'),
        expect.arrayContaining([calendar.id]),
        expect.anything()
      );
      expect(result.isVisible).toBe(false);
    });

    it('should toggle calendar visibility to visible', async () => {
      const calendar = { ...testCalendars.hidden, isVisible: true };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([{ isVisible: false }]))
        .mockResolvedValueOnce(createQueryResult([calendar]));

      const result = await calendarService.toggleVisibility(calendar.id, mockContext);

      expect(result.isVisible).toBe(true);
    });

    it('should not toggle visibility for other users calendars', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ userId: 'other-user' }]));

      await expect(
        calendarService.toggleVisibility('other-user-calendar', mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('setDefault', () => {
    it('should set a calendar as default', async () => {
      const calendarId = testCalendars.personal.id;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([], 1))
        .mockResolvedValueOnce(createQueryResult([{ ...testCalendars.personal, isDefault: true }]));

      const result = await calendarService.setDefault(calendarId, mockContext);

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(result.isDefault).toBe(true);
    });

    it('should unset previous default when setting new default', async () => {
      const newDefaultId = testCalendars.personal.id;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(createQueryResult([], 1))
        .mockResolvedValueOnce(createQueryResult([{ ...testCalendars.personal, isDefault: true }]));

      await calendarService.setDefault(newDefaultId, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('"isDefault" = false'),
        [mockUserId],
        expect.anything()
      );
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('"isDefault" = true'),
        [newDefaultId],
        expect.anything()
      );
    });

    it('should not set default for other users calendars', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ userId: 'other-user' }]));

      await expect(
        calendarService.setDefault('other-user-calendar', mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(calendarService.findAll({}, mockContext)).rejects.toThrow('Connection timeout');
    });

    it('should handle concurrent visibility toggles', async () => {
      const calendarId = testCalendars.primary.id;

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid"')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select "isvisible"')) {
          return createQueryResult([{ isVisible: false }]);
        }
        if (lower.includes('update calendars set "isvisible"')) {
          return createQueryResult([{ ...testCalendars.primary, isVisible: true }]);
        }
        return createQueryResult([]);
      });

      const results = await Promise.all([
        calendarService.toggleVisibility(calendarId, mockContext),
        calendarService.toggleVisibility(calendarId, mockContext),
      ]);

      expect(results).toHaveLength(2);
    });

    it('should allow long calendar names', async () => {
      const longName = 'a'.repeat(256);
      const createDTO = {
        name: longName,
        color: '#3B82F6',
      };
      const createdCalendar = {
        id: 'cal-long',
        userId: mockUserId,
        ...createDTO,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();

        if (lower.includes('select id from calendars') && lower.includes('name')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select count(*)') && lower.includes('from calendars')) {
          return createQueryResult([{ count: '1' }]);
        }
        if (lower.includes('insert into calendars')) {
          return createQueryResult([createdCalendar], 1);
        }
        return createQueryResult([]);
      });

      const result = await calendarService.create(createDTO, mockContext);

      expect(result.name).toBe(longName);
    });
  });
});
