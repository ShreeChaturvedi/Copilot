/**
 * TaskList Service - Concrete implementation of BaseService for TaskList operations
 */
import { BaseService, type ServiceContext, type UserOwnedEntity } from './BaseService';

/**
 * TaskList entity interface extending base
 */
export interface TaskListEntity extends UserOwnedEntity {
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  
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
export class TaskListService extends BaseService<TaskListEntity, CreateTaskListDTO, UpdateTaskListDTO, TaskListFilters> {
  protected getModel() {
    return this.prisma.taskList;
  }

  protected getEntityName(): string {
    return 'TaskList';
  }

  protected buildWhereClause(filters: TaskListFilters, context?: ServiceContext): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Always filter by user
    if (context?.userId) {
      where.userId = context.userId;
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filter for task lists with active tasks
    if (filters.hasActiveTasks) {
      where.tasks = {
        some: {
          completed: false,
        },
      };
    }

    return where;
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
   * Validate task list creation
   */
  protected async validateCreate(data: CreateTaskListDTO, context?: ServiceContext): Promise<void> {
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Task list name is required');
    }

    // Check for duplicate task list name for the user
    if (context?.userId) {
      const existingTaskList = await this.prisma.taskList.findFirst({
        where: {
          name: data.name.trim(),
          userId: context.userId,
        },
      });

      if (existingTaskList) {
        throw new Error('VALIDATION_ERROR: Task list name already exists');
      }
    }

    // Validate color format (basic hex color validation)
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
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
      const existingTaskList = await this.prisma.taskList.findFirst({
        where: {
          name: data.name.trim(),
          userId: context.userId,
          id: { not: id }, // Exclude current task list
        },
      });

      if (existingTaskList) {
        throw new Error('VALIDATION_ERROR: Task list name already exists');
      }
    }

    // Validate color format if provided
    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
      throw new Error('VALIDATION_ERROR: Invalid color format. Use hex format (#RRGGBB)');
    }
  }

  /**
   * Create task list with proper defaults
   */
  async create(data: CreateTaskListDTO, context?: ServiceContext): Promise<TaskListEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      const createData: Record<string, unknown> = {
        name: data.name.trim(),
        color: data.color,
        icon: data.icon || null,
        description: data.description?.trim() || null,
        userId: context?.userId,
      };

      const result = await this.getModel().create({
        data: createData,
        include: this.buildIncludeClause(),
      });

      this.log('create:success', { id: result.id }, context);
      return this.transformEntity(result);
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
      let defaultTaskList = await this.getModel().findFirst({
        where: {
          userId: context.userId,
          name: 'General',
        },
        include: this.buildIncludeClause(),
      });

      // If no "General" list, get the first task list
      if (!defaultTaskList) {
        defaultTaskList = await this.getModel().findFirst({
          where: { userId: context.userId },
          include: this.buildIncludeClause(),
          orderBy: { createdAt: 'asc' },
        });
      }

      // If no task lists exist, create a default one
      if (!defaultTaskList) {
        defaultTaskList = await this.create(
          {
            name: 'General',
            color: '#8B5CF6',
            description: 'Default task list',
          },
          context
        );
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
  async getWithTaskCount(context?: ServiceContext): Promise<TaskListWithCounts[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getWithTaskCount', {}, context);

      const taskLists = await this.getModel().findMany({
        where: { userId: context.userId },
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
          tasks: {
            select: {
              id: true,
              completed: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const results: TaskListWithCounts[] = taskLists.map((taskList) => {
        const completedTaskCount = taskList.tasks.filter((task) => task.completed).length;
        const totalTaskCount = taskList.tasks.length;

        return {
          ...this.transformEntity(taskList),
          taskCount: totalTaskCount,
          completedTaskCount,
          pendingTaskCount: totalTaskCount - completedTaskCount,
        };
      });

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

      const taskLists = await this.getModel().findMany({
        where: { userId: context.userId },
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              completed: true,
              scheduledDate: true,
              priority: true,
            },
            orderBy: [
              { completed: 'asc' },
              { scheduledDate: 'asc' },
              { createdAt: 'desc' },
            ],
            take: 10, // Limit to recent tasks to avoid performance issues
          },
        },
        orderBy: { name: 'asc' },
      });

      const results = taskLists.map((taskList) => this.transformEntity(taskList));

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
  async reorder(taskListIds: string[], context?: ServiceContext): Promise<TaskListEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('reorder', { taskListIds }, context);

      // Validate all task lists belong to user
      const userTaskLists = await this.getModel().findMany({
        where: {
          id: { in: taskListIds },
          userId: context.userId,
        },
      });

      if (userTaskLists.length !== taskListIds.length) {
        throw new Error('VALIDATION_ERROR: Some task lists not found or access denied');
      }

      // For now, just return the task lists in the requested order
      // In a full implementation, you might add an `order` field to the database
      const orderedTaskLists = await Promise.all(
        taskListIds.map(async (id) => {
          const taskList = await this.getModel().findUnique({
            where: { id },
            include: this.buildIncludeClause(),
          });
          return taskList;
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
          await this.prisma.task.updateMany({
            where: {
              taskListId: id,
              userId: context.userId,
            },
            data: {
              taskListId: defaultTaskList.id,
            },
          });
        }
      }

      // Delete the task list
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

      const [totalLists, totalTasks, completedTasks] = await Promise.all([
        this.getModel().count({ where: { userId: context.userId } }),
        this.prisma.task.count({ where: { userId: context.userId } }),
        this.prisma.task.count({ 
          where: { 
            userId: context.userId,
            completed: true,
          },
        }),
      ]);

      const pendingTasks = totalTasks - completedTasks;
      const averageTasksPerList = totalLists > 0 ? Math.round((totalTasks / totalLists) * 100) / 100 : 0;

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
    throw new Error('NOT_IMPLEMENTED: Archive functionality not yet implemented');
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