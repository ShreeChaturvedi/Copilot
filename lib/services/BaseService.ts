/**
 * Base service class with common CRUD operations
 * Provides foundation for all business logic services
 */
import type { PrismaClient } from '@prisma/client';

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User-owned entity interface
 */
export interface UserOwnedEntity extends BaseEntity {
  userId: string;
}

/**
 * Service context interface
 */
export interface ServiceContext {
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Base service configuration
 */
export interface BaseServiceConfig {
  enableLogging?: boolean;
  enableCaching?: boolean;
  cacheTTL?: number;
}

/**
 * Abstract base service class
 */
export abstract class BaseService<
  TEntity extends BaseEntity = BaseEntity,
  TCreateDTO = Partial<Omit<TEntity, keyof BaseEntity>>,
  TUpdateDTO = Partial<Omit<TEntity, keyof BaseEntity>>,
  TFilters extends Record<string, unknown> = Record<string, unknown>
> {
  protected readonly config: BaseServiceConfig;

  constructor(
    protected readonly prisma: PrismaClient,
    config: BaseServiceConfig = {}
  ) {
    this.config = {
      enableLogging: true,
      enableCaching: false,
      cacheTTL: 300, // 5 minutes
      ...config,
    };
  }

  /**
   * Get the Prisma model delegate for this service
   * Must be implemented by concrete services
   */
  protected abstract getModel(): {
    findMany: (args: unknown) => Promise<TEntity[]>;
    findUnique: (args: unknown) => Promise<TEntity | null>;
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<TEntity>;
    update: (args: unknown) => Promise<TEntity>;
    delete: (args: unknown) => Promise<TEntity>;
    createMany?: (args: unknown) => Promise<{ count: number }>;
    updateMany?: (args: unknown) => Promise<{ count: number }>;
    deleteMany?: (args: unknown) => Promise<{ count: number }>;
  };

  /**
   * Get the entity name for logging and error messages
   */
  protected abstract getEntityName(): string;

  /**
   * Build where clause for filtering
   * Can be overridden by concrete services for custom filtering
   */
  protected buildWhereClause(filters: TFilters, _context?: ServiceContext): Record<string, unknown> {
    void _context;
    return filters as Record<string, unknown>;
  }

  /**
   * Build include clause for relations
   * Can be overridden by concrete services
   */
  protected buildIncludeClause(): Record<string, unknown> {
    return {};
  }

  /**
   * Transform entity before returning to client
   * Can be overridden by concrete services
   */
  protected transformEntity(entity: unknown): TEntity {
    return entity as TEntity;
  }

  /**
   * Validate create data
   * Can be overridden by concrete services
   */
  protected async validateCreate(data: TCreateDTO, context?: ServiceContext): Promise<void> {
    // Override in concrete services for validation
  }

  /**
   * Validate update data
   */
  protected async validateUpdate(
    id: string,
    data: TUpdateDTO,
    context?: ServiceContext
  ): Promise<void> {
    // Override in concrete services for validation
  }

  /**
   * Check if user owns the entity (for user-owned entities)
   */
  protected async checkOwnership(id: string, userId: string): Promise<boolean> {
    try {
      const entity = await this.getModel().findUnique({
        where: { id },
        select: { userId: true },
      });

      return entity?.userId === userId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Log service operation
   */
  protected log(operation: string, data?: Record<string, unknown>, context?: ServiceContext): void {
    if (!this.config.enableLogging) return;

    const logData = {
      service: this.constructor.name,
      entity: this.getEntityName(),
      operation,
      userId: context?.userId,
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    console.log(`[SERVICE] ${JSON.stringify(logData)}`);
  }

  /**
   * Find all entities with optional filtering
   */
  async findAll(filters: TFilters = {} as TFilters, context?: ServiceContext): Promise<TEntity[]> {
    try {
      this.log('findAll', { filters }, context);

      const whereClause = this.buildWhereClause(filters, context);
      const includeClause = this.buildIncludeClause();

      const entities = await this.getModel().findMany({
        where: whereClause,
        include: includeClause,
        orderBy: { createdAt: 'desc' },
      });

      return entities.map(entity => this.transformEntity(entity));
    } catch (error) {
      this.log('findAll:error', { error: error.message, filters }, context);
      throw error;
    }
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(
    filters: TFilters = {} as TFilters,
    page: number = 1,
    limit: number = 20,
    context?: ServiceContext
  ): Promise<{
    data: TEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      this.log('findPaginated', { filters, page, limit }, context);

      const whereClause = this.buildWhereClause(filters, context);
      const includeClause = this.buildIncludeClause();
      const offset = (page - 1) * limit;

      const [entities, total] = await Promise.all([
        this.getModel().findMany({
          where: whereClause,
          include: includeClause,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.getModel().count({ where: whereClause }),
      ]);

      return {
        data: entities.map(entity => this.transformEntity(entity)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.log('findPaginated:error', { error: error.message, filters, page, limit }, context);
      throw error;
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, context?: ServiceContext): Promise<TEntity | null> {
    try {
      this.log('findById', { id }, context);

      const includeClause = this.buildIncludeClause();

      const entity = await this.getModel().findUnique({
        where: { id },
        include: includeClause,
      });

      return entity ? this.transformEntity(entity) : null;
    } catch (error) {
      this.log('findById:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Create new entity
   */
  async create(data: TCreateDTO, context?: ServiceContext): Promise<TEntity> {
    try {
      this.log('create', { data }, context);

      await this.validateCreate(data, context);

      const includeClause = this.buildIncludeClause();

      const entity = await this.getModel().create({
        data,
        include: includeClause,
      });

      this.log('create:success', { id: entity.id }, context);
      return this.transformEntity(entity);
    } catch (error) {
      this.log('create:error', { error: error.message, data }, context);
      throw error;
    }
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: TUpdateDTO, context?: ServiceContext): Promise<TEntity | null> {
    try {
      this.log('update', { id, data }, context);

      await this.validateUpdate(id, data, context);

      const includeClause = this.buildIncludeClause();

      const entity = await this.getModel().update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: includeClause,
      });

      this.log('update:success', { id }, context);
      return this.transformEntity(entity);
    } catch (error) {
      this.log('update:error', { error: error.message, id, data }, context);
      throw error;
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      this.log('delete', { id }, context);

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
   * Check if entity exists
   */
  async exists(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      const entity = await this.getModel().findUnique({
        where: { id },
        select: { id: true },
      });

      return !!entity;
    } catch (error) {
      this.log('exists:error', { error: error.message, id }, context);
      return false;
    }
  }

  /**
   * Count entities with optional filtering
   */
  async count(filters: TFilters = {} as TFilters, context?: ServiceContext): Promise<number> {
    try {
      this.log('count', { filters }, context);

      const whereClause = this.buildWhereClause(filters, context);

      return await this.getModel().count({ where: whereClause });
    } catch (error) {
      this.log('count:error', { error: error.message, filters }, context);
      throw error;
    }
  }

  /**
   * Bulk create entities
   */
  async createMany(data: TCreateDTO[], context?: ServiceContext): Promise<{ count: number }> {
    try {
      this.log('createMany', { count: data.length }, context);

      const result = await this.getModel().createMany({
        data,
        skipDuplicates: true,
      });

      this.log('createMany:success', { count: result.count }, context);
      return result;
    } catch (error) {
      this.log('createMany:error', { error: error.message, count: data.length }, context);
      throw error;
    }
  }

  /**
   * Bulk update entities
   */
  async updateMany(
    filters: TFilters,
    data: Partial<TUpdateDTO>,
    context?: ServiceContext
  ): Promise<{ count: number }> {
    try {
      this.log('updateMany', { filters, data }, context);

      const whereClause = this.buildWhereClause(filters, context);

      const result = await this.getModel().updateMany({
        where: whereClause,
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      this.log('updateMany:success', { count: result.count }, context);
      return result;
    } catch (error) {
      this.log('updateMany:error', { error: error.message, filters, data }, context);
      throw error;
    }
  }

  /**
   * Bulk delete entities
   */
  async deleteMany(filters: TFilters, context?: ServiceContext): Promise<{ count: number }> {
    try {
      this.log('deleteMany', { filters }, context);

      const whereClause = this.buildWhereClause(filters, context);

      const result = await this.getModel().deleteMany({
        where: whereClause,
      });

      this.log('deleteMany:success', { count: result.count }, context);
      return result;
    } catch (error) {
      this.log('deleteMany:error', { error: error.message, filters }, context);
      throw error;
    }
  }
}