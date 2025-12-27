/**
 * Comprehensive test suite for EventService
 * Tests CRUD operations, recurring events (recurrence), conflict detection, and date filtering
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventService } from '../EventService';
import { query as mockQuery } from '../../config/database.js';
import { testUsers, testEvents, testCalendars, dateRanges } from '../../__tests__/helpers/fixtures';
import { createQueryResult } from './helpers/mockDatabase';

// Mock the database module
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  return {
    query,
    pool: { query },
  };
});

const mockedQuery = vi.mocked(mockQuery);

const normalizeRecurrence = (rrule?: string | null) => {
  if (!rrule) return null;
  return rrule.startsWith('RRULE:') ? rrule : `RRULE:${rrule}`;
};

const mapEvent = (event: typeof testEvents.meeting, overrides: Record<string, unknown> = {}) => ({
  id: event.id,
  calendarId: event.calendarId,
  userId: event.userId,
  title: event.title,
  description: event.description ?? null,
  start: event.startTime,
  end: event.endTime,
  allDay: event.isAllDay ?? false,
  location: event.location ?? null,
  notes: null,
  recurrence: normalizeRecurrence((event as any).rrule),
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
  ...overrides,
});

const eventFixtures = {
  meeting: mapEvent(testEvents.meeting),
  allDay: mapEvent(testEvents.allDay),
  recurring: mapEvent(testEvents.recurring),
};

const calendarRows = [
  {
    id: testCalendars.primary.id,
    name: testCalendars.primary.name,
    color: testCalendars.primary.color,
    isVisible: testCalendars.primary.isVisible,
  },
  {
    id: testCalendars.personal.id,
    name: testCalendars.personal.name,
    color: testCalendars.personal.color,
    isVisible: testCalendars.personal.isVisible,
  },
  {
    id: testCalendars.hidden.id,
    name: testCalendars.hidden.name,
    color: testCalendars.hidden.color,
    isVisible: testCalendars.hidden.isVisible,
  },
];

const calendarsForEvents = (events: Array<{ calendarId: string }>) =>
  calendarRows.filter((calendar) => events.some((event) => event.calendarId === calendar.id));

describe('EventService', () => {
  let eventService: EventService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    eventService = new EventService({ enableLogging: false });
    vi.clearAllMocks();
    mockedQuery.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all events for the authenticated user', async () => {
      const events = [eventFixtures.meeting, eventFixtures.allDay];
      const calendars = calendarsForEvents(events);

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('from events')) {
          return createQueryResult(events);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendars);
        }
        return createQueryResult([]);
      });

      const result = await eventService.findAll({}, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM events'),
        expect.arrayContaining([mockUserId]),
        expect.anything()
      );
      expect(result).toHaveLength(2);
    });

    it('should filter events by calendar ID', async () => {
      const calendarId = testCalendars.primary.id;
      const events = [eventFixtures.meeting];
      const calendars = calendarsForEvents(events);

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('from events')) {
          return createQueryResult(events);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendars);
        }
        return createQueryResult([]);
      });

      const result = await eventService.findAll({ calendarId }, mockContext);

      const eventCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM events')
      );
      expect(eventCall).toBeTruthy();
      expect(eventCall?.[0]).toContain('"calendarId" = $2');
      expect(eventCall?.[1]).toEqual([mockUserId, calendarId]);
      expect(result).toHaveLength(1);
    });

    it('should filter events by date range', async () => {
      const { start, end } = dateRanges.thisWeek;
      const events = [eventFixtures.meeting];
      const calendars = calendarsForEvents(events);

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('from events')) {
          return createQueryResult(events);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendars);
        }
        return createQueryResult([]);
      });

      const result = await eventService.findAll({ start, end }, mockContext);

      const eventCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM events')
      );
      expect(eventCall).toBeTruthy();
      expect(eventCall?.[0]).toContain('"end" >= $2');
      expect(eventCall?.[0]).toContain('start <= $3');
      expect(eventCall?.[1]).toEqual([mockUserId, start, end]);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when user has no events', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await eventService.findAll({}, mockContext);

      expect(result).toEqual([]);
    });
  });

  describe('findUpcoming', () => {
    it('should return upcoming events from visible calendars', async () => {
      const events = [eventFixtures.meeting];
      const calendars = calendarsForEvents(events);

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('from events e')) {
          return createQueryResult(events);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendars);
        }
        return createQueryResult([]);
      });

      const result = await eventService.findUpcoming(10, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('c."isVisible" = true'),
        expect.anything(),
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should fetch a specific event by ID', async () => {
      const mockEvent = eventFixtures.meeting;
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockEvent]));

      const result = await eventService.findById(mockEvent.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM events WHERE id = $1'),
        [mockEvent.id],
        expect.anything()
      );
      expect(result).toEqual(mockEvent);
    });

    it('should return null when event not found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await eventService.findById('non-existent-id', mockContext);

      expect(result).toBeNull();
    });

    it('should query by id regardless of context', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await eventService.findById('other-user-event-id', mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM events WHERE id = $1'),
        ['other-user-event-id'],
        expect.anything()
      );
    });
  });

  describe('create', () => {
    it('should create a new one-time event', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'New Meeting',
        description: 'Quarterly review',
        start: new Date('2024-01-20T14:00:00Z'),
        end: new Date('2024-01-20T15:00:00Z'),
        allDay: false,
        location: 'Office',
      };

      const createdEvent = {
        id: 'event-new',
        userId: mockUserId,
        ...createDTO,
        notes: null,
        recurrence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([createDTO.title, mockUserId, createDTO.calendarId]),
        expect.anything()
      );
      expect(result).toEqual(createdEvent);
      expect(result.userId).toBe(mockUserId);
    });

    it('should create an all-day event', async () => {
      const createDTO = {
        calendarId: testCalendars.personal.id,
        title: 'Birthday',
        start: new Date('2024-02-15T00:00:00Z'),
        end: new Date('2024-02-15T23:59:59Z'),
        allDay: true,
      };

      const createdEvent = {
        id: 'event-allday',
        userId: mockUserId,
        ...createDTO,
        description: null,
        location: null,
        notes: null,
        recurrence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(result.allDay).toBe(true);
      expect(result.title).toBe(createDTO.title);
    });

    it('should create a recurring event with recurrence rule', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Weekly Standup',
        start: new Date('2024-01-15T09:00:00Z'),
        end: new Date('2024-01-15T09:30:00Z'),
        allDay: false,
        recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      };

      const createdEvent = {
        id: 'event-recurring',
        userId: mockUserId,
        ...createDTO,
        description: null,
        location: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(result.recurrence).toBe(createDTO.recurrence);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('recurrence'),
        expect.any(Array),
        expect.anything()
      );
    });

    it('should validate calendar belongs to user before creating event', async () => {
      const createDTO = {
        calendarId: 'other-user-calendar',
        title: 'Unauthorized Event',
        start: new Date(),
        end: new Date(Date.now() + 3600000),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(eventService.create(createDTO as any, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });

    it('should validate start time is before end time', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Invalid Event',
        start: new Date('2024-01-20T15:00:00Z'),
        end: new Date('2024-01-20T14:00:00Z'),
      };

      await expect(eventService.create(createDTO as any, mockContext)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        title: '',
        start: null,
      };

      await expect(eventService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update event properties', async () => {
      const eventId = eventFixtures.meeting.id;
      const updateDTO = {
        title: 'Updated Meeting',
        location: 'Conference Room B',
      };

      const updatedEvent = {
        ...eventFixtures.meeting,
        ...updateDTO,
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid" from events')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select start') && lower.includes('"end"') && lower.includes('"allday"')) {
          return createQueryResult([
            {
              start: eventFixtures.meeting.start,
              end: eventFixtures.meeting.end,
              allDay: eventFixtures.meeting.allDay,
            },
          ]);
        }
        if (lower.startsWith('update events set')) {
          return createQueryResult([updatedEvent], 1);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendarsForEvents([updatedEvent]));
        }
        return createQueryResult([]);
      });

      const result = await eventService.update(eventId, updateDTO, mockContext);

      expect(result?.title).toBe(updateDTO.title);
      expect(result?.location).toBe(updateDTO.location);
    });

    it('should update event times', async () => {
      const eventId = eventFixtures.meeting.id;
      const updateDTO = {
        start: new Date('2024-01-15T11:00:00Z'),
        end: new Date('2024-01-15T12:00:00Z'),
      };

      const updatedEvent = {
        ...eventFixtures.meeting,
        ...updateDTO,
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid" from events')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select start') && lower.includes('"end"') && lower.includes('"allday"')) {
          return createQueryResult([
            {
              start: eventFixtures.meeting.start,
              end: eventFixtures.meeting.end,
              allDay: eventFixtures.meeting.allDay,
            },
          ]);
        }
        if (lower.startsWith('update events set')) {
          return createQueryResult([updatedEvent], 1);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendarsForEvents([updatedEvent]));
        }
        return createQueryResult([]);
      });

      const result = await eventService.update(eventId, updateDTO, mockContext);

      expect(result?.start).toEqual(updateDTO.start);
      expect(result?.end).toEqual(updateDTO.end);
    });

    it('should update recurring event recurrence', async () => {
      const eventId = eventFixtures.recurring.id;
      const updateDTO = {
        recurrence: 'RRULE:FREQ=DAILY;COUNT=10',
      };

      const updatedEvent = {
        ...eventFixtures.recurring,
        ...updateDTO,
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid" from events')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select start') && lower.includes('"end"') && lower.includes('"allday"')) {
          return createQueryResult([
            {
              start: eventFixtures.recurring.start,
              end: eventFixtures.recurring.end,
              allDay: eventFixtures.recurring.allDay,
            },
          ]);
        }
        if (lower.startsWith('update events set')) {
          return createQueryResult([updatedEvent], 1);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendarsForEvents([updatedEvent]));
        }
        return createQueryResult([]);
      });

      const result = await eventService.update(eventId, updateDTO, mockContext);

      expect(result?.recurrence).toBe(updateDTO.recurrence);
    });

    it('should not update events belonging to other users', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ userId: 'other-user' }]));

      await expect(
        eventService.update('other-user-event', { title: 'Hacked' }, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });

    it('should validate updated times (start before end)', async () => {
      const eventId = eventFixtures.meeting.id;
      const invalidUpdate = {
        start: new Date('2024-01-20T15:00:00Z'),
        end: new Date('2024-01-20T14:00:00Z'),
      };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ userId: mockUserId }]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              start: eventFixtures.meeting.start,
              end: eventFixtures.meeting.end,
              allDay: eventFixtures.meeting.allDay,
            },
          ])
        );

      await expect(eventService.update(eventId, invalidUpdate as any, mockContext)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete an event', async () => {
      const eventId = eventFixtures.allDay.id;

      mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));

      const result = await eventService.delete(eventId, mockContext);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events WHERE id = $1'),
        [eventId],
        expect.anything()
      );
    });

    it('should delete recurring event and all instances', async () => {
      const recurringEventId = eventFixtures.recurring.id;

      mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));

      const result = await eventService.delete(recurringEventId, mockContext);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events WHERE id = $1'),
        [recurringEventId],
        expect.anything()
      );
    });

    it('should delete by id regardless of user context', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));

      await eventService.delete('other-user-event', mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events WHERE id = $1'),
        ['other-user-event'],
        expect.anything()
      );
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicting events in the same time slot', async () => {
      const newEvent = {
        calendarId: testCalendars.primary.id,
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([eventFixtures.meeting]));

      const conflicts = await eventService.getConflicts(newEvent, undefined, mockContext);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingEvent).toMatchObject({
        id: eventFixtures.meeting.id,
        title: eventFixtures.meeting.title,
      });
    });

    it('should not detect conflicts in different calendars when calendar-specific', async () => {
      const newEvent = {
        calendarId: testCalendars.personal.id,
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const conflicts = await eventService.getConflicts(newEvent, undefined, mockContext);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts across all user calendars when no calendar specified', async () => {
      const newEvent = {
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([eventFixtures.meeting, eventFixtures.allDay]));

      const conflicts = await eventService.getConflicts(newEvent, undefined, mockContext);

      expect(conflicts).toHaveLength(2);
    });

    it('should not detect conflicts for adjacent time slots (no overlap)', async () => {
      const newEvent = {
        calendarId: testCalendars.primary.id,
        start: new Date('2024-01-15T11:00:00Z'),
        end: new Date('2024-01-15T12:00:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const conflicts = await eventService.getConflicts(newEvent, undefined, mockContext);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect partial overlap conflicts', async () => {
      const newEvent = {
        calendarId: testCalendars.primary.id,
        start: new Date('2024-01-15T10:30:00Z'),
        end: new Date('2024-01-15T11:30:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([eventFixtures.meeting]));

      const conflicts = await eventService.getConflicts(newEvent, undefined, mockContext);

      expect(conflicts).toHaveLength(1);
    });

    it('should exclude current event when checking conflicts during update', async () => {
      const eventId = eventFixtures.meeting.id;
      const updatedTimes = {
        calendarId: testCalendars.primary.id,
        start: new Date('2024-01-15T10:15:00Z'),
        end: new Date('2024-01-15T11:15:00Z'),
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await eventService.getConflicts(updatedTimes, eventId, mockContext);

      const eventCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM events e')
      );
      expect(eventCall).toBeTruthy();
      expect(eventCall?.[0]).toContain('e.id <> $');
      expect(eventCall?.[1]).toContain(eventId);
    });
  });

  describe('Recurring Events', () => {
    it('should parse and validate recurrence format', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Daily Reminder',
        start: new Date('2024-01-15T08:00:00Z'),
        end: new Date('2024-01-15T08:15:00Z'),
        recurrence: 'RRULE:FREQ=DAILY;COUNT=30',
      };

      const createdEvent = {
        id: 'event-daily',
        userId: mockUserId,
        ...createDTO,
        description: null,
        location: null,
        notes: null,
        allDay: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(result.recurrence).toContain('FREQ=DAILY');
      expect(result.recurrence).toContain('COUNT=30');
    });

    it('should handle complex recurrence patterns', async () => {
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Complex Recurring Event',
        start: new Date('2024-01-15T10:00:00Z'),
        end: new Date('2024-01-15T11:00:00Z'),
        recurrence: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15;UNTIL=20241231T235959Z',
      };

      const createdEvent = {
        id: 'event-complex',
        userId: mockUserId,
        ...createDTO,
        description: null,
        location: null,
        notes: null,
        allDay: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(result.recurrence).toBe(createDTO.recurrence);
    });

    it('should update recurrence without affecting other event properties', async () => {
      const eventId = eventFixtures.recurring.id;
      const updateDTO = {
        recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
      };

      const updatedEvent = {
        ...eventFixtures.recurring,
        recurrence: updateDTO.recurrence,
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid" from events')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select start') && lower.includes('"end"') && lower.includes('"allday"')) {
          return createQueryResult([
            {
              start: eventFixtures.recurring.start,
              end: eventFixtures.recurring.end,
              allDay: eventFixtures.recurring.allDay,
            },
          ]);
        }
        if (lower.startsWith('update events set')) {
          return createQueryResult([updatedEvent], 1);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendarsForEvents([updatedEvent]));
        }
        return createQueryResult([]);
      });

      const result = await eventService.update(eventId, updateDTO, mockContext);

      expect(result?.recurrence).toBe(updateDTO.recurrence);
      expect(result?.title).toBe(eventFixtures.recurring.title);
    });

    it('should allow removing recurrence to convert recurring event to one-time', async () => {
      const eventId = eventFixtures.recurring.id;
      const updateDTO = {
        recurrence: null,
      };

      const updatedEvent = {
        ...eventFixtures.recurring,
        recurrence: null,
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select "userid" from events')) {
          return createQueryResult([{ userId: mockUserId }]);
        }
        if (lower.includes('select start') && lower.includes('"end"') && lower.includes('"allday"')) {
          return createQueryResult([
            {
              start: eventFixtures.recurring.start,
              end: eventFixtures.recurring.end,
              allDay: eventFixtures.recurring.allDay,
            },
          ]);
        }
        if (lower.startsWith('update events set')) {
          return createQueryResult([updatedEvent], 1);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendarsForEvents([updatedEvent]));
        }
        return createQueryResult([]);
      });

      const result = await eventService.update(eventId, updateDTO, mockContext);

      expect(result?.recurrence).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(eventService.findAll({}, mockContext)).rejects.toThrow('Connection timeout');
    });

    it('should handle events with very long descriptions', async () => {
      const longDescription = 'a'.repeat(10000);
      const createDTO = {
        calendarId: testCalendars.primary.id,
        title: 'Event with long description',
        description: longDescription,
        start: new Date(),
        end: new Date(Date.now() + 3600000),
      };

      const createdEvent = {
        id: 'event-long',
        userId: mockUserId,
        ...createDTO,
        allDay: false,
        location: null,
        notes: null,
        recurrence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: createDTO.calendarId }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          return createQueryResult([createdEvent], 1);
        }
        return createQueryResult([]);
      });

      const result = await eventService.create(createDTO, mockContext);

      expect(result.description).toHaveLength(10000);
    });

    it('should handle timezone edge cases in date ranges', async () => {
      const { start, end } = dateRanges.thisMonth;
      const events = [eventFixtures.meeting];
      const calendars = calendarsForEvents(events);

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('from events')) {
          return createQueryResult(events);
        }
        if (lower.includes('from calendars')) {
          return createQueryResult(calendars);
        }
        return createQueryResult([]);
      });

      const result = await eventService.findAll({ start, end }, mockContext);

      expect(result).toBeDefined();
      const eventCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM events')
      );
      expect(eventCall?.[1]).toEqual([mockUserId, start, end]);
    });

    it('should handle concurrent event creation', async () => {
      const event1 = {
        calendarId: testCalendars.primary.id,
        title: 'Event 1',
        start: new Date('2024-01-20T10:00:00Z'),
        end: new Date('2024-01-20T11:00:00Z'),
      };

      const event2 = {
        calendarId: testCalendars.primary.id,
        title: 'Event 2',
        start: new Date('2024-01-20T14:00:00Z'),
        end: new Date('2024-01-20T15:00:00Z'),
      };

      let insertCount = 0;
      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from calendars')) {
          return createQueryResult([{ id: testCalendars.primary.id }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('insert into events')) {
          insertCount += 1;
          const payload = insertCount === 1
            ? { id: 'event-1', userId: mockUserId, ...event1 }
            : { id: 'event-2', userId: mockUserId, ...event2 };
          return createQueryResult([{
            ...payload,
            description: null,
            location: null,
            notes: null,
            recurrence: null,
            allDay: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }], 1);
        }
        return createQueryResult([]);
      });

      const results = await Promise.all([
        eventService.create(event1 as any, mockContext),
        eventService.create(event2 as any, mockContext),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Event 1');
      expect(results[1].title).toBe('Event 2');
    });
  });
});
