/**
 * Tag Service - Concrete implementation of BaseService for Tag operations
 */
import { BaseService, type ServiceContext, type BaseEntity } from './BaseService.js';
import { query, withTransaction } from '../config/database.js';

export type TagType = 'DATE' | 'TIME' | 'PRIORITY' | 'LOCATION' | 'PERSON' | 'LABEL' | 'PROJECT';

/**
 * Tag entity interface extending base
 */
export interface TagEntity extends BaseEntity {
  name: string;
  type: TagType;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  
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
export class TagService extends BaseService<TagEntity, CreateTagDTO, UpdateTagDTO, TagFilters> {
  protected getTableName(): string { return 'tags'; }

  protected getEntityName(): string {
    return 'Tag';
  }

  protected buildWhereClause(filters: TagFilters, _context?: ServiceContext): { sql: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
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
   * Validate tag creation
   */
  protected async validateCreate(data: CreateTagDTO, _context?: ServiceContext): Promise<void> {
    void _context;
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Tag name is required');
    }

    // Check for duplicate tag name (tags are global, not user-specific)
    const existingTag = await query('SELECT id FROM tags WHERE name = $1 LIMIT 1', [data.name.trim().toLowerCase()], this.db);

    if (existingTag.rowCount > 0) {
      throw new Error('VALIDATION_ERROR: Tag name already exists');
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
    }

    // Validate tag type
    const validTypes: TagType[] = ['DATE', 'TIME', 'PRIORITY', 'LOCATION', 'PERSON', 'LABEL', 'PROJECT'];
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
      const existingTag = await query('SELECT id FROM tags WHERE name = $1 AND id <> $2 LIMIT 1', [data.name.trim().toLowerCase(), id], this.db);
      if (existingTag.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Tag name already exists');
      }
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
    }

    // Validate tag type if provided
    if (data.type) {
      const validTypes: TagType[] = ['DATE', 'TIME', 'PRIORITY', 'LOCATION', 'PERSON', 'LABEL', 'PROJECT'];
      if (!validTypes.includes(data.type)) {
        throw new Error('VALIDATION_ERROR: Invalid tag type');
      }
    }
  }

