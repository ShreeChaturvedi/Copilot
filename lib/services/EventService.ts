/**
 * Event Service - Concrete implementation of BaseService for Event operations
 */
import type { PrismaClient, Event } from '@prisma/client';
import { BaseService, type ServiceContext, type UserOwnedEntity } from './BaseService';

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
export class EventService extends BaseService<EventEntity, CreateEventDTO, UpdateEventDTO, EventFilters> {
  protected getModel() {
    return this.prisma.event;
  }

  protected getEntityName(): string {
    return 'Event';
  }

  protected buildWhereClause(filters: EventFilters, context?: ServiceContext): any {
    const where: any = {};

    // Always filter by user
    if (context?.userId) {
      where.userId = context.userId;
    }

    // Calendar filter
    if (filters.calendarId) {
      where.calendarId = filters.calendarId;
    }

    // Multiple calendars filter
    if (filters.calendarIds && filters.calendarIds.length > 0) {
      where.calendarId = { in: filters.calendarIds };
    }

    // Date range filter
    if (filters.start || filters.end) {
      where.AND = [];
      
      if (filters.start) {
        where.AND.push({
          end: { gte: filters.start },
        });
      }
      
      if (filters.end) {
        where.AND.push({
          start: { lte: filters.end },
        });
      }
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // All-day filter
    if (filters.allDay !== undefined) {
      where.allDay = filters.allDay;
    }

    // Recurrence filter
    if (filters.hasRecurrence !== undefined) {
      if (filters.hasRecurrence) {
        where.recurrence = { not: null };
      } else {
        where.recurrence = null;
      }
    }

    return where;
  }

  protected buildIncludeClause(): any {
    return {
      calendar: {
        select: {
          id: true,
          name: true,
          color: true,
          isVisible: true,
        },
      },
    };
  }

  /**
   * Validate event creation
   */
  protected async validateCreate(data: CreateEventDTO, context?: ServiceContext): Promise<void> {
    if (!data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Event title is required');
    }

    if (!data.start || !data.end) {
      throw new Error('VALIDATION_ERROR: Event start and end dates are required');
    }

    // Validate start is before end (unless it's all-day)
    if (!data.allDay && data.start >= data.end) {
      throw new Error('VALIDATION_ERROR: Event start must be before end time');
    }

    // Validate calendar exists and user owns it
    if (context?.userId) {
      const calendar = await this.prisma.calendar.findFirst({
        where: {
          id: data.calendarId,
          userId: context.userId,
        },
      });

      if (!calendar) {
        throw new Error('VALIDATION_ERROR: Calendar not found or access denied');
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
    const currentEvent = await this.getModel().findUnique({
      where: { id },
      select: { start: true, end: true, allDay: true },
    });

    if (!currentEvent) {
      throw new Error('NOT_FOUND: Event not found');
    }

    // Validate start/end relationship
    const start = data.start ?? currentEvent.start;
    const end = data.end ?? currentEvent.end;
    const allDay = data.allDay ?? currentEvent.allDay;

    if (!allDay && start >= end) {
      throw new Error('VALIDATION_ERROR: Event start must be before end time');
    }

    // Validate calendar if being updated
    if (data.calendarId && context?.userId) {
      const calendar = await this.prisma.calendar.findFirst({
        where: {
          id: data.calendarId,
          userId: context.userId,
        },
      });

      if (!calendar) {
        throw new Error('VALIDATION_ERROR: Calendar not found or access denied');
      }
    }

    // Validate recurrence format if provided
    if (data.recurrence && !this.isValidRRule(data.recurrence)) {
      throw new Error('VALIDATION_ERROR: Invalid recurrence rule format');
    }
  }

  /**
   * Find events by date range
   */
  async findByDateRange(start: Date, end: Date, context?: ServiceContext): Promise<EventEntity[]> {
    const filters: EventFilters = { start, end };
    return await this.findAll(filters, context);
  }

  /**
   * Find events by calendar
   */
  async findByCalendar(calendarId: string, context?: ServiceContext): Promise<EventEntity[]> {
    const filters: EventFilters = { calendarId };
    return await this.findAll(filters, context);
  }

  /**
   * Find upcoming events
   */
  async findUpcoming(limit: number = 10, context?: ServiceContext): Promise<EventEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('findUpcoming', { limit }, context);

      const now = new Date();
      const events = await this.getModel().findMany({
        where: {
          userId: context.userId,
          start: { gte: now },
          calendar: {
            isVisible: true,
          },
        },
        include: this.buildIncludeClause(),
        orderBy: { start: 'asc' },
        take: limit,
      });

      this.log('findUpcoming:success', { count: events.length }, context);
      return events.map((event) => this.transformEntity(event));
    } catch (error) {
      this.log('findUpcoming:error', { error: error.message, limit }, context);
      throw error;
    }
  }

  /**
   * Search events by query
   */
  async search(query: string, context?: ServiceContext): Promise<EventEntity[]> {
    const filters: EventFilters = { search: query };
    return await this.findAll(filters, context);
  }

  /**
   * Get event conflicts for a new or updated event
   */
  async getConflicts(eventData: CreateEventDTO | UpdateEventDTO, excludeId?: string, context?: ServiceContext): Promise<EventConflict[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    if (!eventData.start || !eventData.end) {
      return []; // No conflicts if no time specified
    }

    try {
      this.log('getConflicts', { eventData, excludeId }, context);

      const where: any = {
        userId: context.userId,
        // Find overlapping events
        AND: [
          { start: { lt: eventData.end } },
          { end: { gt: eventData.start } },
        ],
      };

      // Exclude the event being updated
      if (excludeId) {
        where.id = { not: excludeId };
      }

      // Only check conflicts within the same calendar or specified calendars
      if (eventData.calendarId) {
        where.calendarId = eventData.calendarId;
      }

      const conflictingEvents = await this.getModel().findMany({
        where,
        include: this.buildIncludeClause(),
      });

      const conflicts: EventConflict[] = conflictingEvents.map((conflictEvent) => {
        const overlapStart = new Date(Math.max(eventData.start!.getTime(), conflictEvent.start.getTime()));
        const overlapEnd = new Date(Math.min(eventData.end!.getTime(), conflictEvent.end.getTime()));
        const overlapDuration = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));

        return {
          conflictingEvent: this.transformEntity(conflictEvent),
          overlapStart,
          overlapEnd,
          overlapDuration,
        };
      });

      this.log('getConflicts:success', { conflictCount: conflicts.length }, context);
      return conflicts;
    } catch (error) {
      this.log('getConflicts:error', { error: error.message, eventData }, context);
      throw error;
    }
  }

  /**
   * Get events for a specific month (optimized for calendar view)
   */
  async findByMonth(year: number, month: number, context?: ServiceContext): Promise<EventEntity[]> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    return await this.findByDateRange(startOfMonth, endOfMonth, context);
  }

  /**
   * Get events for today
   */
  async findToday(context?: ServiceContext): Promise<EventEntity[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
  async createRecurring(data: CreateEventDTO, context?: ServiceContext): Promise<EventEntity[]> {
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
  async moveToCalendar(eventId: string, newCalendarId: string, context?: ServiceContext): Promise<EventEntity> {
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
    const validKeywords = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTH', 'BYMONTHDAY'];
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