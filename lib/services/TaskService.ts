/**
 * Task Service - Concrete implementation of BaseService for Task operations
 */
import type { PrismaClient, Task, Priority } from '@prisma/client';
import { BaseService, type ServiceContext, type UserOwnedEntity } from './BaseService';

/**
 * Task entity interface extending base
 */
export interface TaskEntity extends UserOwnedEntity {
  title: string;
  completed: boolean;
  completedAt: Date | null;
  scheduledDate: Date | null;
  priority: Priority;
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

/**
 * Task creation DTO
 */
export interface CreateTaskDTO {
  title: string;
  taskListId?: string;
  scheduledDate?: Date;
  priority?: Priority;
  originalInput?: string;
  cleanTitle?: string;
  tags?: Array<{
    type: string;
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
  completed?: boolean;
  scheduledDate?: Date;
  priority?: Priority;
  taskListId?: string;
  originalInput?: string;
  cleanTitle?: string;
}

/**
 * Task filters interface
 */
export interface TaskFilters {
  completed?: boolean;
  taskListId?: string;
  priority?: Priority;
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
export class TaskService extends BaseService<TaskEntity, CreateTaskDTO, UpdateTaskDTO, TaskFilters> {
  private tagService?: any; // Will be injected via dependency injection

  protected getModel() {
    return this.prisma.task;
  }

  protected getEntityName(): string {
    return 'Task';
  }

  protected buildWhereClause(filters: TaskFilters, context?: ServiceContext): any {
    const where: any = {};

    // Always filter by user
    if (context?.userId) {
      where.userId = context.userId;
    }

    // Completion filter
    if (filters.completed !== undefined) {
      where.completed = filters.completed;
    }

    // Task list filter
    if (filters.taskListId) {
      where.taskListId = filters.taskListId;
    }

    // Priority filter
    if (filters.priority) {
      where.priority = filters.priority;
    }

    // Scheduled date filter
    if (filters.scheduledDate) {
      where.scheduledDate = {};
      if (filters.scheduledDate.from) {
        where.scheduledDate.gte = filters.scheduledDate.from;
      }
      if (filters.scheduledDate.to) {
        where.scheduledDate.lte = filters.scheduledDate.to;
      }
    }

    // Search filter (title or clean title)
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { cleanTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: filters.tags }
          }
        }
      };
    }

    // Overdue filter
    if (filters.overdue) {
      where.scheduledDate = {
        lt: new Date(),
      };
      where.completed = false;
    }