  /**
   * Create tag with proper normalization
   */
  async create(data: CreateTagDTO, context?: ServiceContext): Promise<TagEntity> {
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
   * Find or create tag (upsert operation)
   */
  async findOrCreate(data: CreateTagDTO, context?: ServiceContext): Promise<TagEntity> {
    try {
      this.log('findOrCreate', { data }, context);

      const normalizedName = data.name.trim().toLowerCase();
      const existingTag = await query('SELECT * FROM tags WHERE name = $1 LIMIT 1', [normalizedName], this.db);
      if (existingTag.rowCount > 0) {
        const row = existingTag.rows[0];
        this.log('findOrCreate:found', { id: row.id }, context);
        return this.transformEntity(row);
      }
      const created = await this.create({ ...data, name: normalizedName }, context);
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
  async findByType(type: TagType, context?: ServiceContext): Promise<TagEntity[]> {
    const filters: TagFilters = { type };
    return await this.findAll(filters, context);
  }

  /**
   * Get tags for a specific user's tasks
   */
  async findByUser(userId: string, context?: ServiceContext): Promise<TagEntity[]> {
    try {
      this.log('findByUser', { userId }, context);
      const tags = await query(
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
      return tags.rows.map((row: any) => this.transformEntity(row));
    } catch (error) {
      this.log('findByUser:error', { error: error.message, userId }, context);
      throw error;
    }
  }

  /**
   * Create task-tag relationship
   */
  async attachToTask(taskTagData: TaskTagDTO, context?: ServiceContext): Promise<void> {
    try {
      this.log('attachToTask', { taskTagData }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const task = await query('SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1', [taskTagData.taskId, context.userId], this.db);
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Create the relationship
      await query(
        `INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("taskId", "tagId") DO UPDATE SET value = EXCLUDED.value, "displayText" = EXCLUDED."displayText", "iconName" = EXCLUDED."iconName"`,
        [taskTagData.taskId, taskTagData.tagId, taskTagData.value, taskTagData.displayText, taskTagData.iconName],
        this.db
      );

      this.log('attachToTask:success', { taskId: taskTagData.taskId, tagId: taskTagData.tagId }, context);
    } catch (error) {
      this.log('attachToTask:error', { error: error.message, taskTagData }, context);
      throw error;
    }
  }

  /**
   * Remove task-tag relationship
   */
  async detachFromTask(taskId: string, tagId: string, context?: ServiceContext): Promise<void> {
    try {
      this.log('detachFromTask', { taskId, tagId }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const task = await query('SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1', [taskId, context.userId], this.db);
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Remove the relationship
      await query('DELETE FROM task_tags WHERE "taskId" = $1 AND "tagId" = $2', [taskId, tagId], this.db);

      this.log('detachFromTask:success', { taskId, tagId }, context);
    } catch (error) {
      this.log('detachFromTask:error', { error: error.message, taskId, tagId }, context);
      throw error;
    }
  }

  /**
   * Get task-tag relationships for a task
   */
  async getTaskTags(taskId: string, context?: ServiceContext): Promise<Array<{
    tag: TagEntity;
    value: string;
    displayText: string;
    iconName: string;
  }>> {
    try {
      this.log('getTaskTags', { taskId }, context);

      // Validate task exists and user has access
      if (context?.userId) {
        const validate = await query('SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1', [taskId, context.userId], this.db);
        if (validate.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      const res = await query(
        `SELECT tt.value, tt."displayText", tt."iconName", t.*
         FROM task_tags tt
         JOIN tags t ON t.id = tt."tagId"
         WHERE tt."taskId" = $1`,
        [taskId],
        this.db
      );

      const results = res.rows.map((r: any) => ({
        tag: this.transformEntity({ id: r.id, name: r.name, type: r.type, color: r.color, createdAt: r.createdAt, updatedAt: r.updatedAt }),
        value: r.value,
        displayText: r.displayText,
        iconName: r.iconName,
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
        const task = await query('SELECT id FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1', [taskId, context.userId], this.db);
        if (task.rowCount === 0) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }
      const sets: string[] = [];
      const params: any[] = [];
      if (updates.value !== undefined) { params.push(updates.value); sets.push(`value = $${params.length}`); }
      if (updates.displayText !== undefined) { params.push(updates.displayText); sets.push(`"displayText" = $${params.length}`); }
      if (updates.iconName !== undefined) { params.push(updates.iconName); sets.push(`"iconName" = $${params.length}`); }
      params.push(taskId, tagId);
      await query(`UPDATE task_tags SET ${sets.join(', ')} WHERE "taskId" = $${params.length - 1} AND "tagId" = $${params.length}`, params, this.db);

      this.log('updateTaskTag:success', { taskId, tagId }, context);
    } catch (error) {
      this.log('updateTaskTag:error', { error: error.message, taskId, tagId }, context);
      throw error;
    }
  }

  /**
   * Clean up unused tags (tags with no task relationships)
   */
  async cleanupUnusedTags(context?: ServiceContext): Promise<{ deletedCount: number }> {
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
        await query('DELETE FROM tags WHERE id = ANY($1::text[])', [ids], this.db);
      }
      this.log('cleanupUnusedTags:success', { deletedCount: ids.length }, context);
      return { deletedCount: ids.length };
    } catch (error) {
      this.log('cleanupUnusedTags:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Merge tags (combine two tags into one)
   */
  async mergeTags(sourceTagId: string, targetTagId: string, context?: ServiceContext): Promise<TagEntity> {
    try {
      this.log('mergeTags', { sourceTagId, targetTagId }, context);

      if (sourceTagId === targetTagId) {
        throw new Error('VALIDATION_ERROR: Cannot merge tag with itself');
      }

      const result = await withTransaction(async (client) => {
        await query('UPDATE task_tags SET "tagId" = $1 WHERE "tagId" = $2', [targetTagId, sourceTagId], client);
        await query('DELETE FROM tags WHERE id = $1', [sourceTagId], client);
        const res = await query('SELECT * FROM tags WHERE id = $1', [targetTagId], client);
        return res.rows[0];
      });

      this.log('mergeTags:success', { targetTagId }, context);
      return this.transformEntity(result);
    } catch (error) {
      this.log('mergeTags:error', { error: error.message, sourceTagId, targetTagId }, context);
      throw error;
    }
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
      const totalRes = await query<{ count: string }>('SELECT COUNT(*)::bigint AS count FROM tags', [], this.db);
      const byTypeRes = await query<{ type: TagType; count: string }>('SELECT type, COUNT(*)::bigint AS count FROM tags GROUP BY type', [], this.db);
      const mostUsedRes = await query(
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

      const typeStats = byTypeRes.rows.reduce((acc, r) => { acc[r.type] = Number(r.count); return acc; }, {} as Record<TagType, number>);
      const topTags = mostUsedRes.rows.map((row: any) => ({ tag: this.transformEntity(row), usageCount: Number(row.usage) }));
      const stats = { totalTags: Number(totalRes.rows[0].count), tagsByType: typeStats, mostUsedTags: topTags };
      this.log('getStatistics:success', stats, context);
      return stats;
    } catch (error) {
      this.log('getStatistics:error', { error: error.message }, context);
      throw error;
    }
  }
}