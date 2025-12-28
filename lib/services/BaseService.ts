/**
 * Base service class with common utilities for SQL-backed services
 * Provides foundation for all business logic services
 */
import { pool, query, type SqlClient } from '../config/database.js';

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
  TFilters extends object = Record<string, unknown>,
> {
  protected readonly config: BaseServiceConfig;
  protected readonly db: SqlClient;

  constructor(
    dbOrConfig?: SqlClient | BaseServiceConfig,
    maybeConfig?: BaseServiceConfig
  ) {
    const isSqlClient = (value: unknown): value is SqlClient =>
      typeof (value as SqlClient | undefined)?.query === 'function';

    if (dbOrConfig && isSqlClient(dbOrConfig)) {
      this.db = dbOrConfig;
      this.config = {
        enableLogging: true,
        enableCaching: false,
        cacheTTL: 300,
        ...(maybeConfig || {}),
      };
    } else {
      this.db = pool;
      this.config = {
        enableLogging: true,
        enableCaching: false,
        cacheTTL: 300,
        ...(dbOrConfig as BaseServiceConfig | undefined),
      };
    }
  }

  /**
   * Table name for the entity (snake_case)
   */
  protected abstract getTableName(): string;

  /**
   * Get the entity name for logging and error messages
   */
  protected abstract getEntityName(): string;

  /**
   * Build where clause for filtering
   * Can be overridden by concrete services for custom filtering
   */
  protected buildWhereClause(
    _filters: TFilters,
    _context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    void _filters;
    void _context;
    return { sql: '', params: [] };
  }

  /**
   * Build include clause for relations
   * Can be overridden by concrete services
   */
  // Services can override to post-load relations
  protected async enrichEntities(
    entities: TEntity[],
    _context?: ServiceContext
  ): Promise<TEntity[]> {
    return entities;
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
  protected async validateCreate(
    _data: TCreateDTO,
    _context?: ServiceContext
  ): Promise<void> {
    // Override in concrete services for validation
  }

  /**
   * Validate update data
   */
  protected async validateUpdate(
    _id: string,
    _data: TUpdateDTO,
    _context?: ServiceContext
  ): Promise<void> {
    // Override in concrete services for validation
  }

  /**
   * Check if user owns the entity (for user-owned entities)
   */
  protected async checkOwnership(id: string, userId: string): Promise<boolean> {
    try {
      const table = this.getTableName();
      const result = await query<{ userId: string }>(
        `SELECT "userId" FROM ${table} WHERE id = $1 LIMIT 1`,
        [id],
        this.db
      );
      const row = result.rows[0];
      return !!row && row.userId === userId;
    } catch {
      return false;
    }
  }

  /**
   * Log service operation
   */
  protected log(
    operation: string,
    data?: Record<string, unknown>,
    context?: ServiceContext
  ): void {
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
   * Ensure a user row exists in development to satisfy FK connects
   */
  protected async ensureUserExists(
    userId?: string,
    emailFallback?: string
  ): Promise<void> {
    if (!userId) return;
    try {
      // Always allow mock/dev users; otherwise, allow in non-production
      const isMockUser =
        userId === 'dev-user-id' || userId.startsWith('test-user-');
      if (process.env.NODE_ENV !== 'production' || isMockUser) {
        await query(
          `INSERT INTO users (id, email, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId, emailFallback || `${userId}@dev.local`],
          this.db
        );
      }
    } catch {
      // ignore
    }
  }

  /**
   * Find all entities with optional filtering
   */
  async findAll(
    _filters: TFilters = {} as TFilters,
    _context?: ServiceContext
  ): Promise<TEntity[]> {
    throw new Error(
      'NOT_IMPLEMENTED: findAll must be implemented in the concrete service'
    );
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(
    _filters: TFilters = {} as TFilters,
    _page = 1,
    _limit = 20,
    _context?: ServiceContext
  ): Promise<{
    data: TEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    throw new Error(
      'NOT_IMPLEMENTED: findPaginated must be implemented in the concrete service'
    );
  }

  /**
   * Find entity by ID
   */
  async findById(
    id: string,
    context?: ServiceContext
  ): Promise<TEntity | null> {
    try {
      this.log('findById', { id }, context);
      const table = this.getTableName();
      const res = await query(
        `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`,
        [id],
        this.db
      );
      const row = res.rows[0];
      return row ? this.transformEntity(row) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findById:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Create new entity
   */
  async create(_data: TCreateDTO, _context?: ServiceContext): Promise<TEntity> {
    throw new Error(
      'NOT_IMPLEMENTED: create must be implemented in the concrete service'
    );
  }

  /**
   * Update entity by ID
   */
  async update(
    _id: string,
    _data: TUpdateDTO,
    _context?: ServiceContext
  ): Promise<TEntity | null> {
    throw new Error(
      'NOT_IMPLEMENTED: update must be implemented in the concrete service'
    );
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      this.log('delete', { id }, context);
      const table = this.getTableName();
      await query(`DELETE FROM ${table} WHERE id = $1`, [id], this.db);
      this.log('delete:success', { id }, context);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('delete:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      const table = this.getTableName();
      const res = await query(
        `SELECT 1 FROM ${table} WHERE id = $1`,
        [id],
        this.db
      );
      return res.rowCount > 0;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('exists:error', { error: message, id }, context);
      return false;
    }
  }

  /**
   * Count entities with optional filtering
   */
  async count(
    filters: TFilters = {} as TFilters,
    context?: ServiceContext
  ): Promise<number> {
    try {
      this.log('count', { filters }, context);
      const { sql, params } = this.buildWhereClause(filters, context);
      const table = this.getTableName();
      const res = await query<{ count: string }>(
        `SELECT COUNT(*)::bigint AS count FROM ${table} ${sql}`,
        params,
        this.db
      );
      return Number(res.rows[0]?.count || 0);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('count:error', { error: message, filters }, context);
      throw error;
    }
  }

  /**
   * Bulk create entities
   */
  async createMany(
    _data: TCreateDTO[],
    _context?: ServiceContext
  ): Promise<{ count: number }> {
    throw new Error(
      'NOT_IMPLEMENTED: createMany must be implemented in the concrete service'
    );
  }

  /**
   * Bulk update entities
   */
  async updateMany(
    _filters: TFilters,
    _data: Partial<TUpdateDTO>,
    _context?: ServiceContext
  ): Promise<{ count: number }> {
    throw new Error(
      'NOT_IMPLEMENTED: updateMany must be implemented in the concrete service'
    );
  }

  /**
   * Bulk delete entities
   */
  async deleteMany(
    _filters: TFilters,
    _context?: ServiceContext
  ): Promise<{ count: number }> {
    throw new Error(
      'NOT_IMPLEMENTED: deleteMany must be implemented in the concrete service'
    );
  }
}
