/**
 * Database configuration for Vercel API routes
 */
import { PrismaClient } from '@prisma/client';

// Global variable to prevent multiple instances in serverless environment
declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with appropriate configuration
 */
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

/**
 * Prisma client instance - prevents multiple instances in serverless
 */
export const prisma = globalThis.__prisma || createPrismaClient();

// Cache instance in development to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * Database configuration object
 */
export const databaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/react_calendar_dev',
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '10000'),
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '60000'),
};

/**
 * Initialize database connection
 */
export const initDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully (API)');
  } catch (error) {
    console.error('❌ Database connection failed (API):', error);
    throw error;
  }
};

/**
 * Health check for database
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

/**
 * Cleanup database connections
 */
export const cleanupDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully (API)');
  } catch (error) {
    console.error('❌ Database disconnection failed (API):', error);
  }
};

/**
 * Transaction helper for API routes
 */
export const withTransaction = async <T>(
  callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(callback);
};

// Graceful shutdown for serverless functions
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await cleanupDatabase();
  });
}

export default prisma;