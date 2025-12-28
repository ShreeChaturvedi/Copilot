/**
 * Event Service - Concrete implementation of BaseService for Event operations
 */
import {
  BaseService,
  type ServiceContext,
  type UserOwnedEntity,
} from './BaseService.js';
import { query } from '../config/database.js';

/**
 * Event entity interface extending base
 */
export interface EventEntity extends UserOwnedEntity {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  recurrence: string | null;
  calendarId: string;
  createdAt: Date;
  updatedAt: Date;

  // Relations (optional for different query contexts)
  calendar?: {
    id: string;
    name: string;
    color: string;
    isVisible: boolean;
  };
}

/**
 * Event creation DTO
 */
export interface CreateEventDTO {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  notes?: string;
  calendarId: string;
  allDay?: boolean;
  recurrence?: string;
}

/**
 * Event update DTO
 */
export interface UpdateEventDTO {
  title?: string;
  start?: Date;
  end?: Date;
  description?: string;
  location?: string;
  notes?: string;
  calendarId?: string;
  allDay?: boolean;
  recurrence?: string;
}

/**
 * Event filters interface
 */
export interface EventFilters {
  calendarId?: string;
  start?: Date;
  end?: Date;
  search?: string;
  allDay?: boolean;
  hasRecurrence?: boolean;
  calendarIds?: string[];
}

/**
 * Event conflict interface
 */
export interface EventConflict {
  conflictingEvent: EventEntity;
  overlapStart: Date;
  overlapEnd: Date;
  overlapDuration: number; // in minutes
}

/**
 * EventService - Handles all event-related operations
 */
export class EventService extends BaseService<
  EventEntity,
  CreateEventDTO,
  UpdateEventDTO,
  EventFilters
