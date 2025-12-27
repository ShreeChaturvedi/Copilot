/**
 * Comprehensive test suite for CalendarService
 * Tests CRUD operations, visibility toggles, user isolation, and validation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CalendarService } from '../CalendarService';
import { pool } from '../../config/database';
import { testUsers, testCalendars } from '../../__tests__/helpers/fixtures';

// Mock the database pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(),
}));

describe('CalendarService', () => {
  let calendarService: CalendarService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    calendarService = new CalendarService(pool, mockContext);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all calendars for the authenticated user', async () => {
      const mockCalendars = [testCalendars.primary, testCalendars.personal];
      vi.mocked(pool.query).mockResolvedValue({
        rows: mockCalendars,
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calendars'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toEqual(mockCalendars);
      expect(result).toHaveLength(2);
    });

    it('should filter by visibility when specified', async () => {
      const visibleCalendars = [testCalendars.primary];
      vi.mocked(pool.query).mockResolvedValue({
        rows: visibleCalendars,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findAll({ isVisible: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_visible = $2'),
        expect.arrayContaining([mockUserId, true])
      );
      expect(result).toHaveLength(1);
      expect(result[0].isVisible).toBe(true);
    });

    it('should return empty array when user has no calendars', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findAll();

      expect(result).toEqual([]);
    });

    it('should isolate calendars by user ID', async () => {
      const otherUserId = testUsers.secondary.id;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const otherUserService = new CalendarService(pool, { ...mockContext, userId: otherUserId });
      await otherUserService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([otherUserId])
      );
    });
  });

  describe('findById', () => {
    it('should fetch a specific calendar by ID', async () => {
      const mockCalendar = testCalendars.primary;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [mockCalendar],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findById(mockCalendar.id);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calendars WHERE id = $1 AND user_id = $2'),
        [mockCalendar.id, mockUserId]
      );
      expect(result).toEqual(mockCalendar);
    });

    it('should return null when calendar not found', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return calendars belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.findById('other-user-calendar-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toBeNull();
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

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdCalendar],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.create(createDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendars'),
        expect.arrayContaining([mockUserId, createDTO.name, createDTO.color])
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

      // Mock that user has no calendars
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [{ ...createDTO, id: 'cal-first', userId: mockUserId, isDefault: true }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await calendarService.create(createDTO);

      expect(result.isDefault).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        name: '',
        color: '',
      };

      await expect(calendarService.create(invalidDTO as any)).rejects.toThrow();
    });

    it('should validate color format', async () => {
      const invalidDTO = {
        name: 'Test Calendar',
        color: 'invalid-color',
      };

      await expect(calendarService.create(invalidDTO as any)).rejects.toThrow();
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

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedCalendar],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.update(calendarId, updateDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendars'),
        expect.arrayContaining([calendarId, mockUserId])
      );
      expect(result.name).toBe(updateDTO.name);
      expect(result.color).toBe(updateDTO.color);
    });

    it('should not update calendars belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        calendarService.update('other-user-calendar', { name: 'Hacked' })
      ).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });

    it('should return null when updating non-existent calendar', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        calendarService.update('non-existent-id', { name: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a calendar', async () => {
      const calendarId = testCalendars.hidden.id;

      // Mock finding the calendar
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testCalendars.hidden],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock deletion
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      await calendarService.delete(calendarId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM calendars WHERE id = $1 AND user_id = $2'),
        [calendarId, mockUserId]
      );
    });

    it('should not delete default calendar if it has events', async () => {
      const defaultCalendar = testCalendars.primary;

      // Mock finding the calendar
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [defaultCalendar],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock checking for events
        .mockResolvedValueOnce({
          rows: [{ count: 5 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      await expect(calendarService.delete(defaultCalendar.id)).rejects.toThrow();
    });

    it('should not delete calendars belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(calendarService.delete('other-user-calendar')).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle calendar visibility to hidden', async () => {
      const calendar = { ...testCalendars.primary, isVisible: false };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [calendar],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.toggleVisibility(calendar.id, false);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendars'),
        expect.arrayContaining([calendar.id, mockUserId, false])
      );
      expect(result.isVisible).toBe(false);
    });

    it('should toggle calendar visibility to visible', async () => {
      const calendar = { ...testCalendars.hidden, isVisible: true };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [calendar],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await calendarService.toggleVisibility(calendar.id, true);

      expect(result.isVisible).toBe(true);
    });

    it('should not toggle visibility for other users calendars', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        calendarService.toggleVisibility('other-user-calendar', false)
      ).rejects.toThrow();
    });
  });

  describe('setDefault', () => {
    it('should set a calendar as default', async () => {
      const calendarId = testCalendars.personal.id;

      // Mock: unset current default, then set new default
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [{ ...testCalendars.personal, isDefault: true }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await calendarService.setDefault(calendarId);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(result.isDefault).toBe(true);
    });

    it('should unset previous default when setting new default', async () => {
      const newDefaultId = testCalendars.personal.id;

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [{ ...testCalendars.personal, isDefault: true }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      await calendarService.setDefault(newDefaultId);

      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('is_default = FALSE'),
        [mockUserId]
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('is_default = TRUE'),
        [newDefaultId, mockUserId]
      );
    });

    it('should not set default for other users calendars', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          fields: [],
          command: '',
          oid: 0,
        });

      await expect(calendarService.setDefault('other-user-calendar')).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection timeout'));

      await expect(calendarService.findAll()).rejects.toThrow('Connection timeout');
    });

    it('should handle concurrent visibility toggles', async () => {
      const calendarId = testCalendars.primary.id;

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ ...testCalendars.primary, isVisible: false }],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const results = await Promise.all([
        calendarService.toggleVisibility(calendarId, false),
        calendarService.toggleVisibility(calendarId, true),
      ]);

      expect(results).toHaveLength(2);
    });

    it('should validate maximum name length', async () => {
      const longName = 'a'.repeat(256);
      const createDTO = {
        name: longName,
        color: '#3B82F6',
      };

      await expect(calendarService.create(createDTO as any)).rejects.toThrow();
    });
  });
});
