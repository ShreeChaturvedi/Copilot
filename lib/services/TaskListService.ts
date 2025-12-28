/**
 * TaskList Service - Concrete implementation of BaseService for TaskList operations
 */
import {
  BaseService,
  type ServiceContext,
  type UserOwnedEntity,
} from './BaseService.js';
import { query } from '../config/database.js';
import { taskListCache, createCacheKey } from '../utils/cache.js';

/**
 * TaskList entity interface extending base
 */
export interface TaskListEntity extends UserOwnedEntity {
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Relations (optional for different query contexts)
  tasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    scheduledDate: Date | null;
    priority: string;
  }>;
  _count?: {
    tasks: number;
  };
}

/**
 * TaskList creation DTO
 */
export interface CreateTaskListDTO {
  name: string;
  color: string;
  icon?: string;
  description?: string;
}

/**
 * TaskList update DTO
 */
export interface UpdateTaskListDTO {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
}

/**
 * TaskList filters interface
 */
export interface TaskListFilters {
  search?: string;
  hasActiveTasks?: boolean;
}

/**
 * TaskListWithCounts interface for detailed views
 */
export interface TaskListWithCounts extends TaskListEntity {
  taskCount: number;
  completedTaskCount: number;
  pendingTaskCount: number;
}

/**
 * TaskListService - Handles all task list-related operations
 */
export class TaskListService extends BaseService<
  TaskListEntity,
  CreateTaskListDTO,
  UpdateTaskListDTO,
  TaskListFilters
