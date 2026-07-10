/**
 * Task Service - Concrete implementation of BaseService for Task operations (SQL)
 */
import {
  BaseService,
  type ServiceContext,
  type UserOwnedEntity,
} from './BaseService.js';
import { withTransaction, query } from '../config/database.js';
import { taskListCache, createCacheKey } from '../utils/cache.js';
import { deleteBlobs } from '../utils/blobStorage.js';

/**
 * Task entity interface extending base
 */
export type DbPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Upper bound on rows returned by the unbounded findAll path (list/search
 * convenience finders). A memory/scan guardrail, not a UI page size.
 */
const MAX_FIND_ALL_ROWS = 1000;

export interface TaskEntity extends UserOwnedEntity {
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: Date | null;
  scheduledDate: Date | null;
  priority: DbPriority;
  /** Backend canonical status. Stored as NOT_STARTED | IN_PROGRESS | DONE. */
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  originalInput: string | null;
  cleanTitle: string | null;
  taskListId: string;

  // Relations (optional for different query contexts)
  taskList?: {
    id: string;
    name: string;
    color: string;
  };
  tags?: Array<{
    id: string;
    value: string;
    displayText: string;
    iconName: string;
    tag: {
      id: string;
      name: string;
      type: string;
      color: string | null;
    };
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>;
}

type TaskRow = Omit<
  TaskEntity,
  'createdAt' | 'updatedAt' | 'completedAt' | 'scheduledDate' | 'status'
> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt?: Date | string | null;
  scheduledDate?: Date | string | null;
  status?: TaskEntity['status'] | null;
};

/**
 * Task creation DTO
 */
export interface CreateTaskDTO {
  title: string;
  description?: string;
  taskListId?: string;
  scheduledDate?: Date;
  priority?: DbPriority;
  originalInput?: string;
  cleanTitle?: string;
  tags?: Array<{
    type:
      | 'DATE'
      | 'TIME'
      | 'PRIORITY'
      | 'LOCATION'
      | 'PERSON'
      | 'LABEL'
      | 'PROJECT';
    name: string;
    value: string;
    displayText: string;
    iconName: string;
    color?: string;
  }>;
}

/**
 * Task update DTO
 */
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  completed?: boolean;
  scheduledDate?: Date;
  priority?: DbPriority;
  /** Update status; when set to DONE, completed will be set to true. Other statuses clear completed. */
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  taskListId?: string;
  originalInput?: string;
  cleanTitle?: string;
  /**
   * When provided, REPLACES the task's full tag set with this list (the
   * frontend sends the desired remaining tags, e.g. on tag removal). `type` is
   * accepted case-insensitively; `name` defaults to the lowercased `value`,
   * matching the create path. Pass `[]` to clear all tags.
   */
  tags?: Array<{
    type: string;
    name?: string;
    value: string;
    displayText: string;
    iconName: string;
    color?: string;
  }>;
}

/**
 * Task filters interface
 */
