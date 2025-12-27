/**
 * Comprehensive test suite for EventService
 * Tests CRUD operations, recurring events (rrule), conflict detection, and date filtering
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventService } from '../EventService';
import { pool } from '../../config/database';
import { testUsers, testEvents, testCalendars, dateRanges } from '../../__tests__/helpers/fixtures';

// Mock the database pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(),
}));

describe('EventService', () => {
  let eventService: EventService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    eventService = new EventService(pool, mockContext);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all events for the authenticated user', async () => {
      const mockEvents = [testEvents.meeting, testEvents.allDay];
      vi.mocked(pool.query).mockResolvedValue({
        rows: mockEvents,
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT e.*'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toEqual(mockEvents);
      expect(result).toHaveLength(2);
    });

    it('should filter events by calendar ID', async () => {
      const calendarId = testCalendars.primary.id;
      const filteredEvents = [testEvents.meeting];

      vi.mocked(pool.query).mockResolvedValue({
        rows: filteredEvents,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll({ calendarId });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('calendar_id = $2'),
        expect.arrayContaining([mockUserId, calendarId])
      );
      expect(result).toHaveLength(1);
    });

    it('should filter events by date range', async () => {
      const { start, end } = dateRanges.thisWeek;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll({ startDate: start, endDate: end });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('start_time'),
        expect.arrayContaining([mockUserId, start, end])
      );
      expect(result).toHaveLength(1);
    });

    it('should return only visible calendar events when specified', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll({ visibleOnly: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('c.is_visible = TRUE'),
        expect.any(Array)
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when user has no events', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should fetch a specific event by ID', async () => {
      const mockEvent = testEvents.meeting;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [mockEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findById(mockEvent.id);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.id = $1 AND e.user_id = $2'),
        [mockEvent.id, mockUserId]
      );
      expect(result).toEqual(mockEvent);
    });

    it('should return null when event not found', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return events belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findById('other-user-event-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new one-time event', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'New Meeting',
        description: 'Quarterly review',
        startTime: new Date('2024-01-20T14:00:00Z'),
        endTime: new Date('2024-01-20T15:00:00Z'),
        isAllDay: false,
        location: 'Office',
      };

      const createdEvent = {
        id: 'event-new',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          mockUserId,
          createDTO.calendarId,
          createDTO.title,
        ])
      );
      expect(result).toEqual(createdEvent);
      expect(result.userId).toBe(mockUserId);
    });

    it('should create an all-day event', async () => {
      const createDTO = {
        calendarId: testCalendars.personal.id,
        title: 'Birthday',
        startTime: new Date('2024-02-15T00:00:00Z'),
        endTime: new Date('2024-02-15T23:59:59Z'),
        isAllDay: true,
      };

      const createdEvent = {
        id: 'event-allday',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(result.isAllDay).toBe(true);
      expect(result.title).toBe(createDTO.title);
    });

    it('should create a recurring event with rrule', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Weekly Standup',
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T09:30:00Z'),
        isAllDay: false,
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      };

      const createdEvent = {
        id: 'event-recurring',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(result.rrule).toBe(createDTO.rrule);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('rrule'),
        expect.any(Array)
      );
    });

    it('should validate calendar belongs to user before creating event', async () => {
      const createDTO = {
        calendarId: 'other-user-calendar',
        title: 'Unauthorized Event',
        startTime: new Date(),
        endTime: new Date(),
      };

      vi.mocked(pool.query).mockRejectedValue(
        new Error('Foreign key constraint violation')
      );

      await expect(eventService.create(createDTO as any)).rejects.toThrow();
    });

    it('should validate start time is before end time', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Invalid Event',
        startTime: new Date('2024-01-20T15:00:00Z'),
        endTime: new Date('2024-01-20T14:00:00Z'), // Before start time
      };

      await expect(eventService.create(createDTO as any)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        title: '',
        startTime: null,
      };

      await expect(eventService.create(invalidDTO as any)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update event properties', async () => {
      const eventId = testEvents.meeting.id;
      const updateDTO = {
        title: 'Updated Meeting',
        location: 'Conference Room B',
      };

      const updatedEvent = {
        ...testEvents.meeting,
        ...updateDTO,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.update(eventId, updateDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE events'),
        expect.arrayContaining([eventId, mockUserId])
      );
      expect(result.title).toBe(updateDTO.title);
      expect(result.location).toBe(updateDTO.location);
    });

    it('should update event times', async () => {
      const eventId = testEvents.meeting.id;
      const updateDTO = {
        startTime: new Date('2024-01-15T11:00:00Z'),
        endTime: new Date('2024-01-15T12:00:00Z'),
      };

      const updatedEvent = {
        ...testEvents.meeting,
        ...updateDTO,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.update(eventId, updateDTO);

      expect(result.startTime).toEqual(updateDTO.startTime);
      expect(result.endTime).toEqual(updateDTO.endTime);
    });

    it('should update recurring event rrule', async () => {
      const eventId = testEvents.recurring.id;
      const updateDTO = {
        rrule: 'FREQ=DAILY;COUNT=10',
      };

      const updatedEvent = {
        ...testEvents.recurring,
        ...updateDTO,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.update(eventId, updateDTO);

      expect(result.rrule).toBe(updateDTO.rrule);
    });

    it('should not update events belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        eventService.update('other-user-event', { title: 'Hacked' })
      ).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });

    it('should validate updated times (start before end)', async () => {
      const eventId = testEvents.meeting.id;
      const invalidUpdate = {
        startTime: new Date('2024-01-20T15:00:00Z'),
        endTime: new Date('2024-01-20T14:00:00Z'),
      };

      await expect(
        eventService.update(eventId, invalidUpdate as any)
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete an event', async () => {
      const eventId = testEvents.allDay.id;

      // Mock finding the event
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testEvents.allDay],
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

      await eventService.delete(eventId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events WHERE id = $1 AND user_id = $2'),
        [eventId, mockUserId]
      );
    });

    it('should delete recurring event and all instances', async () => {
      const recurringEventId = testEvents.recurring.id;

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testEvents.recurring],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      await eventService.delete(recurringEventId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events'),
        expect.arrayContaining([recurringEventId, mockUserId])
      );
    });

    it('should not delete events belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(eventService.delete('other-user-event')).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicting events in the same time slot', async () => {
      const newEvent = {
        calendarId: testCalendars.primary.id,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      };

      // Mock existing conflicting event
      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        newEvent.startTime,
        newEvent.endTime,
        newEvent.calendarId
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        id: testEvents.meeting.id,
        title: testEvents.meeting.title,
      });
    });

    it('should not detect conflicts in different calendars when calendar-specific', async () => {
      const newEvent = {
        calendarId: testCalendars.personal.id,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        newEvent.startTime,
        newEvent.endTime,
        newEvent.calendarId
      );

      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts across all user calendars when no calendar specified', async () => {
      const newEvent = {
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting, testEvents.allDay],
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        newEvent.startTime,
        newEvent.endTime
      );

      expect(conflicts).toHaveLength(2);
    });

    it('should not detect conflicts for adjacent time slots (no overlap)', async () => {
      const newEvent = {
        startTime: new Date('2024-01-15T11:00:00Z'), // Starts when meeting ends
        endTime: new Date('2024-01-15T12:00:00Z'),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        newEvent.startTime,
        newEvent.endTime,
        testCalendars.primary.id
      );

      expect(conflicts).toHaveLength(0);
    });

    it('should detect partial overlap conflicts', async () => {
      const newEvent = {
        startTime: new Date('2024-01-15T10:30:00Z'), // Overlaps last 30 min
        endTime: new Date('2024-01-15T11:30:00Z'),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        newEvent.startTime,
        newEvent.endTime,
        testCalendars.primary.id
      );

      expect(conflicts).toHaveLength(1);
    });

    it('should exclude current event when checking conflicts during update', async () => {
      const eventId = testEvents.meeting.id;
      const updatedTimes = {
        startTime: new Date('2024-01-15T10:15:00Z'),
        endTime: new Date('2024-01-15T11:15:00Z'),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const conflicts = await eventService.findConflicts(
        updatedTimes.startTime,
        updatedTimes.endTime,
        testCalendars.primary.id,
        eventId // Exclude self
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('id != $'),
        expect.arrayContaining([eventId])
      );
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Recurring Events', () => {
    it('should parse and validate rrule format', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Daily Reminder',
        startTime: new Date('2024-01-15T08:00:00Z'),
        endTime: new Date('2024-01-15T08:15:00Z'),
        rrule: 'FREQ=DAILY;COUNT=30',
      };

      const createdEvent = {
        id: 'event-daily',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(result.rrule).toContain('FREQ=DAILY');
      expect(result.rrule).toContain('COUNT=30');
    });

    it('should handle complex rrule patterns', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Complex Recurring Event',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        rrule: 'FREQ=MONTHLY;BYMONTHDAY=1,15;UNTIL=20241231T235959Z',
      };

      const createdEvent = {
        id: 'event-complex',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(result.rrule).toBe(createDTO.rrule);
    });

    it('should update rrule without affecting other event properties', async () => {
      const eventId = testEvents.recurring.id;
      const updateDTO = {
        rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      };

      const updatedEvent = {
        ...testEvents.recurring,
        rrule: updateDTO.rrule,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.update(eventId, updateDTO);

      expect(result.rrule).toBe(updateDTO.rrule);
      expect(result.title).toBe(testEvents.recurring.title);
    });

    it('should allow removing rrule to convert recurring event to one-time', async () => {
      const eventId = testEvents.recurring.id;
      const updateDTO = {
        rrule: null,
      };

      const updatedEvent = {
        ...testEvents.recurring,
        rrule: null,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.update(eventId, updateDTO);

      expect(result.rrule).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection timeout'));

      await expect(eventService.findAll()).rejects.toThrow('Connection timeout');
    });

    it('should handle events with very long descriptions', async () => {
      const longDescription = 'a'.repeat(10000);
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Event with long description',
        description: longDescription,
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
      };

      const createdEvent = {
        id: 'event-long',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdEvent],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.create(createDTO);

      expect(result.description).toHaveLength(10000);
    });

    it('should handle timezone edge cases in date ranges', async () => {
      const { start, end } = dateRanges.thisMonth;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [testEvents.meeting],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await eventService.findAll({ startDate: start, endDate: end });

      expect(result).toBeDefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId, start, end])
      );
    });

    it('should handle concurrent event creation', async () => {
      const event1 = {
        calendarId: testCalendars.primary.id,
        title: 'Event 1',
        startTime: new Date('2024-01-20T10:00:00Z'),
        endTime: new Date('2024-01-20T11:00:00Z'),
      };

      const event2 = {
        calendarId: testCalendars.primary.id,
        title: 'Event 2',
        startTime: new Date('2024-01-20T14:00:00Z'),
        endTime: new Date('2024-01-20T15:00:00Z'),
      };

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'event-1', userId: mockUserId, ...event1 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'event-2', userId: mockUserId, ...event2 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const results = await Promise.all([
        eventService.create(event1 as any),
        eventService.create(event2 as any),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Event 1');
      expect(results[1].title).toBe('Event 2');
    });
  });
});
