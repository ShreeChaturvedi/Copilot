/**
 * Event Service - Concrete implementation of BaseService for Event operations
 */
import {
  BaseService,
  type ServiceContext,
  type UserOwnedEntity,
} from './BaseService.js';
import { query } from '../config/database.js';
// rrule ships an ESM type surface but a CJS (webpack) runtime build whose
// named exports are not statically detectable by the Node/tsx ESM loader. A
// default import resolves to module.exports (which carries rrulestr) and works
// under both tsx (local dev server) and esbuild (Vercel). Types come from the
// type-only import below.
import rrulePkg from 'rrule';
import type { RRule, RRuleSet } from 'rrule';

const { rrulestr } = rrulePkg as unknown as typeof import('rrule');

// How far ahead findUpcoming expands recurring series when surfacing the next
// occurrences of a list, in days.
const UPCOMING_EXPANSION_DAYS = 90;

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
  // Per-event color override (falls back to the calendar color in the UI).
  color: string | null;
  // ISO date strings marking deleted/edited occurrences of a recurring event.
  exceptions: string[];
  calendarId: string;
  createdAt: Date;
  updatedAt: Date;

  // Set on virtual occurrences expanded from a recurring master at read time.
  // These instances are never persisted; the master keeps the RRULE in `recurrence`.
  isRecurringInstance?: boolean;
  masterId?: string;
  occurrenceInstanceStart?: Date;
  occurrenceInstanceEnd?: Date;

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
  color?: string;
  exceptions?: string[];
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
  color?: string;
  exceptions?: string[];
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
   * Serialize a timestamp for binding as a query parameter.
   *
   * events.start/end (and createdAt/updatedAt) are `timestamp without time
   * zone` columns holding UTC wall-clock values. node-pg serializes a JS Date
   * param using the server process's local UTC offset, which shifts the value
   * on any non-UTC server and silently breaks range/overlap comparisons (#59).
   * Binding an ISO-8601 UTC string pins the value to UTC regardless of the
   * server timezone.
   */
  private toTimestampParam(value: Date | string): string {
    return (value instanceof Date ? value : new Date(value)).toISOString();
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
        `INSERT INTO events (id, title, description, start, "end", "allDay", location, notes, recurrence, color, exceptions, "userId", "calendarId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING *`,
        [
          data.title.trim(),
          data.description?.trim() || null,
          this.toTimestampParam(data.start),
          this.toTimestampParam(data.end),
          data.allDay ?? false,
          data.location?.trim() || null,
          data.notes?.trim() || null,
          data.recurrence || null,
          data.color || null,
          data.exceptions ?? [],
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
    // Date-range overlap. Recurring masters are always included regardless of
    // their own start/end so the read path can expand them into occurrences
    // that fall inside the requested window (the master's stored time may sit
    // entirely outside the range).
    const dateClauses: string[] = [];
    if (filters.start) {
      params.push(this.toTimestampParam(filters.start));
      dateClauses.push('"end" >= $' + params.length);
    }
    if (filters.end) {
      params.push(this.toTimestampParam(filters.end));
      dateClauses.push('start <= $' + params.length);
    }
    if (dateClauses.length) {
      clauses.push(
        '(recurrence IS NOT NULL OR (' + dateClauses.join(' AND ') + '))'
      );
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
      const enriched = await this.enrichEntities(base, context);
      // When a date range is requested, expand recurring masters into concrete
      // occurrences within that window. Non-recurring events pass through.
      if (filters.start && filters.end) {
        return this.expandRecurringInRange(
          enriched,
          filters.start,
          filters.end
        );
      }
      return enriched;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findAll:error', { error: message, filters }, context);
      throw error;
    }
  }

  /**
   * Expand every recurring master in `events` into the concrete occurrences
   * that fall within [rangeStart, rangeEnd]. Non-recurring events are returned
   * unchanged. Occurrences are virtual (never persisted) and tagged with
   * `isRecurringInstance`, `masterId`, and a composite id of
   * `${masterId}::${occurrenceISO}`.
   */
  private expandRecurringInRange(
    events: EventEntity[],
    rangeStart: Date,
    rangeEnd: Date
  ): EventEntity[] {
    const out: EventEntity[] = [];
    for (const event of events) {
      if (!event.recurrence) {
        out.push(event);
        continue;
      }
      const occurrences = this.generateOccurrences(event, rangeStart, rangeEnd);
      out.push(...occurrences);
    }
    return out;
  }

  /**
   * Generate the virtual occurrences of a recurring master whose start falls
   * within [windowStart, windowEnd] (inclusive), honoring the `exceptions`
   * list of excluded occurrence start ISO strings. The master itself is never
   * returned; only its occurrences are. On an unparseable RRULE we fall back to
   * returning the master so data is never silently dropped.
   */
  private generateOccurrences(
    master: EventEntity,
    windowStart: Date,
    windowEnd: Date
  ): EventEntity[] {
    const startDate = new Date(master.start);
    const endDate = new Date(master.end);
    const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());

    let rule: RRule | RRuleSet;
    try {
      rule = rrulestr(master.recurrence!, { dtstart: startDate });
    } catch {
      return [master];
    }

    let occStarts: Date[];
    try {
      occStarts = rule.between(
        new Date(windowStart),
        new Date(windowEnd),
        true
      );
    } catch {
      return [master];
    }

    const exceptionSet = new Set(master.exceptions ?? []);
    const occurrences: EventEntity[] = [];
    for (const occStart of occStarts) {
      const iso = occStart.toISOString();
      if (exceptionSet.has(iso)) continue;
      const occEnd = new Date(occStart.getTime() + durationMs);
      occurrences.push({
        ...master,
        id: `${master.id}::${iso}`,
        masterId: master.id,
        isRecurringInstance: true,
        start: occStart,
        end: occEnd,
        occurrenceInstanceStart: occStart,
        occurrenceInstanceEnd: occEnd,
      });
    }
    return occurrences;
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
    const params: Array<string | boolean | null | Date | string[]> = [];

    if (data.title !== undefined) {
      params.push(data.title.trim());
      sets.push(`title = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description?.trim() || null);
      sets.push(`description = $${params.length}`);
    }
    if (data.start !== undefined) {
      params.push(this.toTimestampParam(data.start));
      sets.push(`start = $${params.length}`);
    }
    if (data.end !== undefined) {
      params.push(this.toTimestampParam(data.end));
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
    if (data.color !== undefined) {
      params.push(data.color || null);
      sets.push(`color = $${params.length}`);
    }
    if (data.exceptions !== undefined) {
      params.push(data.exceptions ?? []);
      sets.push(`exceptions = $${params.length}`);
    }
    if (data.calendarId !== undefined) {
      params.push(data.calendarId);
      sets.push(`"calendarId" = $${params.length}`);
    }

    params.push(this.toTimestampParam(new Date()));
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
      const windowEnd = new Date(
        now.getTime() + UPCOMING_EXPANSION_DAYS * 24 * 60 * 60 * 1000
      );
      // Include recurring masters regardless of their stored start so their
      // future occurrences can be expanded below: a series whose master start
      // is in the past still recurs forward. Non-recurring events keep the
      // start >= now filter. The LIMIT is applied after expansion in JS since
      // one master can yield several upcoming occurrences.
      const res = await query<EventEntity>(
        `SELECT e.*
         FROM events e
         JOIN calendars c ON c.id = e."calendarId"
         WHERE e."userId" = $1 AND (e.recurrence IS NOT NULL OR e.start >= $2) AND c."isVisible" = true
         ORDER BY e.start ASC`,
        [context.userId!, this.toTimestampParam(now)],
        this.db
      );
      const base = res.rows.map((row) => this.transformEntity(row));
      const enriched = await this.enrichEntities(base, context);
      // Expand recurring masters into their upcoming occurrences within the
      // window; non-recurring events pass through (SQL already bounded them).
      const upcoming: EventEntity[] = [];
      for (const event of enriched) {
        if (event.recurrence) {
          const occurrences = this.generateOccurrences(
            event,
            now,
            windowEnd
          ).filter((occ) => occ.start.getTime() >= now.getTime());
          upcoming.push(...occurrences);
        } else {
          upcoming.push(event);
        }
      }
      upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());
      const limited = upcoming.slice(0, limit);
      this.log('findUpcoming:success', { count: limited.length }, context);
      return limited;
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

      const rangeStart = eventData.start!;
      const rangeEnd = eventData.end!;

      // Pull non-recurring events that overlap the window, plus every recurring
      // master (expanded below) so occurrences inside the window are considered.
      // Bind the window bounds as ISO strings, not Date objects: the columns are
      // `timestamp without time zone` and node-pg would otherwise serialize the
      // Dates with the server's local offset, shifting the window on a non-UTC
      // server and dropping real overlaps (#59).
      const params: string[] = [
        context.userId!,
        this.toTimestampParam(rangeEnd),
        this.toTimestampParam(rangeStart),
      ];
      const and: string[] = [
        'e."userId" = $1',
        '(e.recurrence IS NOT NULL OR (e.start < $2 AND e."end" > $3))',
      ];
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

      // Build the candidate set. Non-recurring rows were already filtered to
      // overlap the window by SQL, so they pass through directly. Recurring
      // masters are expanded into occurrences and then filtered to the ones
      // that actually overlap the window. The expansion window is padded back
      // by each occurrence's duration so an instance that starts before the
      // range but ends inside it is still caught.
      const candidates: EventEntity[] = [];
      for (const row of res.rows) {
        const transformed = this.transformEntity(row);
        if (transformed.recurrence) {
          const durationMs = Math.max(
            0,
            new Date(transformed.end).getTime() -
              new Date(transformed.start).getTime()
          );
          const expansionStart = new Date(rangeStart.getTime() - durationMs);
          const occurrences = this.generateOccurrences(
            transformed,
            expansionStart,
            rangeEnd
          ).filter(
            (occ) =>
              occ.start.getTime() < rangeEnd.getTime() &&
              occ.end.getTime() > rangeStart.getTime()
          );
          candidates.push(...occurrences);
        } else {
          candidates.push(transformed);
        }
      }

      // Enrich with each conflicting event's calendar so callers can name the
      // calendar it belongs to. Conflicts span all of the user's calendars
      // (unless a calendarId was explicitly passed), so this disambiguates
      // cross-calendar double-bookings in the warning UI (#41).
      const enrichedCandidates = await this.enrichEntities(candidates, context);

      const conflicts: EventConflict[] = enrichedCandidates.map(
        (conflictEvent) => {
          const overlapStart = new Date(
            Math.max(rangeStart.getTime(), conflictEvent.start.getTime())
          );
          const overlapEnd = new Date(
            Math.min(rangeEnd.getTime(), conflictEvent.end.getTime())
          );
          const overlapDuration = Math.round(
            (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
          );

          return {
            conflictingEvent: conflictEvent,
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
   * Create a recurring event.
   *
   * We persist exactly one master row carrying the RRULE in `recurrence` and
   * the excluded occurrence dates in `exceptions`. Individual occurrences are
   * never written to the database; they are expanded virtually at read time by
   * the date-range read path (findAll/findByDateRange) and by conflict checks.
   * This keeps a daily/weekly series compact and lets a single edit to the
   * master reshape every occurrence.
   */
  async createRecurring(
    data: CreateEventDTO,
    context?: ServiceContext
  ): Promise<EventEntity[]> {
    const masterEvent = await this.create(data, context);
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
      color: originalEvent.color ?? undefined,
      exceptions: originalEvent.exceptions,
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
      // The recurrence editor emits BYSETPOS for "nth weekday" monthly and
      // yearly rules, e.g. "last Friday of the month" (src/utils/recurrence.ts
      // buildRRule). Reject these rules and the UI can't save them (#42).
      'BYSETPOS',
    ];
    const ruleBody = rrule.substring(6); // Remove 'RRULE:'

    // Split by semicolon and validate each part
    const parts = ruleBody.split(';');
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (!validKeywords.includes(key)) {
        return false;
      }
      // BYSETPOS is a comma-separated list of non-zero positions in the range
      // [-366, 366] per RFC 5545; reject anything outside that.
      if (key === 'BYSETPOS' && !this.isValidBySetPos(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate a BYSETPOS value: a comma-separated list of non-zero integers in
   * the RFC 5545 range [-366, 366].
   */
  private isValidBySetPos(value: string | undefined): boolean {
    if (!value) return false;
    return value.split(',').every((token) => {
      const n = Number(token);
      return Number.isInteger(n) && n !== 0 && n >= -366 && n <= 366;
    });
  }
}