export interface TaskFilters {
  completed?: boolean;
  taskListId?: string;
  priority?: DbPriority;
  scheduledDate?: {
    from?: Date;
    to?: Date;
  };
  search?: string;
  tags?: string[];
  overdue?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'scheduledDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Task statistics interface
 */
export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

/**
 * TaskService - Handles all task-related operations
 */
export class TaskService extends BaseService<
  TaskEntity,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskFilters
> {
  private tagService?: unknown; // placeholder for DI
  private static didEnsureStatusColumn = false;

  private async ensureStatusColumnExists(): Promise<void> {
    if (TaskService.didEnsureStatusColumn) return;
    try {
      const checkRes = await query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_name = 'tasks' AND column_name = 'status'
         ) AS exists`,
        [],
        this.db
      );
      const exists = Boolean(checkRes.rows[0]?.exists);
      if (!exists) {
        await query(`ALTER TABLE tasks ADD COLUMN status TEXT`, [], this.db);
        // Default values based on completed flag
        await query(
          `UPDATE tasks SET status = CASE WHEN completed = true THEN 'DONE' ELSE 'NOT_STARTED' END WHERE status IS NULL`,
          [],
          this.db
        );
        // Enforce NOT NULL with default going forward
        await query(
          `ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'NOT_STARTED'`,
          [],
          this.db
        );
        await query(
          `ALTER TABLE tasks ALTER COLUMN status SET NOT NULL`,
          [],
          this.db
        );
      }
      TaskService.didEnsureStatusColumn = true;
    } catch {
      // If this fails (e.g., insufficient perms), continue without crashing; transformEntity derives status
      TaskService.didEnsureStatusColumn = true;
    }
  }

  protected getTableName(): string {
    return 'tasks';
  }

  protected getEntityName(): string {
    return 'Task';
  }

  protected buildWhereClause(
    filters: TaskFilters,
    context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = []; // Mixed types for SQL parameters
    // Always filter by user
    if (context?.userId) {
      params.push(context.userId);
      clauses.push(`"userId" = $${params.length}`);
    }
    if (filters.completed !== undefined) {
      params.push(filters.completed);
      clauses.push(`completed = $${params.length}`);
    }
    if (filters.taskListId) {
      params.push(filters.taskListId);
      clauses.push(`"taskListId" = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      clauses.push(`priority = $${params.length}`);
    }
    if (filters.scheduledDate) {
      if (filters.scheduledDate.from) {
        params.push(filters.scheduledDate.from);
        clauses.push(`"scheduledDate" >= $${params.length}`);
      }
      if (filters.scheduledDate.to) {
        params.push(filters.scheduledDate.to);
        clauses.push(`"scheduledDate" <= $${params.length}`);
      }
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      const idx = params.length;
      clauses.push(`(title ILIKE $${idx} OR "cleanTitle" ILIKE $${idx})`);
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagParams = filters.tags.map((t) => t.toLowerCase());
      const placeholders = tagParams
        .map((_, i) => `$${params.length + i + 1}`)
        .join(',');
      params.push(...tagParams);
      clauses.push(
        `id IN (
          SELECT DISTINCT tt."taskId"
          FROM "task_tags" tt
          JOIN tags t ON t.id = tt."tagId"
          WHERE t.name IN (${placeholders})
        )`
      );
    }
    if (filters.overdue) {
      clauses.push(`"scheduledDate" < NOW()`);
      clauses.push(`completed = false`);
    }
    const sql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { sql, params };
  }

