/**
 * Services barrel export and initialization
 */

// Base service exports
export * from './BaseService';

// Concrete service exports
export * from './TaskService';
export * from './CalendarService';
export * from './EventService';
export * from './TaskListService';
export * from './TagService';
export * from './AttachmentService';

// Service factory exports
export * from './ServiceFactory';

// Service initialization and utilities
import { initializeServiceFactory, getServiceFactory, getServices } from './ServiceFactory';
import { prisma } from '../config/database';

/**
 * Initialize all services with default configuration
 */
export const initServices = () => {
  const factory = initializeServiceFactory({
    prisma,
    enableLogging: process.env.NODE_ENV === 'development',
    enableCaching: process.env.REDIS_URL ? true : false,
    cacheTTL: 300, // 5 minutes
  });

  return factory;
};

/**
 * Get service factory instance (lazy initialization)
 */
let serviceFactory: ReturnType<typeof initializeServiceFactory> | null = null;

export const getOrInitServiceFactory = () => {
  if (!serviceFactory) {
    serviceFactory = initServices();
  }
  return serviceFactory;
};

/**
 * Convenience function to get all services with lazy initialization
 */
export const getAllServices = () => {
  const factory = getOrInitServiceFactory();
  return factory.getAllServices();
};

/**
 * Service health check utility
 */
export const checkServicesHealth = async () => {
  try {
    const factory = getOrInitServiceFactory();
    return await factory.healthCheck();
  } catch (error) {
    console.error('Services health check failed:', error);
    return {
      database: false,
      services: {
        task: false,
        calendar: false,
        event: false,
        taskList: false,
        tag: false,
        attachment: false,
      },
      timestamp: new Date(),
    };
  }
};

/**
 * Cleanup all services
 */
export const cleanupServices = async () => {
  try {
    if (serviceFactory) {
      await serviceFactory.cleanup();
      serviceFactory = null;
    }
  } catch (error) {
    console.error('Error during services cleanup:', error);
  }
};

// Ensure cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanupServices);
  process.on('SIGINT', cleanupServices);
  process.on('SIGTERM', cleanupServices);
}