    return where;
  }

  protected buildIncludeClause(): any {
    return {
      taskList: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      attachments: true,
    };
  }

  /**
   * Build Prisma orderBy clause from filters
   */
  private buildOrderByClause(filters: TaskFilters): any {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    // Prisma orderBy for single field
    return { [sortBy]: sortOrder };
  }

  /**
   * Override: findAll with sorting support
   */
  async findAll(filters: TaskFilters = {}, context?: ServiceContext): Promise<TaskEntity[]> {
    try {
      this.log('findAll', { filters }, context);

      const where = this.buildWhereClause(filters, context);
      const include = this.buildIncludeClause();
      const orderBy = this.buildOrderByClause(filters);

      const tasks = await this.getModel().findMany({ where, include, orderBy });
      return tasks.map((task: any) => this.transformEntity(task));
    } catch (error) {
      this.log('findAll:error', { error: (error as Error).message, filters }, context);
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
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    try {
      this.log('findPaginated', { filters, page, limit }, context);

      const where = this.buildWhereClause(filters, context);
      const include = this.buildIncludeClause();
      const orderBy = this.buildOrderByClause(filters);
      const offset = (page - 1) * limit;

      const [entities, total] = await Promise.all([
        this.getModel().findMany({ where, include, skip: offset, take: limit, orderBy }),
        this.getModel().count({ where }),
      ]);

      return {
        data: entities.map((task: any) => this.transformEntity(task)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.log('findPaginated:error', { error: (error as Error).message, filters, page, limit }, context);
      throw error;
    }
  }

  /**
   * Validate task creation
   */
  protected async validateCreate(data: CreateTaskDTO, context?: ServiceContext): Promise<void> {
    if (!data.title?.trim()) {
      throw new Error('VALIDATION_ERROR: Title is required');
    }

    // Validate task list exists and user owns it
    if (data.taskListId && context?.userId) {
      const taskList = await this.prisma.taskList.findFirst({
        where: {
          id: data.taskListId,
          userId: context.userId,
        },
      });

      if (!taskList) {
        throw new Error('VALIDATION_ERROR: Task list not found or access denied');
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
      const taskList = await this.prisma.taskList.findFirst({
        where: {
          id: data.taskListId,
          userId: context.userId,
        },
      });

      if (!taskList) {
        throw new Error('VALIDATION_ERROR: Task list not found or access denied');
      }
    }
  }

  /**
   * Create task with tags and default task list handling
   */
  async create(data: CreateTaskDTO, context?: ServiceContext): Promise<TaskEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      // Get or create default task list if none specified
      let taskListId = data.taskListId;
      if (!taskListId && context?.userId) {
        const defaultTaskList = await this.getOrCreateDefaultTaskList(context.userId);
        taskListId = defaultTaskList.id;
      }

      const createData: any = {
        title: data.title.trim(),
        taskListId,
        scheduledDate: data.scheduledDate,
        priority: data.priority || 'MEDIUM',
        originalInput: data.originalInput,
        cleanTitle: data.cleanTitle,
        userId: context?.userId,
      };

      // Create task with tags in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the task
        const task = await tx.task.create({
          data: createData,
          include: this.buildIncludeClause(),
        });

        // Create tags if provided
        if (data.tags && data.tags.length > 0) {
          for (const tagData of data.tags) {
            // Find or create tag
            const tag = await tx.tag.upsert({
              where: { name: tagData.name },
              create: {
                name: tagData.name,
                type: tagData.type as any,
                color: tagData.color,
              },
              update: {},
            });

            // Create task-tag relationship
            await tx.taskTag.create({
              data: {
                taskId: task.id,
                tagId: tag.id,
                value: tagData.value,
                displayText: tagData.displayText,
                iconName: tagData.iconName,
              },
            });
          }

          // Fetch the complete task with all relations
          return await tx.task.findUnique({
            where: { id: task.id },
            include: this.buildIncludeClause(),
          });
        }

        return task;
      });

      this.log('create:success', { id: result?.id }, context);
      return this.transformEntity(result);
    } catch (error) {
      this.log('create:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Toggle task completion status
   */
  async toggleCompletion(id: string, context?: ServiceContext): Promise<TaskEntity> {
    try {
      this.log('toggleCompletion', { id }, context);

      if (context?.userId) {
        const hasAccess = await this.checkOwnership(id, context.userId);
        if (!hasAccess) {
          throw new Error('AUTHORIZATION_ERROR: Access denied');
        }
      }

      const currentTask = await this.getModel().findUnique({
        where: { id },
        select: { completed: true },
      });

      if (!currentTask) {
        throw new Error('NOT_FOUND: Task not found');
      }

      const updatedTask = await this.getModel().update({
        where: { id },
        data: {
          completed: !currentTask.completed,
          completedAt: !currentTask.completed ? new Date() : null,
          updatedAt: new Date(),
        },
        include: this.buildIncludeClause(),
      });

      this.log('toggleCompletion:success', { id, completed: updatedTask.completed }, context);
      return this.transformEntity(updatedTask);
    } catch (error) {
      this.log('toggleCompletion:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Find tasks by task list
   */
  async findByTaskList(taskListId: string, context?: ServiceContext): Promise<TaskEntity[]> {
    const filters: TaskFilters = { taskListId };
    return await this.findAll(filters, context);
  }

  /**
   * Find tasks by scheduled date
   */
  async findByScheduledDate(date: Date, context?: ServiceContext): Promise<TaskEntity[]> {
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

      // Validate all tasks belong to user
      if (context?.userId) {
        const userTasks = await this.getModel().findMany({
          where: {
            id: { in: ids },
            userId: context.userId,
          },
          select: { id: true },
        });

        if (userTasks.length !== ids.length) {
          throw new Error('AUTHORIZATION_ERROR: Some tasks not found or access denied');
        }
      }

      // Perform bulk update
      await this.getModel().updateMany({
        where: { id: { in: ids } },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      // Return updated tasks
      const updatedTasks = await this.getModel().findMany({
        where: { id: { in: ids } },
        include: this.buildIncludeClause(),
      });

      this.log('bulkUpdate:success', { count: updatedTasks.length }, context);
      return updatedTasks.map((task) => this.transformEntity(task));
    } catch (error) {
      this.log('bulkUpdate:error', { error: error.message, ids, updates }, context);
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
        const userTasks = await this.getModel().findMany({
          where: {
            id: { in: ids },
            userId: context.userId,
          },
          select: { id: true },
        });

        if (userTasks.length !== ids.length) {
          throw new Error('AUTHORIZATION_ERROR: Some tasks not found or access denied');
        }
      }

      // Perform bulk delete (cascade will handle tags and attachments)
      await this.getModel().deleteMany({
        where: { id: { in: ids } },
      });

      this.log('bulkDelete:success', { count: ids.length }, context);
    } catch (error) {
      this.log('bulkDelete:error', { error: error.message, ids }, context);
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

    const [
      total,
      completed,
      overdue,
      completedToday,
      completedThisWeek,
      completedThisMonth,
    ] = await Promise.all([
      this.getModel().count({ where: { userId: context.userId } }),
      this.getModel().count({ where: { userId: context.userId, completed: true } }),
      this.getModel().count({
        where: {
          userId: context.userId,
          completed: false,
          scheduledDate: { lt: now },
        },
      }),
      this.getModel().count({
        where: {
          userId: context.userId,
          completed: true,
          completedAt: { gte: startOfDay },
        },
      }),
      this.getModel().count({
        where: {
          userId: context.userId,
          completed: true,
          completedAt: { gte: startOfWeek },
        },
      }),
      this.getModel().count({
        where: {
          userId: context.userId,
          completed: true,
          completedAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      total,
      completed,
      pending: total - completed,
      overdue,
      completedToday,
      completedThisWeek,
      completedThisMonth,
    };
  }

  /**
   * Get or create default task list for user
   */
  private async getOrCreateDefaultTaskList(userId: string) {
    let defaultTaskList = await this.prisma.taskList.findFirst({
      where: { userId, name: 'General' },
    });

    if (!defaultTaskList) {
      defaultTaskList = await this.prisma.taskList.create({
        data: {
          name: 'General',
          color: '#8B5CF6',
          userId,
        },
      });
    }

    return defaultTaskList;
  }
}