  private buildOrderByClause(filters: TaskFilters): string {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder =
      (filters.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const allowed = new Set([
      'createdAt',
      'updatedAt',
      'scheduledDate',
      'priority',
      'title',
    ]);
    const column = allowed.has(sortBy || '') ? sortBy : 'createdAt';
    return `ORDER BY "${column}" ${sortOrder}`;
  }

  protected transformEntity(row: TaskRow): TaskEntity {
    // Database row type from pg query
    return {
      id: row.id,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt:
        row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      userId: row.userId,
      title: row.title,
      description: row.description ?? null,
      completed: row.completed,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      scheduledDate: row.scheduledDate ? new Date(row.scheduledDate) : null,
      priority: row.priority,
      status:
        (row.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE') ||
        (row.completed ? 'DONE' : 'NOT_STARTED'),
      originalInput: row.originalInput ?? null,
      cleanTitle: row.cleanTitle ?? null,
      taskListId: row.taskListId,
    } as TaskEntity;
  }

  protected async enrichEntities(
    entities: TaskEntity[],
    context?: ServiceContext
  ): Promise<TaskEntity[]> {
    if (entities.length === 0) return entities;
    const taskIds = entities.map((t) => t.id);
    const listIds = Array.from(new Set(entities.map((t) => t.taskListId)));

    // Task lists - use cache to reduce queries (task lists rarely change)
    const userId = context?.userId || '';
    const cacheKey = createCacheKey('task-lists', userId);

    const listMap = new Map<
      string,
      { id: string; name: string; color: string }
    >();

    // Try to get all task lists from cache
    const cachedLists = taskListCache.get(cacheKey);

    if (cachedLists) {
      // Use cached data - filter to only the lists we need
      cachedLists
        .filter((list) => listIds.includes(list.id))
        .forEach((list) =>
          listMap.set(list.id, {
            id: list.id,
            name: list.name,
            color: list.color,
          })
        );
    } else {
      // Cache miss - fetch all user's task lists and cache them
      type TaskListRow = {
        id: string;
        name: string;
        color: string;
        icon?: string | null;
        description?: string | null;
      };
      const allListsRes = await query<TaskListRow>(
        `SELECT id, name, color, icon, description FROM "task_lists" WHERE "userId" = $1`,
        [userId],
        this.db
      );

      // Cache all user's task lists for future use
      taskListCache.set(cacheKey, allListsRes.rows);

      // Build map for current tasks
      allListsRes.rows
        .filter((row) => listIds.includes(row.id))
        .forEach((row) =>
          listMap.set(row.id, { id: row.id, name: row.name, color: row.color })
        );
    }

    // Attachments
    const taskPlaceholders = taskIds.map((_, i) => `$${i + 1}`).join(',');
    const attachmentsRes = await query<AttachmentRow>(
      `SELECT id, "fileName", "fileUrl", "fileType", "fileSize", "taskId", "createdAt", "thumbnailUrl"
       FROM attachments WHERE "taskId" IN (${taskPlaceholders})`,
      taskIds,
      this.db
    );
    interface AttachmentRow {
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
      taskId: string;
      createdAt: Date;
      thumbnailUrl?: string;
    }
    const attachmentsByTask = new Map<
      string,
      Omit<AttachmentRow, 'taskId'>[]
    >();
    attachmentsRes.rows.forEach((row) => {
      const arr = attachmentsByTask.get(row.taskId) || [];
      arr.push({
        id: row.id,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        fileType: row.fileType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
        thumbnailUrl: row.thumbnailUrl,
      });
      attachmentsByTask.set(row.taskId, arr);
    });

    // Tags with tag details
    const tagsRes = await query<TagRow>(
      `SELECT tt."taskId", tt.value, tt."displayText", tt."iconName", t.id as tag_id, t.name, t.type, t.color
       FROM "task_tags" tt
       JOIN tags t ON t.id = tt."tagId"
       WHERE tt."taskId" IN (${taskPlaceholders})`,
      taskIds,
      this.db
    );
    interface TagRow {
      taskId: string;
      value: string;
      displayText: string;
      iconName: string;
      tag_id: string;
      name: string;
      type: string;
      color: string | null;
    }
    type TaskTagRelation = {
      id: string;
      value: string;
      displayText: string;
      iconName: string;
      tag: { id: string; name: string; type: string; color: string | null };
    };
    const tagsByTask = new Map<string, TaskTagRelation[]>();
    tagsRes.rows.forEach((row) => {
      const arr = tagsByTask.get(row.taskId) || [];
      arr.push({
        id: row.tag_id,
        value: row.value,
        displayText: row.displayText,
        iconName: row.iconName,
        tag: {
          id: row.tag_id,
          name: row.name,
          type: row.type,
          color: row.color,
        },
      });
      tagsByTask.set(row.taskId, arr);
    });

    // Attach relations onto entities
    return entities.map((t) => ({
      ...t,
      taskList: listMap.get(t.taskListId) || undefined,
      attachments: attachmentsByTask.get(t.id) || [],
      tags: tagsByTask.get(t.id) || [],
    }));
  }

  async findAll(
    filters: TaskFilters = {},
    context?: ServiceContext
  ): Promise<TaskEntity[]> {
    try {
      this.log('findAll', { filters }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const order = this.buildOrderByClause(filters);
      // Hard guardrail: findAll powers findByTaskList/search/findOverdue/
      // findByScheduledDate, none of which pass a LIMIT. Cap the row count so a
      // heavy account can't materialize (and enrich) its entire task history in
      // one request. The bound is generous enough not to truncate real views;
      // paginated reads go through findPaginated.
      params.push(MAX_FIND_ALL_ROWS);
      const res = await query<TaskRow>(
        `SELECT * FROM tasks ${sql} ${order} LIMIT $${params.length}`,
        params,
        this.db
      );
      const base = res.rows.map((row) => this.transformEntity(row)); // Database row
      return await this.enrichEntities(base, context);
    } catch (error) {
      this.log(
        'findAll:error',
        { error: (error as Error).message, filters },
        context
      );
      throw error;
    }
  }

  /**
   * Override: findPaginated with sorting support
   */
  async findPaginated(
    filters: TaskFilters = {},
    page: number = 1,
    limit: number = 20,
    context?: ServiceContext
  ): Promise<{
    data: TaskEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      this.log('findPaginated', { filters, page, limit }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const order = this.buildOrderByClause(filters);
      const offset = (page - 1) * limit;
      const dataRes = await query<TaskRow>(
        `SELECT * FROM tasks ${sql} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
        this.db
      );
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*)::bigint AS count FROM tasks ${sql}`,
        params,
        this.db
      );
      const rows = dataRes.rows.map((row) => this.transformEntity(row)); // Database row
      const enriched = await this.enrichEntities(rows, context);
      const total = Number(countRes.rows[0]?.count || 0);
      return {
        data: enriched,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.log(
        'findPaginated:error',
        { error: (error as Error).message, filters, page, limit },
        context
      );
      throw error;
    }
  }

  /**
   * Validate task creation
   */
  protected async validateCreate(
    data: CreateTaskDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (!data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Title is required');
    }

    // Validate task list exists and user owns it
    if (data.taskListId && context?.userId) {
      const taskList = await query(
        'SELECT id FROM "task_lists" WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [data.taskListId, context.userId],
        this.db
      );

      if (taskList.rowCount === 0) {
        throw new Error(
          'VALIDATION_ERROR: Task list not found or access denied'
        );
      }
    }
  }

  /**
   * Validate task updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateTaskDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (data.title !== undefined && !data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Title cannot be empty');
    }

    if (context?.userId) {
      const hasAccess = await this.checkOwnership(id, context.userId);
      if (!hasAccess) {
        throw new Error('AUTHORIZATION_ERROR: Access denied');
      }
    }

    // Validate task list if being updated
    if (data.taskListId && context?.userId) {
      const taskList = await query(
        'SELECT id FROM "task_lists" WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [data.taskListId, context.userId],
        this.db
      );
      if (taskList.rowCount === 0) {
        throw new Error(
          'VALIDATION_ERROR: Task list not found or access denied'
        );
      }
    }
  }

  /**
   * Create task with tags and default task list handling
   */
  async create(
    data: CreateTaskDTO,
    context?: ServiceContext
  ): Promise<TaskEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);
      await this.ensureUserExists(context?.userId);
      await this.ensureStatusColumnExists();

      // Get or create default task list if none specified
      let taskListId = data.taskListId;
      if (!taskListId && context?.userId) {
        const defaultTaskList = await this.getOrCreateDefaultTaskList(
          context.userId
        );
        taskListId = defaultTaskList.id;
      }

      const created = await withTransaction(async (client) => {
        // Insert task
        const insertRes = await query<TaskRow>(
          `INSERT INTO tasks (id, title, description, completed, status, "taskListId", "scheduledDate", priority, "originalInput", "cleanTitle", "userId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, false, 'NOT_STARTED', $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [
            data.title.trim(),
            data.description?.trim() || null,
            taskListId!,
            data.scheduledDate ?? null,
            data.priority || 'MEDIUM',
            data.originalInput ?? null,
            data.cleanTitle ?? null,
            context!.userId!,
          ],
          client
        );
        const createdRow = insertRes.rows[0];

        // Tags
        if (data.tags && data.tags.length > 0) {
          for (const tagData of data.tags) {
            const name = tagData.name.trim().toLowerCase();
            // Upsert and read the id in one round-trip. DO UPDATE (not DO
            // NOTHING) so RETURNING yields the row's id even on conflict,
            // removing the follow-up SELECT.
            const tagRow = await query<{ id: string }>(
              `INSERT INTO tags (id, name, type, color) VALUES (gen_random_uuid()::text, $1, $2, $3)
               ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [name, tagData.type, tagData.color ?? null],
              client
            );
            const tagId = tagRow.rows[0].id;
            await query(
              `INSERT INTO "task_tags" ("taskId", "tagId", value, "displayText", "iconName")
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT ("taskId", "tagId") DO NOTHING`,
              [
                createdRow.id,
                tagId,
                tagData.value,
                tagData.displayText,
                tagData.iconName,
              ],
              client
            );
          }
        }
        return createdRow;
      });

      this.log('create:success', { id: created.id }, context);
      const entity = this.transformEntity(created);
      const [enriched] = await this.enrichEntities([entity], context);
      return enriched;
    } catch (error) {
      this.log(
        'create:error',
        { error: (error as Error).message, data },
        context
      );
      throw error;
    }
  }

  /**
   * Update task
   */
  async update(
    id: string,
    data: UpdateTaskDTO,
    context?: ServiceContext
  ): Promise<TaskEntity | null> {
    await this.ensureStatusColumnExists();
    await this.validateUpdate(id, data, context);
    const sets: string[] = [];
    const params: Array<string | boolean | Date | null> = []; // Mixed types for SQL parameters
    if (data.title !== undefined) {
      params.push(data.title.trim());
      sets.push(`title = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description?.trim() || null);
      sets.push(`description = $${params.length}`);
    }
    if (data.completed !== undefined) {
      params.push(data.completed);
      sets.push(`completed = $${params.length}`);
      params.push(data.completed ? new Date() : null);
      sets.push(`"completedAt" = $${params.length}`);
      if (data.status === undefined) {
        const impliedStatus = data.completed ? 'DONE' : 'NOT_STARTED';
        params.push(impliedStatus);
        sets.push(`status = $${params.length}`);
      }
    }
    if (data.status !== undefined) {
      // Normalize completed based on status unless explicitly provided
      const isDone = data.status === 'DONE';
      params.push(data.status);
      sets.push(`status = $${params.length}`);
      if (data.completed === undefined) {
        params.push(isDone);
        sets.push(`completed = $${params.length}`);
        params.push(isDone ? new Date() : null);
        sets.push(`"completedAt" = $${params.length}`);
      }
    }
    if (data.scheduledDate !== undefined) {
      params.push(data.scheduledDate);
      sets.push(`"scheduledDate" = $${params.length}`);
    }
    if (data.priority !== undefined) {
      params.push(data.priority);
      sets.push(`priority = $${params.length}`);
    }
    if (data.taskListId !== undefined) {
      params.push(data.taskListId);
      sets.push(`"taskListId" = $${params.length}`);
    }
    if (data.originalInput !== undefined) {
      params.push(data.originalInput);
      sets.push(`"originalInput" = $${params.length}`);
    }
    if (data.cleanTitle !== undefined) {
      params.push(data.cleanTitle);
      sets.push(`"cleanTitle" = $${params.length}`);
    }
    params.push(new Date());
    sets.push(`"updatedAt" = $${params.length}`);
    params.push(id);
    const updateSql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;

    // Run the scalar column update and any tag-set replacement atomically, so a
    // failure mid-way can't leave tags half-rewritten.
    const updatedRow = await withTransaction(async (client) => {
      const res = await query<TaskRow>(updateSql, params, client);
      if (res.rowCount === 0) return null;

      // `tags`, when present, replaces the whole tag set (the frontend sends the
      // desired remaining tags). Mirrors the find-or-create logic in create().
      if (data.tags !== undefined) {
        await query(
          `DELETE FROM "task_tags" WHERE "taskId" = $1`,
          [id],
          client
        );
        for (const tagData of data.tags) {
          const name = (tagData.name ?? tagData.value).trim().toLowerCase();
          if (!name) continue;
          const type = String(tagData.type).toUpperCase();
          // Upsert + read the id in one round-trip (see create()).
          const tagRow = await query<{ id: string }>(
            `INSERT INTO tags (id, name, type, color) VALUES (gen_random_uuid()::text, $1, $2, $3)
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [name, type, tagData.color ?? null],
            client
          );
          const tagId = tagRow.rows[0].id;
          await query(
            `INSERT INTO "task_tags" ("taskId", "tagId", value, "displayText", "iconName")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT ("taskId", "tagId") DO NOTHING`,
            [id, tagId, tagData.value, tagData.displayText, tagData.iconName],
            client
          );
        }
      }
      return res.rows[0];
    });

    if (!updatedRow) return null;
    const base = this.transformEntity(updatedRow);
    const [enriched] = await this.enrichEntities([base], context);
    return enriched;
  }

  /**
   * Delete task
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    // Capture attachment blob URLs before the ON DELETE CASCADE removes the
    // rows, so the underlying files can be cleaned up afterwards.
    const blobUrls = await this.collectAttachmentBlobUrls([id]);
    // Owner-scope the delete so one authenticated user cannot delete another
    // user's task just by knowing its id (#62 IDOR). A cross-user (or missing)
    // id matches zero rows, so we return false → the handler responds 404.
    const { sql, params } = this.ownerScopedWhere(id, context);
    const res = await query(`DELETE FROM tasks ${sql}`, params, this.db);
    const deleted = (res.rowCount ?? 0) > 0;
    if (deleted) await deleteBlobs(blobUrls);
    return deleted;
  }

  /**
   * Collect the fileUrl/thumbnailUrl of every attachment belonging to the
   * given tasks. Failures are swallowed so blob bookkeeping never blocks the
   * task delete itself.
   */
  private async collectAttachmentBlobUrls(
    taskIds: string[]
  ): Promise<Array<string | null>> {
    if (taskIds.length === 0) return [];
    try {
      const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(',');
      const res = await query<{ fileUrl: string; thumbnailUrl: string | null }>(
        `SELECT "fileUrl", "thumbnailUrl" FROM attachments WHERE "taskId" IN (${placeholders})`,
        taskIds,
        this.db
      );
      return res.rows.flatMap((r) => [r.fileUrl, r.thumbnailUrl]);
    } catch {
      return [];
    }
  }

  /**
   * Find task by id with relations
   */
  async findById(
    id: string,
    context?: ServiceContext
  ): Promise<TaskEntity | null> {
    // Owner-scope the read so one user cannot fetch another user's task by id
    // (#62 IDOR). A cross-user id matches zero rows → returns null → 404.
    const { sql, params } = this.ownerScopedWhere(id, context);
    const res = await query<TaskRow>(
      `SELECT * FROM tasks ${sql} LIMIT 1`,
      params,
      this.db
    );
    if (res.rowCount === 0) return null;
    const base = this.transformEntity(res.rows[0]);
    const [enriched] = await this.enrichEntities([base], context);
    return enriched ?? base;
  }

  /**
   * Toggle task completion status
   */
  async toggleCompletion(
    id: string,
    context?: ServiceContext
  ): Promise<TaskEntity> {
    try {
      this.log('toggleCompletion', { id }, context);
      await this.ensureStatusColumnExists();

      // Flip completion atomically in a single owner-scoped statement. This
      // removes the lost-update race of the old read-then-write (two concurrent
      // toggles no longer clobber each other) and the redundant ownership +
      // current-value SELECTs on the app's most frequent write. Column refs on
      // the right-hand side of SET see the pre-update row, so `NOT completed`
      // flips the flag and the CASEs derive status/completedAt from the old
      // value. Zero rows means not-found-or-not-owned.
      const params: unknown[] = [id];
      let where = 'WHERE id = $1';
      if (context?.userId) {
        params.push(context.userId);
        where += ` AND "userId" = $${params.length}`;
      }
      const updatedRes = await query<TaskRow>(
        `UPDATE tasks
         SET completed = NOT completed,
             status = CASE WHEN completed THEN 'NOT_STARTED' ELSE 'DONE' END,
             "completedAt" = CASE WHEN completed THEN NULL ELSE NOW() END,
             "updatedAt" = NOW()
         ${where}
         RETURNING *`,
        params,
        this.db
      );
      if (updatedRes.rowCount === 0) {
        // With an owner scope, zero rows is not-found-OR-not-owned: deny with
        // the same 403 the update path returns (#62/#67) instead of leaking
        // whether the id exists. Unscoped, it can only be genuinely missing.
        throw new Error(
          context?.userId
            ? 'AUTHORIZATION_ERROR: Access denied'
            : 'NOT_FOUND: Task not found'
        );
      }
      const base = this.transformEntity(updatedRes.rows[0]);
      const [enriched] = await this.enrichEntities([base], context);
      this.log(
        'toggleCompletion:success',
        { id, completed: enriched.completed },
        context
      );
      return enriched;
    } catch (error) {
      this.log(
        'toggleCompletion:error',
        { error: (error as Error).message, id },
        context
      );
      throw error;
    }
  }

  /**
   * Find tasks by task list
   */
  async findByTaskList(
    taskListId: string,
    context?: ServiceContext
  ): Promise<TaskEntity[]> {
    const filters: TaskFilters = { taskListId };
    return await this.findAll(filters, context);
  }

  /**
   * Find tasks by scheduled date
   */
  async findByScheduledDate(
    date: Date,
    context?: ServiceContext
  ): Promise<TaskEntity[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const filters: TaskFilters = {
      scheduledDate: {
        from: startOfDay,
        to: endOfDay,
      },
    };

    return await this.findAll(filters, context);
  }

  /**
   * Find overdue tasks
   */
  async findOverdue(context?: ServiceContext): Promise<TaskEntity[]> {
    const filters: TaskFilters = { overdue: true };
    return await this.findAll(filters, context);
  }

  /**
   * Search tasks by query
   */
  async search(query: string, context?: ServiceContext): Promise<TaskEntity[]> {
    const filters: TaskFilters = { search: query };
    return await this.findAll(filters, context);
  }

  /**
   * Bulk update tasks
   */
  async bulkUpdate(
    ids: string[],
    updates: Partial<UpdateTaskDTO>,
    context?: ServiceContext
  ): Promise<TaskEntity[]> {
    try {
      this.log('bulkUpdate', { ids, updates }, context);
      await this.ensureStatusColumnExists();

      // Validate all tasks belong to user
      if (context?.userId) {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const userTasksRes = await query<{ id: string }>(
          `SELECT id FROM tasks WHERE id IN (${placeholders}) AND "userId" = $${ids.length + 1}`,
          [...ids, context.userId],
          this.db
        );

        if (userTasksRes.rowCount !== ids.length) {
          throw new Error(
            'AUTHORIZATION_ERROR: Some tasks not found or access denied'
          );
        }
      }

      // Perform bulk update
      const setClauses: string[] = [];
      const params: Array<string | boolean | Date | null> = []; // Mixed types for SQL parameters
      if (updates.title !== undefined) {
        params.push(updates.title);
        setClauses.push(`title = $${params.length}`);
      }
      if (updates.completed !== undefined) {
        // Keep completed/status/completedAt consistent the way single-row
        // update() does, so bulk-completed tasks don't drift out of sync (stats
        // and status-based UI key off completedAt/status).
        params.push(updates.completed);
        setClauses.push(`completed = $${params.length}`);
        params.push(updates.completed ? new Date() : null);
        setClauses.push(`"completedAt" = $${params.length}`);
        params.push(updates.completed ? 'DONE' : 'NOT_STARTED');
        setClauses.push(`status = $${params.length}`);
      }
      if (updates.scheduledDate !== undefined) {
        params.push(updates.scheduledDate);
        setClauses.push(`"scheduledDate" = $${params.length}`);
      }
      if (updates.priority !== undefined) {
        params.push(updates.priority);
        setClauses.push(`priority = $${params.length}`);
      }
      if (updates.taskListId !== undefined) {
        params.push(updates.taskListId);
        setClauses.push(`"taskListId" = $${params.length}`);
      }
      if (updates.originalInput !== undefined) {
        params.push(updates.originalInput);
        setClauses.push(`"originalInput" = $${params.length}`);
      }
      if (updates.cleanTitle !== undefined) {
        params.push(updates.cleanTitle);
        setClauses.push(`"cleanTitle" = $${params.length}`);
      }
      params.push(new Date());
      setClauses.push(`"updatedAt" = $${params.length}`);
      const idPlaceholders = ids
        .map((_, i) => `$${params.length + i + 1}`)
        .join(',');
      const whereParams = [...params, ...ids];
      await query(
        `UPDATE tasks SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders})`,
        whereParams,
        this.db
      );

      // Return updated tasks
      const selectRes = await query<TaskRow>(
        `SELECT * FROM tasks WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
        ids,
        this.db
      );
      const base = selectRes.rows.map((row) => this.transformEntity(row)); // Database row
      const updatedTasks = await this.enrichEntities(base, context);

      this.log('bulkUpdate:success', { count: updatedTasks.length }, context);
      // enrichEntities already returns fully-formed, transformed entities with
      // relations attached. Re-running transformEntity here would strip
      // taskList/tags/attachments, so return the enriched list directly.
      return updatedTasks;
    } catch (error) {
      this.log(
        'bulkUpdate:error',
        { error: (error as Error).message, ids, updates },
        context
      );
      throw error;
    }
  }

  /**
   * Bulk delete tasks
   */
  async bulkDelete(ids: string[], context?: ServiceContext): Promise<void> {
    try {
      this.log('bulkDelete', { ids }, context);

      // Validate all tasks belong to user
      if (context?.userId) {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const userTasksRes = await query<{ id: string }>(
          `SELECT id FROM tasks WHERE id IN (${placeholders}) AND "userId" = $${ids.length + 1}`,
          [...ids, context.userId],
          this.db
        );
        if (userTasksRes.rowCount !== ids.length) {
          throw new Error(
            'AUTHORIZATION_ERROR: Some tasks not found or access denied'
          );
        }
      }

      // Capture attachment blob URLs before the cascade removes the rows.
      const blobUrls = await this.collectAttachmentBlobUrls(ids);

      // Perform bulk delete (cascade will handle tags and attachments)
      await query(
        `DELETE FROM tasks WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
        ids,
        this.db
      );

      // Clean up the underlying attachment blobs for the deleted tasks.
      await deleteBlobs(blobUrls);

      this.log('bulkDelete:success', { count: ids.length }, context);
    } catch (error) {
      this.log(
        'bulkDelete:error',
        { error: (error as Error).message, ids },
        context
      );
      throw error;
    }
  }

  /**
   * Get task statistics for user
   */
  async getStats(context?: ServiceContext): Promise<TaskStats> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // One aggregate over a single table scan instead of six separate COUNT
    // round-trips (each consuming a pool connection) on every dashboard load.
    const statsRes = await query<{
      total: string;
      completed: string;
      overdue: string;
      today: string;
      week: string;
      month: string;
    }>(
      `SELECT
         COUNT(*)::bigint AS total,
         COUNT(*) FILTER (WHERE completed)::bigint AS completed,
         COUNT(*) FILTER (WHERE NOT completed AND "scheduledDate" < NOW())::bigint AS overdue,
         COUNT(*) FILTER (WHERE completed AND "completedAt" >= $2)::bigint AS today,
         COUNT(*) FILTER (WHERE completed AND "completedAt" >= $3)::bigint AS week,
         COUNT(*) FILTER (WHERE completed AND "completedAt" >= $4)::bigint AS month
       FROM tasks WHERE "userId" = $1`,
      [context.userId!, startOfDay, startOfWeek, startOfMonth],
      this.db
    );
    const row = statsRes.rows[0];
    const total = Number(row.total);
    const completed = Number(row.completed);

    return {
      total,
      completed,
      pending: total - completed,
      overdue: Number(row.overdue),
      completedToday: Number(row.today),
      completedThisWeek: Number(row.week),
      completedThisMonth: Number(row.month),
    };
  }

  /**
   * Get or create default task list for user
   */
  private async getOrCreateDefaultTaskList(
    userId: string
  ): Promise<{ id: string; name: string; color: string }> {
    await this.ensureUserExists(userId);
    const existing = await query<{ id: string; name: string; color: string }>(
      `SELECT id, name, color FROM "task_lists" WHERE "userId" = $1 AND name = 'General' LIMIT 1`,
      [userId],
      this.db
    );
    if ((existing.rowCount ?? 0) > 0) return existing.rows[0];
    const created = await query<{ id: string; name: string; color: string }>(
      `INSERT INTO "task_lists" (id, name, color, "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, 'General', '#8B5CF6', $1, NOW(), NOW()) RETURNING id, name, color`,
      [userId],
      this.db
    );
    // The task-list cache (keyed by user) may have been warmed before this
    // auto-created default existed. Invalidate it — the same call the
    // TaskListService write paths make — so enrichEntities doesn't return the
    // new list's tasks with taskList: undefined until the TTL expires.
    taskListCache.invalidate(createCacheKey('task-lists', userId));
    return created.rows[0];
  }
}
