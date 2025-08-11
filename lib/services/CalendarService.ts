/**
 * Calendar Service - Concrete implementation of BaseService for Calendar operations
 */
import { BaseService, type ServiceContext, type UserOwnedEntity } from './BaseService';

/**
 * Calendar entity interface extending base
 */
export interface CalendarEntity extends UserOwnedEntity {
  name: string;
  color: string;
  description: string | null;
  isVisible: boolean;
  isDefault: boolean;
  
  // Relations (optional for different query contexts)
  events?: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
  }>;
  _count?: {
    events: number;
  };
}

/**
 * Calendar creation DTO
 */
export interface CreateCalendarDTO {
  name: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

/**
 * Calendar update DTO
 */
export interface UpdateCalendarDTO {
  name?: string;
  color?: string;
  description?: string;
  isVisible?: boolean;
  isDefault?: boolean;
}

/**
 * Calendar filters interface
 */
export interface CalendarFilters {
  isVisible?: boolean;
  isDefault?: boolean;
  search?: string;
}

/**
 * CalendarService - Handles all calendar-related operations
 */
export class CalendarService extends BaseService<CalendarEntity, CreateCalendarDTO, UpdateCalendarDTO, CalendarFilters> {
  protected getModel() {
    return this.prisma.calendar;
  }

  protected getEntityName(): string {
    return 'Calendar';
  }

  protected buildWhereClause(filters: CalendarFilters, context?: ServiceContext): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Always filter by user
    if (context?.userId) {
      where.userId = context.userId;
    }

    // Visibility filter
    if (filters.isVisible !== undefined) {
      where.isVisible = filters.isVisible;
    }

    // Default calendar filter
    if (filters.isDefault !== undefined) {
      where.isDefault = filters.isDefault;
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  protected buildIncludeClause(): Record<string, unknown> {
    return {
      _count: {
        select: {
          events: true,
        },
      },
    };
  }

  /**
   * Validate calendar creation
   */
  protected async validateCreate(data: CreateCalendarDTO, context?: ServiceContext): Promise<void> {
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Calendar name is required');
    }

    // Check for duplicate calendar name for the user
    if (context?.userId) {
      const existingCalendar = await this.prisma.calendar.findFirst({
        where: {
          name: data.name.trim(),
          userId: context.userId,
        },
      });

      if (existingCalendar) {
        throw new Error('VALIDATION_ERROR: Calendar name already exists');
      }
    }

    // Validate color format (basic hex color validation)
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
    }
  }

  /**
   * Validate calendar updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateCalendarDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Calendar name cannot be empty');
    }

    if (context?.userId) {
      const hasAccess = await this.checkOwnership(id, context.userId);
      if (!hasAccess) {
        throw new Error('AUTHORIZATION_ERROR: Access denied');
      }
    }

    // Check for duplicate name if name is being updated
    if (data.name && context?.userId) {
      const existingCalendar = await this.prisma.calendar.findFirst({
        where: {
          name: data.name.trim(),
          userId: context.userId,
          id: { not: id }, // Exclude current calendar
        },
      });

      if (existingCalendar) {
        throw new Error('VALIDATION_ERROR: Calendar name already exists');
      }
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
    }
  }

  /**
   * Create calendar with default handling
   */
  async create(data: CreateCalendarDTO, context?: ServiceContext): Promise<CalendarEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      // Check if this should be the first/default calendar
      let isDefault = data.isDefault || false;
      
      if (context?.userId) {
        const existingCalendars = await this.count({}, context);
        
        // If no calendars exist, make this the default
        if (existingCalendars === 0) {
          isDefault = true;
        }
      }

      const createData: Record<string, unknown> = {
        name: data.name.trim(),
        color: data.color,
        description: data.description?.trim() || null,
        isDefault,
        isVisible: true, // New calendars are visible by default
        userId: context?.userId,
      };

