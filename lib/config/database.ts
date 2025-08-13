/**
 * Database configuration for Vercel API routes (Pure SQL via pg)
 */
import { Pool, type PoolClient, type QueryResult } from 'pg';

// Database configuration object
export const databaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/react_calendar_dev',
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '10000'),
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '60000'),
};

// Global pool (cached in dev to avoid multiple instances during HMR)
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const createPool = () =>
  new Pool({
    connectionString: databaseConfig.url,
    max: databaseConfig.maxConnections,
    idleTimeoutMillis: databaseConfig.connectionTimeout,
  });

export const pool: Pool = globalThis.__pgPool || createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pgPool = pool;
}

export type SqlClient = Pool | PoolClient;

export async function initDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connected successfully (API)');
  } catch (error) {
    console.error('❌ Database connection failed (API):', error);
    throw error;
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT 1');
    return rows.length === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export async function cleanupDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Database disconnected successfully (API)');
  } catch (error) {
    console.error('❌ Database disconnection failed (API):', error);
  }
}

// Simple query helper
export async function query<T = any>(sql: string, params: any[] = [], client?: SqlClient): Promise<QueryResult<T>> {
  if (client) {
    return (client as PoolClient).query<T>(sql, params);
  }
  return pool.query<T>(sql, params);
}

// Transaction helper for API routes
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown for serverless functions
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await cleanupDatabase();
  });
}

export default pool;