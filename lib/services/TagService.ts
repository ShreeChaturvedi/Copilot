/**
 * Tag Service - Concrete implementation of BaseService for Tag operations
 */
import type { PrismaClient, TagType } from '@prisma/client';
import { BaseService, type ServiceContext, type BaseEntity } from './BaseService';

/**
 * Tag entity interface extending base
 */
export interface TagEntity extends BaseEntity {
  name: string;
  type: TagType;
  color: string | null;
  
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
  protected getModel() {
    return this.prisma.tag;
  }

  protected getEntityName(): string {
    return 'Tag';
  }

  protected buildWhereClause(filters: TagFilters, _context?: ServiceContext): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Type filter
    if (filters.type) {
      where.type = filters.type;
    }

    // Search filter
    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // Filter tags that have active tasks for a specific user
    if (filters.hasActiveTasks && filters.userId) {
      where.tasks = {
        some: {
          task: {
            userId: filters.userId,
            completed: false,
          },
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
   * Validate tag creation
   */
  protected async validateCreate(data: CreateTagDTO, _context?: ServiceContext): Promise<void> {
    if (!data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Tag name is required');
    }

    // Check for duplicate tag name (tags are global, not user-specific)
    const existingTag = await this.getModel().findFirst({
      where: {
        name: data.name.trim().toLowerCase(),
      },
    });

    if (existingTag) {
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
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error('VALIDATION_ERROR: Tag name cannot be empty');
    }

    // Check for duplicate name if name is being updated
    if (data.name) {
      const existingTag = await this.getModel().findFirst({
        where: {
          name: data.name.trim().toLowerCase(),
          id: { not: id }, // Exclude current tag
        },
      });

      if (existingTag) {
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

      const createData = {
        name: data.name.trim().toLowerCase(), // Normalize to lowercase
        type: data.type,
        color: data.color || null,
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
   * Find or create tag (upsert operation)
   */
  async findOrCreate(data: CreateTagDTO, context?: ServiceContext): Promise<TagEntity> {
    try {
      this.log('findOrCreate', { data }, context);

      const normalizedName = data.name.trim().toLowerCase();

      const existingTag = await this.getModel().findFirst({
        where: { name: normalizedName },
        include: this.buildIncludeClause(),
      });

      if (existingTag) {
        this.log('findOrCreate:found', { id: existingTag.id }, context);
        return this.transformEntity(existingTag);
      }

      // Create new tag
      const result = await this.create(data, context);
      this.log('findOrCreate:created', { id: result.id }, context);
      return result;
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

      const tags = await this.getModel().findMany({
        where: {
          tasks: {
            some: {
              task: {
                userId,
              },
            },
          },
        },
        include: {
          _count: {
            select: {
              tasks: {
                where: {
                  task: {
                    userId,
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { type: 'asc' },
          { name: 'asc' },
        ],
      });

      this.log('findByUser:success', { count: tags.length }, context);
      return tags.map((tag) => this.transformEntity(tag));
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
        const task = await this.prisma.task.findFirst({
          where: {
            id: taskTagData.taskId,
            userId: context.userId,
          },
        });

        if (!task) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Create the relationship
      await this.prisma.taskTag.create({
        data: taskTagData,
      });

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
        const task = await this.prisma.task.findFirst({
          where: {
            id: taskId,
            userId: context.userId,
          },
        });

        if (!task) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      // Remove the relationship
      await this.prisma.taskTag.delete({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
      });

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
        const task = await this.prisma.task.findFirst({
          where: {
            id: taskId,
            userId: context.userId,
          },
        });

        if (!task) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      const taskTags = await this.prisma.taskTag.findMany({
        where: { taskId },
        include: {
          tag: {
            include: {
              _count: {
                select: { tasks: true },
              },
            },
          },
        },
      });

      const results = taskTags.map((taskTag) => ({
        tag: this.transformEntity(taskTag.tag),
        value: taskTag.value,
        displayText: taskTag.displayText,
        iconName: taskTag.iconName,
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
        const task = await this.prisma.task.findFirst({
          where: {
            id: taskId,
            userId: context.userId,
          },
        });

        if (!task) {
          throw new Error('VALIDATION_ERROR: Task not found or access denied');
        }
      }

      await this.prisma.taskTag.update({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
        data: updates,
      });

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

      const unusedTags = await this.getModel().findMany({
        where: {
          tasks: {
            none: {},
          },
        },
        select: { id: true },
      });

      const unusedTagIds = unusedTags.map((tag) => tag.id);

      if (unusedTagIds.length > 0) {
        await this.getModel().deleteMany({
          where: {
            id: { in: unusedTagIds },
          },
        });
      }

      this.log('cleanupUnusedTags:success', { deletedCount: unusedTagIds.length }, context);
      return { deletedCount: unusedTagIds.length };
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

      const result = await this.prisma.$transaction(async (tx) => {
        // Update all task-tag relationships to point to target tag
        await tx.taskTag.updateMany({
          where: { tagId: sourceTagId },
          data: { tagId: targetTagId },
        });

        // Delete the source tag
        await tx.tag.delete({
          where: { id: sourceTagId },
        });

        // Return the target tag
        return await tx.tag.findUnique({
          where: { id: targetTagId },
          include: this.buildIncludeClause(),
        });
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

      const [totalTags, tagsByType, mostUsedTags] = await Promise.all([
        this.getModel().count(),
        this.getModel().groupBy({
          by: ['type'],
          _count: { _all: true },
        }),
        this.getModel().findMany({
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: {
            tasks: { _count: 'desc' },
          },
          take: 10,
        }),
      ]);

      const typeStats = tagsByType.reduce((acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      }, {} as Record<TagType, number>);

      const topTags = mostUsedTags.map((tag) => ({
        tag: this.transformEntity(tag),
        usageCount: tag._count.tasks,
      }));

      const stats = {
        totalTags,
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