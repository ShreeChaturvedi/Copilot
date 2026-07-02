import { Pool, type PoolClient, type QueryResult } from 'pg';

// Pure SQL (pg) client for the backend workspace
export const databaseConfig = {
  url:
    process.env.DATABASE_URL ||
    // Local default matches the docker-compose credentials (postgres/postgres)
    // so the comprehensive-requirements DB suite and any local run connect
    // without extra config. Production and CI always set DATABASE_URL (and
    // TEST_DATABASE_URL, which test/setup.ts copies into DATABASE_URL)
    // explicitly, so this fallback never affects them.
    'postgresql://postgres:postgres@localhost:5432/react_calendar_dev',
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_TIMEOUT || '10000'),
};

declare global {
  var __backendPgPool: Pool | undefined;
}

// Neon and most managed Postgres require TLS. Enable SSL for any non-local
// connection (or when sslmode=require is set), matching scripts/migrate.ts.
// Without this, the deployed serverless functions cannot connect to Neon.
const needsSsl =
  /\bsslmode=require\b/.test(databaseConfig.url) ||
  (!/localhost|127\.0\.0\.1/.test(databaseConfig.url) &&
    process.env.PGSSLMODE !== 'disable');

const createPool = () =>
  new Pool({
    connectionString: databaseConfig.url,
    max: databaseConfig.max,
    idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
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
  // Idempotent: the SIGINT/SIGTERM/beforeExit handlers below all fire-and-forget
  // this, and tests (L3 adapter) also end the pool explicitly, so pool.end() can
  // be reached twice. pg rejects the second call ('Called end on pool more than
  // once'); swallow it so it never becomes an unhandled rejection (mirrors the
  // API pool's cleanupDatabase).
  try {
    await pool.end();
    console.log('✅ Backend (SQL) disconnected');
  } catch (error) {
    if (!(error instanceof Error) || !/more than once/i.test(error.message)) {
      console.error('❌ Backend (SQL) disconnection failed:', error);
    }
  }
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
