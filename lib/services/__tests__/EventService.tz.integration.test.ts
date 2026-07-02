/**
 * Regression test for #59: getConflicts must detect non-recurring overlaps
 * regardless of the server process timezone.
 *
 * This exercises a REAL Postgres because the bug lives in how node-pg
 * serializes query params against `timestamp without time zone` columns, which
 * a mocked query cannot reproduce. The suite skips itself when no database is
 * reachable (e.g. the mocked CI job) so it never breaks those runs.
 *
 * DB: DATABASE_URL / VFY_DATABASE_URL, defaulting to the shared local dev DB.
 * All rows it creates are prefixed with `vfy-ev2-` and cleaned up afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { EventService } from '../EventService';

const { Pool } = pg;
const DSN =
  process.env.VFY_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/react_calendar_dev';
const PREFIX = 'vfy-ev2-';

async function canConnect(): Promise<boolean> {
  const probe = new Pool({
    connectionString: DSN,
    connectionTimeoutMillis: 3000,
    max: 1,
  });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

const dbAvailable = await canConnect();

describe.skipIf(!dbAvailable)(
  'EventService.getConflicts timezone handling (#59, real DB)',
  () => {
    const originalTz = process.env.TZ;
    const userId = PREFIX + 'user';
    const calId = PREFIX + 'cal';
    const evId = PREFIX + 'nonrecurring';
    let pool: InstanceType<typeof Pool>;
    let service: EventService;

    beforeAll(async () => {
      // Run the whole suite as a server in a non-UTC timezone, which is where
      // the Date-vs-timestamp serialization skew manifests.
      process.env.TZ = 'America/New_York';

      pool = new Pool({ connectionString: DSN, max: 2 });
      service = new EventService(pool, { enableLogging: false });

      await pool.query(
        `INSERT INTO users (id, email, "createdAt", "updatedAt")
         VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [userId, PREFIX + 'user@dev.local']
      );
      await pool.query(
        `INSERT INTO calendars (id, name, color, "isVisible", "isDefault", "userId", "createdAt", "updatedAt")
         VALUES ($1, $2, '#10b981', true, true, $3, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [calId, PREFIX + 'Calendar', userId]
      );
      // Clean any prior run, then seed a non-recurring event at a known UTC
      // instant. We insert via ISO strings so the stored value is correct UTC
      // independent of the create fix, isolating the getConflicts read path.
      await pool.query(`DELETE FROM events WHERE "userId" = $1`, [userId]);
      await pool.query(
        `INSERT INTO events (id, title, start, "end", "allDay", exceptions, "userId", "calendarId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, false, '{}', $5, $6, NOW(), NOW())`,
        [
          evId,
          PREFIX + 'overlap',
          '2026-09-01T10:00:00.000Z',
          '2026-09-01T11:00:00.000Z',
          userId,
          calId,
        ]
      );
    });

    afterAll(async () => {
      if (pool) {
        await pool
          .query(`DELETE FROM events WHERE "userId" = $1`, [userId])
          .catch(() => {});
        await pool
          .query(`DELETE FROM calendars WHERE id = $1`, [calId])
          .catch(() => {});
        await pool
          .query(`DELETE FROM users WHERE id = $1`, [userId])
          .catch(() => {});
        await pool.end().catch(() => {});
      }
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it('detects a non-recurring overlap under TZ=America/New_York', async () => {
      // Sanity: confirm the process really is running in a non-UTC zone.
      expect(new Date().getTimezoneOffset()).toBeGreaterThan(0);

      // Window 10:30-11:30Z overlaps the seeded 10:00-11:00Z event.
      const conflicts = await service.getConflicts(
        {
          start: new Date('2026-09-01T10:30:00.000Z'),
          end: new Date('2026-09-01T11:30:00.000Z'),
        },
        undefined,
        { userId }
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingEvent.id).toBe(evId);
    });

    it('create() stores start/end as UTC regardless of server timezone', async () => {
      const created = await service.create(
        {
          title: PREFIX + 'created',
          start: new Date('2026-09-02T14:00:00.000Z'),
          end: new Date('2026-09-02T15:00:00.000Z'),
          calendarId: calId,
        },
        { userId }
      );

      const row = await pool.query<{ start: Date; end: Date }>(
        `SELECT start, "end" FROM events WHERE id = $1`,
        [created.id]
      );
      expect(row.rows[0].start.toISOString()).toBe('2026-09-02T14:00:00.000Z');
      expect(row.rows[0].end.toISOString()).toBe('2026-09-02T15:00:00.000Z');
    });
  }
);
