/**
 * Database migration runner.
 *
 * Applies every .sql file in lib/config/migrations/ in lexical order, exactly
 * once, inside a transaction, and records applied files in schema_migrations.
 * Idempotent: re-running only applies new files.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
 *   npm run db:migrate
 *
 * Flags:
 *   --status   Print applied/pending migrations and exit (no changes).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'lib', 'config', 'migrations');

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function main(): Promise<void> {
  // Production always sets DATABASE_URL explicitly. For local dev, fall back to
  // the same URL the dev server (scripts/dev-server.ts) uses so `npm run
  // db:migrate` works with zero config against the Docker Postgres.
  const LOCAL_DEV_URL =
    'postgresql://postgres:postgres@localhost:5432/react_calendar_dev';
  const databaseUrl = process.env.DATABASE_URL || LOCAL_DEV_URL;
  if (!process.env.DATABASE_URL) {
    console.warn(
      `⚠️  DATABASE_URL not set; using local dev default (${LOCAL_DEV_URL}).`
    );
  }

  const statusOnly = process.argv.includes('--status');

  // Neon and most managed Postgres require TLS. Allow opting out for local dev.
  const needsSsl =
    /\bsslmode=require\b/.test(databaseUrl) ||
    (!/localhost|127\.0\.0\.1/.test(databaseUrl) &&
      process.env.PGSSLMODE !== 'disable');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT NOW()
       )`
    );

    const { rows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.filename));
    const files = getMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (statusOnly) {
      console.log('Migrations:');
      for (const f of files) {
        console.log(`  ${applied.has(f) ? '✓ applied' : '· pending'}  ${f}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log(`✅ Database is up to date (${files.length} migrations).`);
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);
    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`  ✗ ${file} failed - rolled back.`);
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('✅ Migrations complete.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(
    '❌ Migration failed:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
