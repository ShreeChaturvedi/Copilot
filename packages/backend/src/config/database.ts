import { Pool, type PoolClient, type QueryResult } from 'pg';

// Pure SQL (pg) client for the backend workspace
export const databaseConfig = {
  url:
    process.env.DATABASE_URL ||
    'postgresql://localhost:5432/react_calendar_dev',
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_TIMEOUT || '10000'),
};

declare global {
  var __backendPgPool: Pool | undefined;
}

const createPool = () =>
  new Pool({
    connectionString: databaseConfig.url,
    max: databaseConfig.max,
    idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
  });

export const pool: Pool = globalThis.__backendPgPool || createPool();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__backendPgPool = pool;
}

export type SqlClient = Pool | PoolClient;

export async function connectDatabase(): Promise<void> {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('✅ Backend (SQL) connected');
}

export async function disconnectDatabase(): Promise<void> {
  await pool.end();
  console.log('✅ Backend (SQL) disconnected');
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT 1');
    return rows.length === 1;
  } catch (e) {
    console.error('Database health check failed (backend):', e);
    return false;
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function query<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  sql: string,
  params: unknown[] = [],
  client?: SqlClient
): Promise<QueryResult<T>> {
  if (client && 'query' in client) {
    return (client as PoolClient).query<T>(sql, params);
  }
  return pool.query<T>(sql, params);
}

// Graceful shutdown
process.on('SIGINT', () => void disconnectDatabase());
process.on('SIGTERM', () => void disconnectDatabase());
process.on('beforeExit', () => void disconnectDatabase());

export default pool;
