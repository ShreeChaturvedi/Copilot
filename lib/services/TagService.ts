/**
 * Tag Service - Concrete implementation of BaseService for Tag operations
 */
import {
  BaseService,
  type ServiceContext,
  type BaseEntity,
} from './BaseService.js';
import { query, withTransaction } from '../config/database.js';

export type TagType =
  | 'DATE'
  | 'TIME'
  | 'PRIORITY'
  | 'LOCATION'
  | 'PERSON'
  | 'LABEL'
  | 'PROJECT';

/**
 * Tag entity interface extending base
 */
export interface TagEntity extends BaseEntity {
  name: string;
  type: TagType;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;

  // Relations (optional for different query contexts)
  tasks?: Array<{
    taskId: string;
    value: string;
    displayText: string;
    iconName: string;
    task: {
      id: string;
      title: string;
      completed: boolean;
    };
  }>;
  _count?: {
    tasks: number;
  };
}

/**
 * Tag creation DTO
 */
export interface CreateTagDTO {
  name: string;
  type: TagType;
  color?: string;
}

/**
 * Tag update DTO
 */
export interface UpdateTagDTO {
  name?: string;
  type?: TagType;
  color?: string;
}

/**
 * Tag filters interface
 */
export interface TagFilters {
  type?: TagType;
  search?: string;
  hasActiveTasks?: boolean;
  userId?: string; // For filtering task associations by user
  color?: string;
  unused?: boolean;
  minUsageCount?: number;
  withUsageCount?: boolean;
}

/**
 * Task-Tag relationship DTO
 */
export interface TaskTagDTO {
  taskId: string;
  tagId: string;
  value: string;
  displayText: string;
  iconName: string;
}

/**
 * TagService - Handles all tag-related operations
 */
export class TagService extends BaseService<
  TagEntity,
  CreateTagDTO,
  UpdateTagDTO,
  TagFilters
