/**
 * Calendar Service - Concrete implementation of BaseService for Calendar operations (SQL)
 */
import {
  BaseService,
  type ServiceContext,
  type UserOwnedEntity,
} from './BaseService.js';
import { query, withTransaction } from '../config/database.js';

/**
 * Calendar entity interface extending base
 */
export interface CalendarEntity extends UserOwnedEntity {
  name: string;
  color: string;
  description: string | null;
  isVisible: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;

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
export class CalendarService extends BaseService<
  CalendarEntity,
  CreateCalendarDTO,
  UpdateCalendarDTO,
  CalendarFilters
> {
  protected getTableName(): string {
    return 'calendars';
  }

  protected getEntityName(): string {
    return 'Calendar';
  }

  protected buildWhereClause(
    filters: CalendarFilters,
    context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (context?.userId) {
      params.push(context.userId);
      clauses.push(`"userId" = $${params.length}`);
    }
    if (filters.isVisible !== undefined) {
      params.push(filters.isVisible);
      clauses.push(`"isVisible" = $${params.length}`);
    }
    if (filters.isDefault !== undefined) {
      params.push(filters.isDefault);
      clauses.push(`"isDefault" = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      const idx = params.length;
      clauses.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    }
    const sql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return { sql, params };
  }

  async findAll(
    filters: CalendarFilters = {},
    context?: ServiceContext
  ): Promise<CalendarEntity[]> {
    try {
      this.log('findAll', { filters }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const res = await query<CalendarEntity>(
        `SELECT * FROM calendars ${sql} ORDER BY "isDefault" DESC, name ASC`,
        params,
        this.db
      );
      const rows = res.rows.map((row) => this.transformEntity(row));
      return rows;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findAll:error', { error: message, filters }, context);
      throw error;
    }
  }

  protected async enrichEntities(
    entities: CalendarEntity[],
    _context?: ServiceContext
  ): Promise<CalendarEntity[]> {
    if (!entities.length) return entities;
    const ids = entities.map((c) => c.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const counts = await query<{ id: string; count: string }>(
      `SELECT c.id, COUNT(e.*)::bigint as count
       FROM calendars c
       LEFT JOIN events e ON e."calendarId" = c.id
       WHERE c.id IN (${placeholders})
       GROUP BY c.id`,
      ids,
      this.db
    );
    const countMap = new Map<string, number>();
    counts.rows.forEach((r) => countMap.set(r.id, Number(r.count)));
    return entities.map(
      (c) =>
        ({
          ...c,
          _count: { events: countMap.get(c.id) || 0 },
        }) as unknown as CalendarEntity
    );
  }

  /**
   * Validate calendar creation
   */
  protected async validateCreate(
    data: CreateCalendarDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Calendar name is required');
    }

    // Check for duplicate calendar name for the user
    if (context?.userId) {
      const existingCalendar = await query(
        'SELECT id FROM calendars WHERE name = $1 AND "userId" = $2 LIMIT 1',
        [data.name.trim(), context.userId],
        this.db
      );

      if (existingCalendar.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Calendar name already exists');
      }
    }

    // Validate color format (basic hex color validation)
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
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
      const existingCalendar = await query(
        'SELECT id FROM calendars WHERE name = $1 AND "userId" = $2 AND id <> $3 LIMIT 1',
        [data.name.trim(), context.userId, id],
        this.db
      );
      if (existingCalendar.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Calendar name already exists');
      }
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    }
  }

  /**
   * Create calendar with default handling
   */
  async create(
    data: CreateCalendarDTO,
    context?: ServiceContext
  ): Promise<CalendarEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);
      await this.ensureUserExists(context?.userId, 'dev@example.com');

      // Check if this should be the first/default calendar
      let isDefault = data.isDefault || false;

      if (context?.userId) {
        const existingCalendars = await this.count({}, context);

        // If no calendars exist, make this the default
        if (existingCalendars === 0) {
          isDefault = true;
        }
      }

      const result = await withTransaction(async (client) => {
        if (isDefault && context?.userId) {
          await query(
            'UPDATE calendars SET "isDefault" = false WHERE "userId" = $1 AND "isDefault" = true',
            [context.userId],
            client
          );
        }
        const created = await query(
          `INSERT INTO calendars (id, name, color, description, "isDefault", "isVisible", "userId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, $5, NOW(), NOW())
           RETURNING *`,
          [
            data.name.trim(),
            data.color,
            data.description?.trim() || null,
            isDefault,
            context!.userId!,
          ],
          client
        );
        return created.rows[0];
      });

      this.log('create:success', { id: result.id }, context);
      return this.transformEntity(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('create:error', { error: message, data }, context);
      throw error;
    }
  }

  /**
   * Update calendar by ID
   */
  async update(
    id: string,
    data: UpdateCalendarDTO,
    context?: ServiceContext
  ): Promise<CalendarEntity | null> {
    try {
      this.log('update', { id, data }, context);

      await this.validateUpdate(id, data, context);

      // Build dynamic update query
      const updates: string[] = [];
      const params: Array<string | boolean | null> = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name.trim());
      }
      if (data.color !== undefined) {
        updates.push(`color = $${paramIndex++}`);
        params.push(data.color);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description?.trim() || null);
      }
      if (data.isVisible !== undefined) {
        updates.push(`"isVisible" = $${paramIndex++}`);
        params.push(data.isVisible);
      }
      if (data.isDefault !== undefined) {
        updates.push(`"isDefault" = $${paramIndex++}`);
        params.push(data.isDefault);

        // If setting as default, unset other calendars first
        if (data.isDefault && context?.userId) {
          await query(
            'UPDATE calendars SET "isDefault" = false WHERE "userId" = $1 AND "isDefault" = true AND id <> $2',
            [context.userId, id],
            this.db
          );
        }
      }

      if (updates.length === 0) {
        // No updates to make, just return current calendar
        return this.findById(id, context);
      }

      updates.push(`"updatedAt" = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE calendars SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
        this.db
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      this.log('update:success', { id }, context);
      return this.transformEntity(row);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('update:error', { error: message, id, data }, context);
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

      const defaultRes = await query<CalendarEntity>(
        'SELECT * FROM calendars WHERE "userId" = $1 AND "isDefault" = true LIMIT 1',
        [context.userId],
        this.db
      );
      let defaultCalendar: CalendarEntity | null = defaultRes.rows[0] || null;

      // If no default calendar exists, get the first one or create one
      if (!defaultCalendar) {
        const firstRes = await query<CalendarEntity>(
          'SELECT * FROM calendars WHERE "userId" = $1 LIMIT 1',
          [context.userId],
          this.db
        );
        const firstCalendar = firstRes.rows[0] || null;

        if (firstCalendar) {
          // Set first calendar as default
          const updated = await query(
            'UPDATE calendars SET "isDefault" = true, "updatedAt" = NOW() WHERE id = $1 RETURNING *',
            [firstCalendar.id],
            this.db
          );
          defaultCalendar = updated.rows[0];
        } else {
          // Create a default calendar and return immediately to avoid mixed inferred types
          const created = await this.create(
            {
              name: 'My Calendar',
              color: '#3B82F6',
              description: 'Default calendar',
              isDefault: true,
            },
            context
          );
          this.log('getDefault:created', { id: created.id }, context);
          return this.transformEntity(created);
        }
      }

      this.log('getDefault:success', { id: defaultCalendar.id }, context);
      return this.transformEntity(defaultCalendar);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('getDefault:error', { error: message }, context);
      throw error;
    }
  }

  /**
   * Set calendar as default
   */
  async setDefault(
    id: string,
    context?: ServiceContext
  ): Promise<CalendarEntity> {
    try {
      this.log('setDefault', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }
      }

      const result = await withTransaction(async (client) => {
        if (context?.userId) {
          await query(
            'UPDATE calendars SET "isDefault" = false WHERE "userId" = $1 AND "isDefault" = true',
            [context.userId],
            client
          );
        }
        const updated = await query(
          'UPDATE calendars SET "isDefault" = true, "updatedAt" = NOW() WHERE id = $1 RETURNING *',
          [id],
          client
        );
        return updated.rows[0];
      });

      this.log('setDefault:success', { id }, context);
      return this.transformEntity(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('setDefault:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Toggle calendar visibility
   */
  async toggleVisibility(
    id: string,
    context?: ServiceContext
  ): Promise<CalendarEntity> {
    try {
      this.log('toggleVisibility', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }
      }

      const currentRes = await query<{ isVisible: boolean }>(
        'SELECT "isVisible" FROM calendars WHERE id = $1',
        [id],
        this.db
      );
      const currentCalendar = currentRes.rows[0];

      if (!currentCalendar) {
        throw new Error('NOT_FOUND: Calendar not found');
      }

      const updatedRes = await query(
        'UPDATE calendars SET "isVisible" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
        [!currentCalendar.isVisible, id],
        this.db
      );
      const updatedCalendar = updatedRes.rows[0];

      this.log(
        'toggleVisibility:success',
        { id, isVisible: updatedCalendar.isVisible },
        context
      );
      return this.transformEntity(updatedCalendar);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('toggleVisibility:error', { error: message, id }, context);
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
  async getWithEventCounts(
    context?: ServiceContext
  ): Promise<CalendarEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }
    const userId = context.userId;

    try {
      this.log('getWithEventCounts', {}, context);

      type CalendarWithCountRow = CalendarEntity & {
        events_count: string | number;
      };
      const res = await query<CalendarWithCountRow>(
        `SELECT c.*, COALESCE(e_cnt.count, 0)::bigint AS events_count
         FROM calendars c
         LEFT JOIN (
           SELECT "calendarId", COUNT(*)::bigint AS count
           FROM events
           GROUP BY "calendarId"
         ) e_cnt ON e_cnt."calendarId" = c.id
         WHERE c."userId" = $1
         ORDER BY c."isDefault" DESC, c.name ASC`,
        [userId],
        this.db
      );

      this.log('getWithEventCounts:success', { count: res.rowCount }, context);
      return res.rows.map((row) =>
        this.transformEntity({
          ...row,
          _count: { events: Number(row.events_count) },
        })
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('getWithEventCounts:error', { error: message }, context);
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
        const userCalendarCountRes = await query<{ count: string }>(
          'SELECT COUNT(*)::bigint AS count FROM calendars WHERE "userId" = $1',
          [context.userId!],
          this.db
        );
        const userCalendarCount = Number(userCalendarCountRes.rows[0].count);
        if (userCalendarCount <= 1) {
          throw new Error('VALIDATION_ERROR: Cannot delete the only calendar');
        }

        // Check if this is the default calendar
        const calendarRes = await query<{ isDefault: boolean }>(
          'SELECT "isDefault" FROM calendars WHERE id = $1',
          [id],
          this.db
        );
        const calendar = calendarRes.rows[0];

        if (calendar?.isDefault) {
          // Set another calendar as default before deleting
          const otherRes = await query(
            'SELECT id FROM calendars WHERE "userId" = $1 AND id <> $2 LIMIT 1',
            [context.userId!, id],
            this.db
          );
          const otherCalendar = otherRes.rows[0];

          if (otherCalendar) {
            await query(
              'UPDATE calendars SET "isDefault" = true WHERE id = $1',
              [otherCalendar.id],
              this.db
            );
          }
        }
      }

      await query('DELETE FROM calendars WHERE id = $1', [id], this.db);

      this.log('delete:success', { id }, context);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('delete:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Reorder calendars (if ordering is needed in the future)
   */
  async reorder(
    calendarIds: string[],
    context?: ServiceContext
  ): Promise<CalendarEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('reorder', { calendarIds }, context);

      // Validate all calendars belong to user
      const placeholders = calendarIds.map((_, i) => `$${i + 1}`).join(',');
      const userCalendars = await query(
        `SELECT id FROM calendars WHERE id IN (${placeholders}) AND "userId" = $${calendarIds.length + 1}`,
        [...calendarIds, context.userId!],
        this.db
      );

      if (userCalendars.rowCount !== calendarIds.length) {
        throw new Error(
          'VALIDATION_ERROR: Some calendars not found or access denied'
        );
      }

      // For now, just return the calendars in the requested order
      // In a full implementation, you might add an `order` field to the database
      const orderedCalendars = await Promise.all(
        calendarIds.map(async (id) => {
          const res = await query(
            'SELECT * FROM calendars WHERE id = $1',
            [id],
            this.db
          );
          return res.rows[0];
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