> {
  protected getTableName(): string {
    return 'events';
  }

  protected getEntityName(): string {
    return 'Event';
  }

  /**
   * Override create to satisfy required relations (user, calendar)
   */
  async create(
    data: CreateEventDTO,
    context?: ServiceContext
  ): Promise<EventEntity> {
    try {
      this.log('create', { data }, context);
      await this.validateCreate(data, context);
      await this.ensureUserExists(context?.userId, 'dev@example.com');

      const inserted = await query(
        `INSERT INTO events (id, title, description, start, "end", "allDay", location, notes, recurrence, "userId", "calendarId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [
          data.title.trim(),
          data.description?.trim() || null,
          data.start,
          data.end,
          data.allDay ?? false,
          data.location?.trim() || null,
          data.notes?.trim() || null,
          data.recurrence || null,
          context!.userId!,
          data.calendarId,
        ],
        this.db
      );

      const row = inserted.rows[0];
      this.log('create:success', { id: row.id }, context);
      return this.transformEntity(row);
    } catch (error) {
      this.log(
        'create:error',
        { error: (error as Error).message, data },
        context
      );
      throw error;
    }
  }

  protected buildWhereClause(
    filters: EventFilters,
    context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (context?.userId) {
      params.push(context.userId);
      clauses.push('"userId" = $' + params.length);
    }
    if (filters.calendarId) {
      params.push(filters.calendarId);
      clauses.push('"calendarId" = $' + params.length);
    }
    if (filters.calendarIds && filters.calendarIds.length > 0) {
      const placeholders = filters.calendarIds
        .map((_, i) => '$' + (params.length + i + 1))
        .join(',');
      params.push(...filters.calendarIds);
      clauses.push('"calendarId" IN (' + placeholders + ')');
    }
    if (filters.start) {
      params.push(filters.start);
      clauses.push('"end" >= $' + params.length);
    }
    if (filters.end) {
      params.push(filters.end);
      clauses.push('start <= $' + params.length);
    }
    if (filters.search) {
      params.push('%' + filters.search + '%');
      const idx = params.length;
      clauses.push(
        `(title ILIKE $${idx} OR description ILIKE $${idx} OR location ILIKE $${idx} OR notes ILIKE $${idx})`
      );
    }
    if (filters.allDay !== undefined) {
      params.push(filters.allDay);
      clauses.push('"allDay" = $' + params.length);
    }
    if (filters.hasRecurrence !== undefined) {
      clauses.push(
        filters.hasRecurrence ? 'recurrence IS NOT NULL' : 'recurrence IS NULL'
      );
    }
    const sql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  async findAll(
    filters: EventFilters = {},
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    try {
      this.log('findAll', { filters }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const order = 'ORDER BY start ASC, "createdAt" DESC';
      const res = await query<EventEntity>(
        `SELECT * FROM events ${sql} ${order}`,
        params,
        this.db
      );
      const base = res.rows.map((row) => this.transformEntity(row));
      return await this.enrichEntities(base, context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findAll:error', { error: message, filters }, context);
      throw error;
    }
  }

  protected async enrichEntities(
    entities: EventEntity[],
    _context?: ServiceContext
  ): Promise<EventEntity[]> {
    if (!entities.length) return entities;
    const calendarIds = Array.from(new Set(entities.map((e) => e.calendarId)));
    const placeholders = calendarIds.map((_, i) => `$${i + 1}`).join(',');
    type CalendarSummary = {
      id: string;
      name: string;
      color: string;
      isVisible: boolean;
    };
    const calendars = await query<CalendarSummary>(
      `SELECT id, name, color, "isVisible" FROM calendars WHERE id IN (${placeholders})`,
      calendarIds,
      this.db
    );
    const calMap = new Map<string, CalendarSummary>();
    calendars.rows.forEach((calendar) => calMap.set(calendar.id, calendar));
    return entities.map((e) => ({ ...e, calendar: calMap.get(e.calendarId) }));
  }

  /**
   * Validate event creation
   */
  protected async validateCreate(
    data: CreateEventDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (!data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Event title is required');
    }

    if (!data.start || !data.end) {
      throw new Error(
        'VALIDATION_ERROR: Event start and end dates are required'
      );
    }

    // Validate start is before end (unless it's all-day)
    if (!data.allDay && data.start >= data.end) {
      throw new Error('VALIDATION_ERROR: Event start must be before end time');
    }

    // Validate calendar exists and user owns it
    if (context?.userId) {
      const calendar = await query(
        'SELECT id FROM calendars WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [data.calendarId, context.userId],
        this.db
      );
      if (calendar.rowCount === 0) {
        throw new Error(
          'VALIDATION_ERROR: Calendar not found or access denied'
        );
      }
    }

    // Validate recurrence format if provided (basic validation)
    if (data.recurrence && !this.isValidRRule(data.recurrence)) {
      throw new Error('VALIDATION_ERROR: Invalid recurrence rule format');
    }
  }

  /**
   * Validate event updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateEventDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (data.title !== undefined && !data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Event title cannot be empty');
    }

    if (context?.userId) {
      const hasAccess = await this.checkOwnership(id, context.userId);
      if (!hasAccess) {
        throw new Error('AUTHORIZATION_ERROR: Access denied');
      }
    }

    // Get current event data for validation
    const currentRes = await query(
      'SELECT start, "end", "allDay" FROM events WHERE id = $1',
      [id],
      this.db
    );
    const currentEvent = currentRes.rows[0];

    if (!currentEvent) {
      throw new Error('NOT_FOUND: Event not found');
    }

    // Validate start/end relationship
    const start =
      (typeof data.start === 'string' ? new Date(data.start) : data.start) ??
      currentEvent.start;
    const end =
      (typeof data.end === 'string' ? new Date(data.end) : data.end) ??
      currentEvent.end;
    const allDay = data.allDay ?? currentEvent.allDay;

    if (!allDay && start >= end) {
      throw new Error('VALIDATION_ERROR: Event start must be before end time');
    }

    // Validate calendar if being updated
    if (data.calendarId && context?.userId) {
      const calendar = await query(
        'SELECT id FROM calendars WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [data.calendarId, context.userId],
        this.db
      );
      if (calendar.rowCount === 0) {
        throw new Error(
          'VALIDATION_ERROR: Calendar not found or access denied'
        );
      }
    }

    // Validate recurrence format if provided
    if (data.recurrence && !this.isValidRRule(data.recurrence)) {
      throw new Error('VALIDATION_ERROR: Invalid recurrence rule format');
    }
  }

  /**
   * Update event by ID
   */
  async update(
    id: string,
    data: UpdateEventDTO,
    context?: ServiceContext
  ): Promise<EventEntity | null> {
    await this.validateUpdate(id, data, context);

    const sets: string[] = [];
    const params: Array<string | boolean | null | Date> = [];

    if (data.title !== undefined) {
      params.push(data.title.trim());
      sets.push(`title = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description?.trim() || null);
      sets.push(`description = $${params.length}`);
    }
    if (data.start !== undefined) {
      const d =
        typeof data.start === 'string' ? new Date(data.start) : data.start;
      params.push(d);
      sets.push(`start = $${params.length}`);
    }
    if (data.end !== undefined) {
      const d = typeof data.end === 'string' ? new Date(data.end) : data.end;
      params.push(d);
      sets.push(`"end" = $${params.length}`);
    }
    if (data.allDay !== undefined) {
      params.push(!!data.allDay);
      sets.push(`"allDay" = $${params.length}`);
    }
    if (data.location !== undefined) {
      params.push(data.location?.trim() || null);
      sets.push(`location = $${params.length}`);
    }
    if (data.notes !== undefined) {
      params.push(data.notes?.trim() || null);
      sets.push(`notes = $${params.length}`);
    }
    if (data.recurrence !== undefined) {
      params.push(data.recurrence || null);
      sets.push(`recurrence = $${params.length}`);
    }
    if (data.calendarId !== undefined) {
      params.push(data.calendarId);
      sets.push(`"calendarId" = $${params.length}`);
    }

    params.push(new Date());
    sets.push(`"updatedAt" = $${params.length}`);
    params.push(id);

    const sql = `UPDATE events SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const res = await query(sql, params, this.db);
    if (res.rowCount === 0) return null;
    const base = this.transformEntity(res.rows[0]);
    const [enriched] = await this.enrichEntities([base], context);
    return enriched;
  }

  /**
   * Find events by date range
   */
  async findByDateRange(
    start: Date,
    end: Date,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    const filters: EventFilters = { start, end };
    return await this.findAll(filters, context);
  }

  /**
   * Find events by calendar
   */
  async findByCalendar(
    calendarId: string,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    const filters: EventFilters = { calendarId };
    return await this.findAll(filters, context);
  }

  /**
   * Find upcoming events
   */
  async findUpcoming(
    limit: number = 10,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('findUpcoming', { limit }, context);

      const now = new Date();
      const res = await query<EventEntity>(
        `SELECT e.*
         FROM events e
         JOIN calendars c ON c.id = e."calendarId"
         WHERE e."userId" = $1 AND e.start >= $2 AND c."isVisible" = true
         ORDER BY e.start ASC
         LIMIT $3`,
        [context.userId!, now, limit],
        this.db
      );
      const base = res.rows.map((row) => this.transformEntity(row));
      const enriched = await this.enrichEntities(base, context);
      this.log('findUpcoming:success', { count: enriched.length }, context);
      return enriched;
    } catch (error) {
      this.log('findUpcoming:error', { error: error.message, limit }, context);
      throw error;
    }
  }

  /**
   * Search events by query
   */
  async search(
    query: string,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    const filters: EventFilters = { search: query };
    return await this.findAll(filters, context);
  }

  /**
   * Get event conflicts for a new or updated event
   */
  async getConflicts(
    eventData: CreateEventDTO | UpdateEventDTO,
    excludeId?: string,
    context?: ServiceContext
  ): Promise<EventConflict[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    if (!eventData.start || !eventData.end) {
      return []; // No conflicts if no time specified
    }

    try {
      this.log('getConflicts', { eventData, excludeId }, context);

      const params: Array<string | Date> = [
        context.userId!,
        eventData.end!,
        eventData.start!,
      ];
      const and: string[] = ['e."userId" = $1', 'e.start < $2', 'e."end" > $3'];
      if (excludeId) {
        params.push(excludeId);
        and.push('e.id <> $' + params.length);
      }
      if (eventData.calendarId) {
        params.push(eventData.calendarId);
        and.push('e."calendarId" = $' + params.length);
      }
      const sql = `SELECT e.* FROM events e WHERE ${and.join(' AND ')}`;
      const res = await query<EventEntity>(sql, params, this.db);
      const conflictingEvents = res.rows;

      const conflicts: EventConflict[] = conflictingEvents.map(
        (conflictEvent) => {
          const overlapStart = new Date(
            Math.max(eventData.start!.getTime(), conflictEvent.start.getTime())
          );
          const overlapEnd = new Date(
            Math.min(eventData.end!.getTime(), conflictEvent.end.getTime())
          );
          const overlapDuration = Math.round(
            (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
          );

          return {
            conflictingEvent: this.transformEntity(conflictEvent),
            overlapStart,
            overlapEnd,
            overlapDuration,
          };
        }
      );

      this.log(
        'getConflicts:success',
        { conflictCount: conflicts.length },
        context
      );
      return conflicts;
    } catch (error) {
      this.log(
        'getConflicts:error',
        { error: error.message, eventData },
        context
      );
      throw error;
    }
  }

  /**
   * Get events for a specific month (optimized for calendar view)
   */
  async findByMonth(
    year: number,
    month: number,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    return await this.findByDateRange(startOfMonth, endOfMonth, context);
  }

  /**
   * Get events for today
   */
  async findToday(context?: ServiceContext): Promise<EventEntity[]> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    return await this.findByDateRange(startOfDay, endOfDay, context);
  }

  /**
   * Get events for this week
   */
  async findThisWeek(context?: ServiceContext): Promise<EventEntity[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return await this.findByDateRange(startOfWeek, endOfWeek, context);
  }

  /**
   * Create recurring events (basic implementation)
   */
  async createRecurring(
    data: CreateEventDTO,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    if (!data.recurrence) {
      // If no recurrence, create single event
      const event = await this.create(data, context);
      return [event];
    }

    // For now, create just the master event
    // In a full implementation, you'd parse the RRULE and create instances
    const masterEvent = await this.create(data, context);

    // TODO: Implement full recurring event logic with RRULE parsing
    // This would involve:
    // 1. Parsing the RRULE string
    // 2. Generating occurrence dates
    // 3. Creating individual event instances or using a virtual approach

    return [masterEvent];
  }

  /**
   * Move event to different calendar
   */
  async moveToCalendar(
    eventId: string,
    newCalendarId: string,
    context?: ServiceContext
  ): Promise<EventEntity> {
    return await this.update(eventId, { calendarId: newCalendarId }, context);
  }

  /**
   * Duplicate event
   */
  async duplicate(id: string, context?: ServiceContext): Promise<EventEntity> {
    const originalEvent = await this.findById(id, context);
    if (!originalEvent) {
      throw new Error('NOT_FOUND: Event not found');
    }

    // Create duplicate with modified title
    const duplicateData: CreateEventDTO = {
      title: `Copy of ${originalEvent.title}`,
      start: originalEvent.start,
      end: originalEvent.end,
      description: originalEvent.description,
      location: originalEvent.location,
      notes: originalEvent.notes,
      calendarId: originalEvent.calendarId,
      allDay: originalEvent.allDay,
      recurrence: originalEvent.recurrence,
    };

    return await this.create(duplicateData, context);
  }

  /**
   * Basic RRULE validation
   */
  private isValidRRule(rrule: string): boolean {
    // Basic validation - check if it starts with RRULE and contains valid keywords
    if (!rrule.startsWith('RRULE:')) {
      return false;
    }

    // Check for basic RRULE components
    const validKeywords = [
      'FREQ',
      'INTERVAL',
      'COUNT',
      'UNTIL',
      'BYDAY',
      'BYMONTH',
      'BYMONTHDAY',
    ];
    const ruleBody = rrule.substring(6); // Remove 'RRULE:'

    // Split by semicolon and validate each part
    const parts = ruleBody.split(';');
    for (const part of parts) {
      const [key] = part.split('=');
      if (!validKeywords.includes(key)) {
        return false;
      }
    }

    return true;
  }
}