> {
  protected getTableName(): string {
    return 'task_lists';
  }

  protected getEntityName(): string {
    return 'TaskList';
  }

  /**
   * Update task list by ID
   */
  async update(
    id: string,
    data: UpdateTaskListDTO,
    context?: ServiceContext
  ): Promise<TaskListEntity | null> {
    await this.validateUpdate(id, data, context);

    const sets: string[] = [];
    const params: Array<string | null | Date> = []; // Mixed types for SQL parameters

    if (data.name !== undefined) {
      params.push(data.name.trim());
      sets.push(`name = $${params.length}`);
    }
    if (data.color !== undefined) {
      params.push(data.color);
      sets.push(`color = $${params.length}`);
    }
    if (data.icon !== undefined) {
      params.push(data.icon ?? null);
      sets.push(`icon = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description?.trim() || null);
      sets.push(`description = $${params.length}`);
    }

    params.push(new Date());
    sets.push(`"updatedAt" = $${params.length}`);
    params.push(id);

    const sql = `UPDATE task_lists SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const res = await query(sql, params, this.db);
    if (res.rowCount === 0) return null;

    // Invalidate cache after updating a task list
    if (context?.userId) {
      const cacheKey = createCacheKey('task-lists', context.userId);
      taskListCache.invalidate(cacheKey);
    }

    return this.transformEntity(res.rows[0]);
  }

  protected buildWhereClause(
    filters: TaskListFilters,
    context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = []; // Mixed types for SQL parameters
    if (context?.userId) {
      params.push(context.userId);
      clauses.push('"userId" = $' + params.length);
    }
    if (filters.search) {
      params.push('%' + filters.search + '%');
      const idx = params.length;
      clauses.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    }
    if (filters.hasActiveTasks) {
      clauses.push(
        'EXISTS (SELECT 1 FROM tasks t WHERE t."taskListId" = task_lists.id AND t.completed = false)'
      );
    }
    const sql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  async findAll(
    filters: TaskListFilters = {},
    context?: ServiceContext
  ): Promise<TaskListEntity[]> {
    try {
      this.log('findAll', { filters }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const res = await query<TaskListEntity>(
        `SELECT * FROM task_lists ${sql} ORDER BY name ASC`,
        params,
        this.db
      );
      return res.rows.map((row) => this.transformEntity(row)); // Database row
    } catch (error) {
      this.log('findAll:error', { error: error.message, filters }, context);
      throw error;
    }
  }

  protected async enrichEntities(
    entities: TaskListEntity[]
  ): Promise<TaskListEntity[]> {
    if (!entities.length) return entities;
    const ids = entities.map((l) => l.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const counts = await query<{
      id: string;
      total: string;
      completed: string;
    }>(
      `SELECT tl.id,
              COUNT(t.*)::bigint AS total,
              COUNT(CASE WHEN t.completed THEN 1 END)::bigint AS completed
       FROM task_lists tl
       LEFT JOIN tasks t ON t."taskListId" = tl.id
       WHERE tl.id IN (${placeholders})
       GROUP BY tl.id`,
      ids,
      this.db
    );
    const map = new Map<string, { total: number; completed: number }>();
    counts.rows.forEach((r) =>
      map.set(r.id, { total: Number(r.total), completed: Number(r.completed) })
    );
    return entities.map((e) => ({
      ...e,
      _count: { tasks: map.get(e.id)?.total ?? 0 },
      tasks: undefined,
    }));
  }

  /**
   * Validate task list creation
   */
  protected async validateCreate(
    data: CreateTaskListDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Task list name is required');
    }

    // Check for duplicate task list name for the user
    if (context?.userId) {
      const existingTaskList = await query(
        'SELECT id FROM task_lists WHERE name = $1 AND "userId" = $2 LIMIT 1',
        [data.name.trim(), context.userId],
        this.db
      );

      if (existingTaskList.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Task list name already exists');
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
   * Validate task list updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateTaskListDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Task list name cannot be empty');
    }

    if (context?.userId) {
      const hasAccess = await this.checkOwnership(id, context.userId);
      if (!hasAccess) {
        throw new Error('AUTHORIZATION_ERROR: Access denied');
      }
    }

    // Check for duplicate name if name is being updated
    if (data.name && context?.userId) {
      const existingTaskList = await query(
        'SELECT id FROM task_lists WHERE name = $1 AND "userId" = $2 AND id <> $3 LIMIT 1',
        [data.name.trim(), context.userId, id],
        this.db
      );
      if (existingTaskList.rowCount > 0) {
        throw new Error('VALIDATION_ERROR: Task list name already exists');
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
   * Create task list with proper defaults
   */
  async create(
    data: CreateTaskListDTO,
    context?: ServiceContext
  ): Promise<TaskListEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      // Ensure a user row exists in development to satisfy FK constraints
      await this.ensureUserExists(context?.userId);

      const inserted = await query(
        `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [
          data.name.trim(),
          data.color,
          data.icon || null,
          data.description?.trim() || null,
          context!.userId!,
        ],
        this.db
      );
      const row = inserted.rows[0];
      this.log('create:success', { id: row.id }, context);

      // Invalidate cache after creating a new task list
      if (context?.userId) {
        const cacheKey = createCacheKey('task-lists', context.userId);
        taskListCache.invalidate(cacheKey);
      }

      return this.transformEntity(row);
    } catch (error) {
      this.log('create:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Get default task list for user
   */
  async getDefault(context?: ServiceContext): Promise<TaskListEntity> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getDefault', {}, context);

      // Try to find "General" task list first
      const generalRes = await query(
        'SELECT * FROM task_lists WHERE "userId" = $1 AND name = $2 LIMIT 1',
        [context.userId!, 'General'],
        this.db
      );
      let defaultTaskList = generalRes.rows[0];

      // If no "General" list, get the first task list
      if (!defaultTaskList) {
        const firstRes = await query(
          'SELECT * FROM task_lists WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1',
          [context.userId!],
          this.db
        );
        defaultTaskList = firstRes.rows[0];
      }

      // If no task lists exist, create a default one
      if (!defaultTaskList) {
        const created = await this.create(
          {
            name: 'General',
            color: '#8B5CF6',
            description: 'Default task list',
          },
          context
        );
        this.log('getDefault:created', { id: created.id }, context);
        return this.transformEntity(created);
      }

      this.log('getDefault:success', { id: defaultTaskList.id }, context);
      return this.transformEntity(defaultTaskList);
    } catch (error) {
      this.log('getDefault:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Get task lists with task counts
   */
  async getWithTaskCount(
    context?: ServiceContext
  ): Promise<TaskListWithCounts[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getWithTaskCount', {}, context);

      type TaskListCountRow = TaskListEntity & {
        task_count: string | number;
        completed_count: string | number;
      };
      const res = await query<TaskListCountRow>(
        `SELECT tl.id, tl.name, tl.color, tl.icon, tl.description, tl."userId", tl."createdAt", tl."updatedAt",
                COUNT(t.*)::bigint AS task_count,
                COUNT(CASE WHEN t.completed THEN 1 END)::bigint AS completed_count
         FROM task_lists tl
         LEFT JOIN tasks t ON t."taskListId" = tl.id
         WHERE tl."userId" = $1
         GROUP BY tl.id
         ORDER BY tl.name ASC`,
        [context.userId!],
        this.db
      );

      const results: TaskListWithCounts[] = res.rows.map((row) => ({
        // Database row
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        description: row.description,
        userId: row.userId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        taskCount: Number(row.task_count),
        completedTaskCount: Number(row.completed_count),
        pendingTaskCount: Number(row.task_count) - Number(row.completed_count),
      }));

      this.log('getWithTaskCount:success', { count: results.length }, context);
      return results;
    } catch (error) {
      this.log('getWithTaskCount:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Get task lists with detailed task information
   */
  async getWithTasks(context?: ServiceContext): Promise<TaskListEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getWithTasks', {}, context);

      const listsRes = await query<TaskListEntity>(
        'SELECT * FROM task_lists WHERE "userId" = $1 ORDER BY name ASC',
        [context.userId!],
        this.db
      );
      const listIds = listsRes.rows.map((row) => row.id);
      const placeholders = listIds.map((_, i) => `$${i + 1}`).join(',');
      interface TaskRow {
        id: string;
        title: string;
        completed: boolean;
        scheduledDate: Date | null;
        priority: string;
        taskListId: string;
      }
      const tasksRes = listIds.length
        ? await query<TaskRow>(
            `SELECT id, title, completed, "scheduledDate", priority, "taskListId"
             FROM tasks WHERE "taskListId" IN (${placeholders})
             ORDER BY completed ASC, "scheduledDate" ASC NULLS LAST, "createdAt" DESC`,
            listIds,
            this.db
          )
        : { rows: [] as TaskRow[] }; // Empty result set for no task lists
      const tasksByList = new Map<string, TaskRow[]>();
      tasksRes.rows.forEach((task) => {
        // Database rows
        const arr = tasksByList.get(task.taskListId) || [];
        if (arr.length < 10) arr.push(task);
        tasksByList.set(task.taskListId, arr);
      });
      const results = listsRes.rows.map((list) => ({
        // Database row
        id: list.id,
        name: list.name,
        color: list.color,
        icon: list.icon,
        description: list.description,
        userId: list.userId,
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(list.updatedAt),
        _count: { tasks: (tasksByList.get(list.id) || []).length },
        tasks: (tasksByList.get(list.id) || []).map((task) => ({
          id: task.id,
          title: task.title,
          completed: task.completed,
          scheduledDate: task.scheduledDate,
          priority: task.priority,
        })),
      }));

      this.log('getWithTasks:success', { count: results.length }, context);
      return results;
    } catch (error) {
      this.log('getWithTasks:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Reorder task lists
   */
  async reorder(
    taskListIds: string[],
    context?: ServiceContext
  ): Promise<TaskListEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('reorder', { taskListIds }, context);

      // Validate all task lists belong to user
      const placeholders = taskListIds.map((_, i) => `$${i + 1}`).join(',');
      const res = await query(
        `SELECT id FROM task_lists WHERE id IN (${placeholders}) AND "userId" = $${taskListIds.length + 1}`,
        [...taskListIds, context.userId!],
        this.db
      );
      if (res.rowCount !== taskListIds.length) {
        throw new Error(
          'VALIDATION_ERROR: Some task lists not found or access denied'
        );
      }

      // For now, just return the task lists in the requested order
      // In a full implementation, you might add an `order` field to the database
      const orderedTaskLists = await Promise.all(
        taskListIds.map(async (id) => {
          const r = await query(
            'SELECT * FROM task_lists WHERE id = $1',
            [id],
            this.db
          );
          return r.rows[0];
        })
      );

      const results = orderedTaskLists
        .filter(Boolean)
        .map((taskList) => this.transformEntity(taskList));

      this.log('reorder:success', { count: results.length }, context);
      return results;
    } catch (error) {
      this.log('reorder:error', { error: error.message, taskListIds }, context);
      throw error;
    }
  }

  /**
   * Delete task list with task handling
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      this.log('delete', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }

        // Check if this is the only task list
        const userTaskListCount = await this.count({}, context);
        if (userTaskListCount <= 1) {
          throw new Error('VALIDATION_ERROR: Cannot delete the only task list');
        }

        // Get the default task list to move orphaned tasks
        const defaultTaskList = await this.getDefault(context);

        // Move all tasks to the default task list if they're not already there
        if (defaultTaskList.id !== id) {
          await query(
            'UPDATE tasks SET "taskListId" = $1 WHERE "taskListId" = $2 AND "userId" = $3',
            [defaultTaskList.id, id, context.userId!],
            this.db
          );
        }
      }

      // Delete the task list
      await query('DELETE FROM task_lists WHERE id = $1', [id], this.db);

      // Invalidate cache after deleting a task list
      if (context?.userId) {
        const cacheKey = createCacheKey('task-lists', context.userId);
        taskListCache.invalidate(cacheKey);
      }

      this.log('delete:success', { id }, context);
      return true;
    } catch (error) {
      this.log('delete:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Get task list statistics
   */
  async getStatistics(context?: ServiceContext): Promise<{
    totalLists: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    averageTasksPerList: number;
  }> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getStatistics', {}, context);

      const [listsRes, tasksRes, completedRes] = await Promise.all([
        query<{ count: string }>(
          'SELECT COUNT(*)::bigint AS count FROM task_lists WHERE "userId" = $1',
          [context.userId!],
          this.db
        ),
        query<{ count: string }>(
          'SELECT COUNT(*)::bigint AS count FROM tasks WHERE "userId" = $1',
          [context.userId!],
          this.db
        ),
        query<{ count: string }>(
          'SELECT COUNT(*)::bigint AS count FROM tasks WHERE "userId" = $1 AND completed = true',
          [context.userId!],
          this.db
        ),
      ]);
      const totalLists = Number(listsRes.rows[0].count);
      const totalTasks = Number(tasksRes.rows[0].count);
      const completedTasks = Number(completedRes.rows[0].count);
      const pendingTasks = totalTasks - completedTasks;
      const averageTasksPerList =
        totalLists > 0 ? Math.round((totalTasks / totalLists) * 100) / 100 : 0;
      const stats = {
        totalLists,
        totalTasks,
        completedTasks,
        pendingTasks,
        averageTasksPerList,
      };

      this.log('getStatistics:success', stats, context);
      return stats;
    } catch (error) {
      this.log('getStatistics:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Archive task list (soft delete by marking inactive)
   * Note: This would require adding an `isActive` field to the database schema
   */
  async archive(): Promise<TaskListEntity> {
    // This is a placeholder for future archiving functionality
    // Would require schema changes to add `isActive` or `archivedAt` fields
    throw new Error(
      'NOT_IMPLEMENTED: Archive functionality not yet implemented'
    );
  }

  /**
   * Get archived task lists
   */
  async getArchived(context?: ServiceContext): Promise<TaskListEntity[]> {
    void context;
    // Placeholder for archived task lists
    // Would require schema changes
    return [];
  }
}