> {
  protected getTableName(): string {
    return 'tags';
  }

  protected getEntityName(): string {
    return 'Tag';
  }

  protected buildWhereClause(
    filters: TagFilters,
    _context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.type) {
      params.push(filters.type);
      clauses.push('type = $' + params.length);
    }
    if (filters.search) {
      params.push('%' + filters.search + '%');
      clauses.push('name ILIKE $' + params.length);
    }
    if (filters.hasActiveTasks && filters.userId) {
      params.push(filters.userId);
      clauses.push(
        `id IN (
          SELECT DISTINCT tt."tagId"
          FROM "task_tags" tt
          JOIN tasks t ON t.id = tt."taskId"
          WHERE t."userId" = $${params.length} AND t.completed = false
        )`
      );
    }
    const sql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  protected buildIncludeClause(): Record<string, unknown> {
    return {
      _count: {
        select: {
          tasks: true,
        },
      },
    };
  }

  /**
   * Find tags with optional filtering
   */
  async findAll(
    filters: TagFilters = {},
    context?: ServiceContext
  ): Promise<TagEntity[]> {
    try {
      this.log('findAll', { filters }, context);
      const scopedFilters: TagFilters = {
        ...filters,
        userId: filters.userId ?? context?.userId,
      };

      const params: Array<string | number | boolean> = [];
      const whereClauses: string[] = [];
      const userId = scopedFilters.userId;

      if (scopedFilters.type) {
        params.push(scopedFilters.type);
        whereClauses.push(`t.type = $${params.length}`);
      }
      if (scopedFilters.search) {
        params.push(`%${scopedFilters.search}%`);
        whereClauses.push(`t.name ILIKE $${params.length}`);
      }
      if (scopedFilters.color) {
        params.push(scopedFilters.color);
        whereClauses.push(`t.color = $${params.length}`);
      }
      if (scopedFilters.hasActiveTasks) {
        if (userId) {
          params.push(userId);
          whereClauses.push(
            `EXISTS (
              SELECT 1 FROM task_tags tt
              JOIN tasks tk ON tk.id = tt."taskId"
              WHERE tt."tagId" = t.id AND tk."userId" = $${params.length} AND tk.completed = false
            )`
          );
        } else {
          whereClauses.push(
            `EXISTS (
              SELECT 1 FROM task_tags tt
              JOIN tasks tk ON tk.id = tt."taskId"
              WHERE tt."tagId" = t.id AND tk.completed = false
            )`
          );
        }
      }

      const needsUsageJoin = Boolean(
        scopedFilters.withUsageCount ||
          scopedFilters.minUsageCount !== undefined ||
          scopedFilters.unused !== undefined
      );
      let usageJoin = '';
      let usageSelect = '';

      if (needsUsageJoin) {
        if (userId) {
          params.push(userId);
          const userIndex = params.length;
          usageJoin = `LEFT JOIN (
            SELECT tt."tagId", COUNT(*)::int AS count
            FROM task_tags tt
            JOIN tasks tk ON tk.id = tt."taskId"
            WHERE tk."userId" = $${userIndex}
            GROUP BY tt."tagId"
          ) tag_usage ON tag_usage."tagId" = t.id`;
        } else {
          usageJoin = `LEFT JOIN (
            SELECT "tagId", COUNT(*)::int AS count
            FROM task_tags
            GROUP BY "tagId"
          ) tag_usage ON tag_usage."tagId" = t.id`;
        }
        usageSelect = ', COALESCE(tag_usage.count, 0)::int AS "usageCount"';

        if (scopedFilters.unused !== undefined) {
          whereClauses.push(
            scopedFilters.unused
              ? 'COALESCE(tag_usage.count, 0) = 0'
              : 'COALESCE(tag_usage.count, 0) > 0'
          );
        }
        if (scopedFilters.minUsageCount !== undefined) {
          params.push(scopedFilters.minUsageCount);
          whereClauses.push(
            `COALESCE(tag_usage.count, 0) >= $${params.length}`
          );
        }
      }

      const whereSql = whereClauses.length
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';
      const res = await query<TagEntity>(
        `SELECT t.id, t.name, t.type, t.color, t."createdAt", t."updatedAt"${usageSelect}
         FROM tags t
         ${usageJoin}
         ${whereSql}
         ORDER BY t.type ASC, t.name ASC`,
        params,
        this.db
      );
      return res.rows.map((row) => this.transformEntity(row));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findAll:error', { error: message, filters }, context);
      throw error;
    }
  }

  /**
   * Validate tag creation
   */
  protected async validateCreate(
    data: CreateTagDTO,
    _context?: ServiceContext
  ): Promise<void> {
    void _context;
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Tag name is required');
    }

    // Check for duplicate tag name (tags are global, not user-specific)
    const existingTag = await query(
      'SELECT id FROM tags WHERE name = $1 LIMIT 1',
      [data.name.trim().toLowerCase()],
      this.db
    );

    if (existingTag.rowCount > 0) {
      throw new Error('VALIDATION_ERROR: Tag name already exists');
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    }

    // Validate tag type
    const validTypes: TagType[] = [
      'DATE',
      'TIME',
      'PRIORITY',
      'LOCATION',
      'PERSON',
      'LABEL',
      'PROJECT',
    ];
    if (!validTypes.includes(data.type)) {
      throw new Error('VALIDATION_ERROR: Invalid tag type');
    }
  }

  /**
   * Validate tag updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateTagDTO,
    context?: ServiceContext
  ): Promise<void> {
    void context;
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Tag name cannot be empty');
    }

    // Check for duplicate name if name is being updated
    if (data.name) {
      const existingTag = await query(
        'SELECT id FROM tags WHERE name = $1 AND id <> $2 LIMIT 1',
        [data.name.trim().toLowerCase(), id],
        this.db
      );
      if (existingTag.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Tag name already exists');
      }
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error(
        'VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)'
      );
    }

    // Validate tag type if provided
    if (data.type) {
      const validTypes: TagType[] = [
        'DATE',
        'TIME',
        'PRIORITY',
        'LOCATION',
        'PERSON',
        'LABEL',
        'PROJECT',
      ];
      if (!validTypes.includes(data.type)) {
        throw new Error('VALIDATION_ERROR: Invalid tag type');
      }
    }
  }

  /**
   * Create tag with proper normalization
   */
  async create(
    data: CreateTagDTO,
    context?: ServiceContext
  ): Promise<TagEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      const inserted = await query(
        `INSERT INTO tags (id, name, type, color)
         VALUES (gen_random_uuid()::text, $1, $2, $3)
         RETURNING *`,
        [data.name.trim().toLowerCase(), data.type, data.color || null],
        this.db
      );
      const row = inserted.rows[0];
      this.log('create:success', { id: row.id }, context);
      return this.transformEntity(row);
    } catch (error) {
      this.log('create:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Update tag fields with validation and normalization
   */
  async update(
    id: string,
    data: UpdateTagDTO,
    context?: ServiceContext
  ): Promise<TagEntity | null> {
    try {
      this.log('update', { id, data }, context);
      await this.validateUpdate(id, data, context);

      const sets: string[] = [];
      const params: Array<string | null> = [];

      if (data.name !== undefined) {
        params.push(data.name.trim().toLowerCase());
        sets.push(`name = $${params.length}`);
      }
      if (data.type !== undefined) {
        params.push(data.type);
        sets.push(`type = $${params.length}`);
      }
      if (data.color !== undefined) {
        params.push(data.color || null);
        sets.push(`color = $${params.length}`);
      }

      if (sets.length === 0) {
        return await this.findById(id, context);
      }

      params.push(id);
      const res = await query(
        `UPDATE tags SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
        this.db
      );
      const row = res.rows[0];
      return row ? this.transformEntity(row) : null;
    } catch (error) {
      this.log(
        'update:error',
        { error: (error as Error).message, id, data },
        context
      );
      throw error;
    }
  }

  /**
   * Find or create tag (upsert operation)
   */
  async findOrCreate(
    data: CreateTagDTO,
    context?: ServiceContext
  ): Promise<TagEntity> {
    try {
      this.log('findOrCreate', { data }, context);

      const normalizedName = data.name.trim().toLowerCase();
      const existingTag = await query(
        'SELECT * FROM tags WHERE name = $1 LIMIT 1',
        [normalizedName],
        this.db
      );
      if (existingTag.rowCount > 0) {
        const row = existingTag.rows[0];
        this.log('findOrCreate:found', { id: row.id }, context);
        return this.transformEntity(row);
      }
      const created = await this.create(
        { ...data, name: normalizedName },
        context
      );
      this.log('findOrCreate:created', { id: created.id }, context);
      return created;
    } catch (error) {
      this.log('findOrCreate:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Get tags by type
   */
  async findByType(
    type: TagType,
    context?: ServiceContext
  ): Promise<TagEntity[]> {
    const filters: TagFilters = { type };
    return await this.findAll(filters, context);
  }

  /**
   * Get tags for a specific user's tasks
   */
  async findByUser(
    userId: string,
    context?: ServiceContext
  ): Promise<TagEntity[]> {
    try {
      this.log('findByUser', { userId }, context);
      const tags = await query<TagEntity>(
        `SELECT t.*
         FROM tags t
         WHERE EXISTS (
           SELECT 1 FROM task_tags tt
           JOIN tasks tk ON tk.id = tt."taskId"
           WHERE tt."tagId" = t.id AND tk."userId" = $1
         )
         ORDER BY t.type ASC, t.name ASC`,
        [userId],
        this.db
      );
      this.log('findByUser:success', { count: tags.rowCount }, context);
      return tags.rows.map((row) => this.transformEntity(row));
    } catch (error) {
      this.log('findByUser:error', { error: error.message, userId }, context);
      throw error;
    }
  }

  /**
   * Create task-tag relationship
   */
  async attachToTask(
    taskTagData: TaskTagDTO,
    context?: ServiceContext
  ): Promise<void> {
    try {
      this.log('attachToTask', { taskTagData }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const task = await query(
          'SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1',
          [taskTagData.taskId, context.userId],
          this.db
        );
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Create the relationship
      await query(
        `INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("taskId", "tagId") DO UPDATE SET value = EXCLUDED.value, "displayText" = EXCLUDED."displayText", "iconName" = EXCLUDED."iconName"`,
        [
          taskTagData.taskId,
          taskTagData.tagId,
          taskTagData.value,
          taskTagData.displayText,
          taskTagData.iconName,
        ],
        this.db
      );

      this.log(
        'attachToTask:success',
        { taskId: taskTagData.taskId, tagId: taskTagData.tagId },
        context
      );
    } catch (error) {
      this.log(
        'attachToTask:error',
        { error: error.message, taskTagData },
        context
      );
      throw error;
    }
  }

  /**
   * Remove task-tag relationship
   */
  async detachFromTask(
    taskId: string,
    tagId: string,
    context?: ServiceContext
  ): Promise<void> {
    try {
      this.log('detachFromTask', { taskId, tagId }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const task = await query(
          'SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1',
          [taskId, context.userId],
          this.db
        );
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Remove the relationship
      await query(
        'DELETE FROM task_tags WHERE "taskId" = $1 AND "tagId" = $2',
        [taskId, tagId],
        this.db
      );

      this.log('detachFromTask:success', { taskId, tagId }, context);
    } catch (error) {
      this.log(
        'detachFromTask:error',
        { error: error.message, taskId, tagId },
        context
      );
      throw error;
    }
  }

  /**
   * Get task-tag relationships for a task
   */
  async getTaskTags(
    taskId: string,
    context?: ServiceContext
  ): Promise<
    Array<{
      tag: TagEntity;
      value: string;
      displayText: string;
      iconName: string;
    }>
  > {
    try {
      this.log('getTaskTags', { taskId }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const validate = await query(
          'SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1',
          [taskId, context.userId],
          this.db
        );
        if (validate.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      type TaskTagRow = {
        id: string;
        name: string;
        type: TagType;
        color: string | null;
        createdAt: Date;
        updatedAt: Date;
        value: string;
        displayText: string;
        iconName: string;
      };
      const res = await query<TaskTagRow>(
        `SELECT tt.value, tt."displayText", tt."iconName", t.*
         FROM task_tags tt
         JOIN tags t ON t.id = tt."tagId"
         WHERE tt."taskId" = $1`,
        [taskId],
        this.db
      );

      const results = res.rows.map((row) => ({
        tag: this.transformEntity({
          id: row.id,
          name: row.name,
          type: row.type,
          color: row.color,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }),
        value: row.value,
        displayText: row.displayText,
        iconName: row.iconName,
      }));

      this.log('getTaskTags:success', { count: results.length }, context);
      return results;
    } catch (error) {
      this.log('getTaskTags:error', { error: error.message, taskId }, context);
      throw error;
    }
  }

  /**
   * Update task-tag relationship
   */
  async updateTaskTag(
    taskId: string,
    tagId: string,
    updates: Partial<Omit<TaskTagDTO, 'taskId' | 'tagId'>>,
    context?: ServiceContext
  ): Promise<void> {
    try {
      this.log('updateTaskTag', { taskId, tagId, updates }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const task = await query(
          'SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1',
          [taskId, context.userId],
          this.db
        );
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }
      const sets: string[] = [];
      const params: string[] = [];
      if (updates.value !== undefined) {
        params.push(updates.value);
        sets.push(`value = $${params.length}`);
      }
      if (updates.displayText !== undefined) {
        params.push(updates.displayText);
        sets.push(`"displayText" = $${params.length}`);
      }
      if (updates.iconName !== undefined) {
        params.push(updates.iconName);
        sets.push(`"iconName" = $${params.length}`);
      }
      params.push(taskId, tagId);
      await query(
        `UPDATE task_tags SET ${sets.join(', ')} WHERE "taskId" = $${params.length - 1} AND "tagId" = $${params.length}`,
        params,
        this.db
      );

      this.log('updateTaskTag:success', { taskId, tagId }, context);
    } catch (error) {
      this.log(
        'updateTaskTag:error',
        { error: error.message, taskId, tagId },
        context
      );
      throw error;
    }
  }

  /**
   * Clean up unused tags (tags with no task relationships)
   */
  async cleanupUnusedTags(
    context?: ServiceContext
  ): Promise<{ deletedCount: number; deletedTagIds: string[] }> {
    try {
      this.log('cleanupUnusedTags', {}, context);
      const idsRes = await query<{ id: string }>(
        `SELECT t.id FROM tags t WHERE NOT EXISTS (
           SELECT 1 FROM task_tags tt WHERE tt."tagId" = t.id
         )`,
        [],
        this.db
      );
      const ids = idsRes.rows.map((r) => r.id);
      if (ids.length > 0) {
        await query(
          'DELETE FROM tags WHERE id = ANY($1::text[])',
          [ids],
          this.db
        );
      }
      this.log(
        'cleanupUnusedTags:success',
        { deletedCount: ids.length },
        context
      );
      return { deletedCount: ids.length, deletedTagIds: ids };
    } catch (error) {
      this.log('cleanupUnusedTags:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Merge tags (combine two tags into one)
   */
  async mergeTags(
    sourceTagId: string | string[],
    targetTagId: string,
    context?: ServiceContext
  ): Promise<TagEntity> {
    try {
      const sourceTagIds = Array.isArray(sourceTagId)
        ? sourceTagId
        : [sourceTagId];
      this.log('mergeTags', { sourceTagIds, targetTagId }, context);

      if (sourceTagIds.includes(targetTagId)) {
        throw new Error('VALIDATION_ERROR: Cannot merge tag with itself');
      }

      const result = await withTransaction(async (client) => {
        if (sourceTagIds.length === 1) {
          await query(
            'UPDATE task_tags SET "tagId" = $1 WHERE "tagId" = $2',
            [targetTagId, sourceTagIds[0]],
            client
          );
          await query(
            'DELETE FROM tags WHERE id = $1',
            [sourceTagIds[0]],
            client
          );
        } else {
          await query(
            'UPDATE task_tags SET "tagId" = $1 WHERE "tagId" = ANY($2::text[])',
            [targetTagId, sourceTagIds],
            client
          );
          await query(
            'DELETE FROM tags WHERE id = ANY($1::text[])',
            [sourceTagIds],
            client
          );
        }
        const res = await query(
          'SELECT * FROM tags WHERE id = $1',
          [targetTagId],
          client
        );
        return res.rows[0];
      });

      this.log('mergeTags:success', { targetTagId }, context);
      return this.transformEntity(result);
    } catch (error) {
      this.log(
        'mergeTags:error',
        { error: error.message, sourceTagId, targetTagId },
        context
      );
      throw error;
    }
  }

  /**
   * Alias for tag statistics used by API handlers
   */
  async getStats(context?: ServiceContext) {
    return this.getStatistics(context);
  }

  /**
   * Get tag statistics
   */
  async getStatistics(context?: ServiceContext): Promise<{
    totalTags: number;
    tagsByType: Record<TagType, number>;
    mostUsedTags: Array<{ tag: TagEntity; usageCount: number }>;
  }> {
    try {
      this.log('getStatistics', {}, context);
      const totalRes = await query<{ count: string }>(
        'SELECT COUNT(*)::bigint AS count FROM tags',
        [],
        this.db
      );
      const byTypeRes = await query<{ type: TagType; count: string }>(
        'SELECT type, COUNT(*)::bigint AS count FROM tags GROUP BY type',
        [],
        this.db
      );
      const mostUsedRes = await query<TagEntity & { usage: string | number }>(
        `SELECT t.*, COALESCE(cnt.c, 0)::bigint AS usage
         FROM tags t
         LEFT JOIN (
           SELECT "tagId", COUNT(*)::bigint AS c FROM task_tags GROUP BY "tagId"
         ) cnt ON cnt."tagId" = t.id
         ORDER BY usage DESC
         LIMIT 10`,
        [],
        this.db
      );

      const typeStats = byTypeRes.rows.reduce(
        (acc, r) => {
          acc[r.type] = Number(r.count);
          return acc;
        },
        {} as Record<TagType, number>
      );
      const topTags = mostUsedRes.rows.map((row) => ({
        tag: this.transformEntity(row),
        usageCount: Number(row.usage),
      }));
      const stats = {
        totalTags: Number(totalRes.rows[0].count),
        tagsByType: typeStats,
        mostUsedTags: topTags,
      };
      this.log('getStatistics:success', stats, context);
      return stats;
    } catch (error) {
      this.log('getStatistics:error', { error: error.message }, context);
      throw error;
    }
  }
}
