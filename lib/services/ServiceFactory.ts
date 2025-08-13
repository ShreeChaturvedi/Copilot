/**
 * Service Factory - Dependency injection and service instantiation
 */
import type { PoolClient } from 'pg';
import { pool, withTransaction as sqlWithTransaction, checkDatabaseHealth as sqlHealth } from '../config/database.js';
import { TaskService } from './TaskService.js';
import { CalendarService } from './CalendarService.js';
import { EventService } from './EventService.js';
import { TaskListService } from './TaskListService.js';
import { TagService } from './TagService.js';
import { AttachmentService } from './AttachmentService.js';
import { BaseServiceConfig } from './BaseService.js';

/**
 * Service factory configuration
 */
export interface ServiceFactoryConfig {
  dbClient?: PoolClient; // optional transactional client
  enableLogging?: boolean;
  enableCaching?: boolean;
  cacheTTL?: number;
}

/**
 * All available services
 */
export interface Services {
  task: TaskService;
  calendar: CalendarService;
  event: EventService;
  taskList: TaskListService;
  tag: TagService;
  attachment: AttachmentService;
}

/**
 * ServiceFactory - Creates and manages service instances with dependency injection
 */
export class ServiceFactory {
  private services: Partial<Services> = {};
  private config: ServiceFactoryConfig;
  private baseServiceConfig: BaseServiceConfig;

  constructor(config: ServiceFactoryConfig) {
    this.config = config;
    this.baseServiceConfig = {
      enableLogging: config.enableLogging ?? true,
      enableCaching: config.enableCaching ?? false,
      cacheTTL: config.cacheTTL ?? 300,
    };
  }

  /**
   * Get task service instance
   */
  getTaskService(): TaskService {
    if (!this.services.task) {
      this.services.task = new TaskService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.task;
  }

  /**
   * Get calendar service instance
   */
  getCalendarService(): CalendarService {
    if (!this.services.calendar) {
      this.services.calendar = new CalendarService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.calendar;
  }

  /**
   * Get event service instance
   */
  getEventService(): EventService {
    if (!this.services.event) {
      this.services.event = new EventService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.event;
  }

  /**
   * Get task list service instance
   */
  getTaskListService(): TaskListService {
    if (!this.services.taskList) {
      this.services.taskList = new TaskListService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.taskList;
  }

  /**
   * Get tag service instance
   */
  getTagService(): TagService {
    if (!this.services.tag) {
      this.services.tag = new TagService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.tag;
  }

  /**
   * Get attachment service instance
   */
  getAttachmentService(): AttachmentService {
    if (!this.services.attachment) {
      this.services.attachment = new AttachmentService(this.config.dbClient || pool, this.baseServiceConfig);
    }
    return this.services.attachment;
  }

  /**
   * Get all services
   */
  getAllServices(): Services {
    return {
      task: this.getTaskService(),
      calendar: this.getCalendarService(),
      event: this.getEventService(),
      taskList: this.getTaskListService(),
      tag: this.getTagService(),
      attachment: this.getAttachmentService(),
    };
  }

  /**
   * Update configuration for all services
   */
  updateConfig(config: Partial<BaseServiceConfig>): void {
    this.baseServiceConfig = { ...this.baseServiceConfig, ...config };
    
    // Clear cached service instances to force recreation with new config
    this.services = {};
  }

  // Removed Prisma accessor: factory now uses SQL clients only

  /**
   * Execute database transaction with all services
   */
  async transaction<T>(callback: (services: Services, client: PoolClient) => Promise<T>): Promise<T> {
    return await sqlWithTransaction(async (client) => {
      const txFactory = new ServiceFactory({ ...this.config, dbClient: client });
      const services = txFactory.getAllServices();
      return await callback(services, client);
    });
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    database: boolean;
    services: Record<keyof Services, boolean>;
    timestamp: Date;
  }> {
    const results = {
      database: false,
      services: {} as Record<keyof Services, boolean>,
      timestamp: new Date(),
    };

    results.database = await sqlHealth();

    // Check each service
    const serviceNames: (keyof Services)[] = ['task', 'calendar', 'event', 'taskList', 'tag', 'attachment'];
    
    for (const serviceName of serviceNames) {
      try {
        const service = this.getAllServices()[serviceName];
        // Basic service instantiation check
        results.services[serviceName] = !!service;
      } catch (error) {
        console.error(`${serviceName} service health check failed:`, error);
        results.services[serviceName] = false;
      }
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Pool cleanup is handled globally in database.ts
  }
}

/**
 * Global service factory instance
 * This will be initialized with the SQL pool
 */
let globalServiceFactory: ServiceFactory | null = null;

/**
 * Initialize the global service factory
 */
export function initializeServiceFactory(config: ServiceFactoryConfig): ServiceFactory {
  globalServiceFactory = new ServiceFactory(config);
  return globalServiceFactory;
}

/**
 * Get the global service factory instance
 */
export function getServiceFactory(): ServiceFactory {
  if (!globalServiceFactory) {
    throw new Error('Service factory not initialized. Call initializeServiceFactory first.');
  }
  return globalServiceFactory;
}

/**
 * Get services from the global factory
 */
export function getServices(): Services {
  return getServiceFactory().getAllServices();
}

/**
 * Convenience functions to get individual services
 */
export const getTaskService = () => getServiceFactory().getTaskService();
export const getCalendarService = () => getServiceFactory().getCalendarService();
export const getEventService = () => getServiceFactory().getEventService();
export const getTaskListService = () => getServiceFactory().getTaskListService();
export const getTagService = () => getServiceFactory().getTagService();
export const getAttachmentService = () => getServiceFactory().getAttachmentService();