      // Handle default calendar logic in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // If setting as default, unset other defaults
        if (isDefault && context?.userId) {
          await tx.calendar.updateMany({
            where: {
              userId: context.userId,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        return await tx.calendar.create({
          data: createData,
          include: this.buildIncludeClause(),
        });
      });

      this.log('create:success', { id: result.id }, context);
      return this.transformEntity(result);
    } catch (error) {
      this.log('create:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Get default calendar for user
   */
  async getDefault(context?: ServiceContext): Promise<CalendarEntity> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getDefault', {}, context);

      let defaultCalendar = await this.getModel().findFirst({
        where: {
          userId: context.userId,
          isDefault: true,
        },
        include: this.buildIncludeClause(),
      });

      // If no default calendar exists, get the first one or create one
      if (!defaultCalendar) {
        const firstCalendar = await this.getModel().findFirst({
          where: { userId: context.userId },
          include: this.buildIncludeClause(),
        });

        if (firstCalendar) {
          // Set first calendar as default
          defaultCalendar = await this.getModel().update({
            where: { id: firstCalendar.id },
            data: { isDefault: true },
            include: this.buildIncludeClause(),
          });
        } else {
          // Create a default calendar
          defaultCalendar = await this.create(
            {
              name: 'My Calendar',
              color: '#3B82F6',
              description: 'Default calendar',
              isDefault: true,
            },
            context
          );
        }
      }

      this.log('getDefault:success', { id: defaultCalendar.id }, context);
      return this.transformEntity(defaultCalendar);
    } catch (error) {
      this.log('getDefault:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Set calendar as default
   */
  async setDefault(id: string, context?: ServiceContext): Promise<CalendarEntity> {
    try {
      this.log('setDefault', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Unset all other defaults
        if (context?.userId) {
          await tx.calendar.updateMany({
            where: {
              userId: context.userId,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        // Set this calendar as default
        return await tx.calendar.update({
          where: { id },
          data: { 
            isDefault: true,
            updatedAt: new Date(),
          },
          include: this.buildIncludeClause(),
        });
      });

      this.log('setDefault:success', { id }, context);
      return this.transformEntity(result);
    } catch (error) {
      this.log('setDefault:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Toggle calendar visibility
   */
  async toggleVisibility(id: string, context?: ServiceContext): Promise<CalendarEntity> {
    try {
      this.log('toggleVisibility', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }
      }

      const currentCalendar = await this.getModel().findUnique({
        where: { id },
        select: { isVisible: true },
      });

      if (!currentCalendar) {
        throw new Error('NOT_FOUND: Calendar not found');
      }

      const updatedCalendar = await this.getModel().update({
        where: { id },
        data: {
          isVisible: !currentCalendar.isVisible,
          updatedAt: new Date(),
        },
        include: this.buildIncludeClause(),
      });

      this.log('toggleVisibility:success', { id, isVisible: updatedCalendar.isVisible }, context);
      return this.transformEntity(updatedCalendar);
    } catch (error) {
      this.log('toggleVisibility:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Get visible calendars for user
   */
  async getVisible(context?: ServiceContext): Promise<CalendarEntity[]> {
    const filters: CalendarFilters = { isVisible: true };
    return await this.findAll(filters, context);
  }

  /**
   * Get calendars with event counts
   */
  async getWithEventCounts(context?: ServiceContext): Promise<CalendarEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getWithEventCounts', {}, context);

      const calendars = await this.getModel().findMany({
        where: { userId: context.userId },
        include: {
          _count: {
            select: { events: true },
          },
        },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });

      this.log('getWithEventCounts:success', { count: calendars.length }, context);
      return calendars.map((calendar) => this.transformEntity(calendar));
    } catch (error) {
      this.log('getWithEventCounts:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Delete calendar with validation
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      this.log('delete', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }

        // Check if this is the only calendar
        const userCalendarCount = await this.count({}, context);
        if (userCalendarCount <= 1) {
          throw new Error('VALIDATION_ERROR: Cannot delete the only calendar');
        }

        // Check if this is the default calendar
        const calendar = await this.getModel().findUnique({
          where: { id },
          select: { isDefault: true },
        });

        if (calendar?.isDefault) {
          // Set another calendar as default before deleting
          const otherCalendar = await this.getModel().findFirst({
            where: {
              userId: context.userId,
              id: { not: id },
            },
          });

          if (otherCalendar) {
            await this.getModel().update({
              where: { id: otherCalendar.id },
              data: { isDefault: true },
            });
          }
        }
      }

      // Delete the calendar (cascade will handle events)
      await this.getModel().delete({
        where: { id },
      });

      this.log('delete:success', { id }, context);
      return true;
    } catch (error) {
      this.log('delete:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Reorder calendars (if ordering is needed in the future)
   */
  async reorder(calendarIds: string[], context?: ServiceContext): Promise<CalendarEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('reorder', { calendarIds }, context);

      // Validate all calendars belong to user
      const userCalendars = await this.getModel().findMany({
        where: {
          id: { in: calendarIds },
          userId: context.userId,
        },
      });

      if (userCalendars.length !== calendarIds.length) {
        throw new Error('VALIDATION_ERROR: Some calendars not found or access denied');
      }

      // For now, just return the calendars in the requested order
      // In a full implementation, you might add an `order` field to the database
      const orderedCalendars = await Promise.all(
        calendarIds.map(async (id) => {
          const calendar = await this.getModel().findUnique({
            where: { id },
            include: this.buildIncludeClause(),
          });
          return calendar;
        })
      );

      const results = orderedCalendars
        .filter(Boolean)
        .map((calendar) => this.transformEntity(calendar));

      this.log('reorder:success', { count: results.length }, context);
      return results;
    } catch (error) {
      this.log('reorder:error', { error: error.message, calendarIds }, context);
      throw error;
    }
  }
}