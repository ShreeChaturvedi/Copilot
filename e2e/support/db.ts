/**
 * Direct DB reset for the dedicated E2E database. Used by globalSetup (once)
 * and by specs whose flows share the single dev-user backend state and need a
 * clean slate per test (e.g. events, where calendars have a UNIQUE(userId,name)
 * and the event dialog auto-selects the default calendar).
 */
import { Pool } from 'pg';
import { E2E_DATABASE_URL } from './constants';

export async function resetDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 2 });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`
    );
    if (rows.length > 0) {
      const list = rows.map((r) => `"${r.tablename}"`).join(', ');
      await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await pool.end();
  }
}
