/**
 * GoogleSyncService integration tests: FakeGoogleCalendarClient against a
 * REAL local Postgres (plan §9).
 *
 * These are gated behind GOOGLE_SYNC_TEST_DB_URL because the default backend
 * suite (vitest.backend.config.ts) runs DB-less in CI. Run locally with:
 *
 *   docker exec react-calendar-postgres psql -U postgres -c \
 *     'CREATE DATABASE react_calendar_sync_test'
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_sync_test \
 *     npm run db:migrate
 *   GOOGLE_SYNC_TEST_DB_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_sync_test \
 *     npx vitest run --config vitest.backend.config.ts lib/google/__tests__/GoogleSyncService.dbintegration.test.ts
 *
 * Covers: full import (events + mapping rows + instance folding), incremental
 * add/edit/delete, echo suppression via googleEtag, 410 stale-token full
 * resync with deletion sweep, and paging.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { FakeGoogleCalendarClient } from '../FakeGoogleCalendarClient.js';

const DB_URL = process.env.GOOGLE_SYNC_TEST_DB_URL;

// Serializes the google db suites: the M3 file's syncAllUsers/renewChannels
// sweeps scan every account, so the files must not interleave on one DB.
const GOOGLE_DB_SUITE_LOCK = 271_828;

// Modules are imported dynamically AFTER pointing DATABASE_URL at the test
// database (test/backend-setup.ts overrides it with a bogus URL).
type Repo = typeof import('../syncRepo.js');
type SyncModule = typeof import('../GoogleSyncService.js');
type Db = typeof import('../../config/database.js');

describe.skipIf(!DB_URL)(
  'GoogleSyncService (Fake client + real Postgres)',
  () => {
    let repo: Repo;
    let db: Db;
    let service: InstanceType<SyncModule['GoogleSyncService']>;
    let userId: string;
    let appCalendarId: string;

    const CAL_ID = 'fake-primary@example.com';

    let lockClient: PoolClient;

    beforeAll(async () => {
      process.env.DATABASE_URL = DB_URL!;
      db = await import('../../config/database.js');
      repo = await import('../syncRepo.js');
      const mod: SyncModule = await import('../GoogleSyncService.js');
      service = new mod.GoogleSyncService();
      lockClient = await db.pool.connect();
      await lockClient.query('SELECT pg_advisory_lock($1)', [
        GOOGLE_DB_SUITE_LOCK,
      ]);
    }, 120_000);

    afterAll(async () => {
      if (lockClient) {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [
          GOOGLE_DB_SUITE_LOCK,
        ]);
        lockClient.release();
      }
      await db.pool.end();
    });

    beforeEach(async () => {
      // Fresh user + calendar per test; cascades clean up dependent rows.
      await db.query(`DELETE FROM users WHERE email LIKE 'gsync-test-%'`);
      const u = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, name)
       VALUES (gen_random_uuid()::text, $1, 'GSync Test') RETURNING id`,
        [
          `gsync-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        ]
      );
      userId = u.rows[0].id;
      appCalendarId = await repo.createImportCalendar(userId, 'Fake Primary');
    });

    async function makeLink(fake: FakeGoogleCalendarClient) {
      return repo.createLink({
        userId,
        googleCalendarId: (await fake.getCalendar('primary')).id,
        appCalendarId,
      });
    }

    async function allEvents(): Promise<
      Array<{
        id: string;
        title: string;
        allDay: boolean;
        recurrence: string | null;
        exceptions: string[];
        origin: string;
        googleEventId: string | null;
        googleEtag: string | null;
        googleUpdatedAt: Date | null;
        googleSyncSnapshot: Record<string, unknown> | null;
        start: Date;
        end: Date;
      }>
    > {
      const res = await db.query(
        `SELECT id, title, "allDay", recurrence, exceptions, origin,
              "googleEventId", "googleEtag", "googleUpdatedAt",
              "googleSyncSnapshot", start, "end"
       FROM events WHERE "userId" = $1 ORDER BY title`,
        [userId]
      );
      return res.rows as never;
    }

    it('full import populates events, mapping columns, and instance folding', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      const timed = await fake.insertEvent('primary', {
        summary: 'Timed meeting',
        description: 'agenda',
        location: 'Room 1',
        start: { dateTime: '2026-07-06T14:00:00Z' },
        end: { dateTime: '2026-07-06T14:30:00Z' },
      });
      await fake.insertEvent('primary', {
        summary: 'All day offsite',
        start: { date: '2026-07-10' },
        end: { date: '2026-07-12' }, // exclusive -> inclusive Jul 10-11
      });
      const master = await fake.insertEvent('primary', {
        summary: 'Weekly standup',
        start: { dateTime: '2026-07-06T09:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-07-06T09:15:00Z', timeZone: 'UTC' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE:20260720T090000Z'],
      });
      // Modified instance (Jul 13 moved) + cancelled instance (Jul 27).
      fake.injectEvent('primary', {
        id: `${master.id}_20260713T090000Z`,
        summary: 'Weekly standup (moved)',
        recurringEventId: master.id,
        originalStartTime: { dateTime: '2026-07-13T09:00:00Z' },
        start: { dateTime: '2026-07-13T11:00:00Z' },
        end: { dateTime: '2026-07-13T11:15:00Z' },
      });
      fake.injectEvent('primary', {
        id: `${master.id}_20260727T090000Z`,
        status: 'cancelled',
        recurringEventId: master.id,
        originalStartTime: { dateTime: '2026-07-27T09:00:00Z' },
      });

      const link = await makeLink(fake);
      const stats = await service.syncCalendar(fake, link);

      expect(stats.mode).toBe('full');
      expect(stats.inserted).toBe(4); // timed, all-day, master, moved instance
      expect(stats.exceptionsApplied).toBe(2);

      const rows = await allEvents();
      expect(rows).toHaveLength(4);

      const timedRow = rows.find((r) => r.title === 'Timed meeting')!;
      expect(timedRow.googleEventId).toBe(timed.id);
      expect(timedRow.googleEtag).toBe(
        fake.getStoredEvent('primary', timed.id)!.etag
      );
      expect(timedRow.origin).toBe('google');
      expect(timedRow.googleUpdatedAt).toBeInstanceOf(Date);
      expect(timedRow.googleSyncSnapshot).toMatchObject({
        title: 'Timed meeting',
        allDay: false,
      });
      expect(timedRow.start.toISOString()).toBe('2026-07-06T14:00:00.000Z');

      const allDayRow = rows.find((r) => r.title === 'All day offsite')!;
      expect(allDayRow.allDay).toBe(true);
      expect(allDayRow.start.toISOString()).toBe('2026-07-10T00:00:00.000Z');
      expect(allDayRow.end.toISOString()).toBe('2026-07-11T23:59:59.999Z');

      const masterRow = rows.find((r) => r.title === 'Weekly standup')!;
      expect(masterRow.recurrence).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
      // EXDATE + modified-instance original + cancelled-instance original.
      expect([...masterRow.exceptions].sort()).toEqual([
        '2026-07-13T09:00:00.000Z',
        '2026-07-20T09:00:00.000Z',
        '2026-07-27T09:00:00.000Z',
      ]);

      const movedRow = rows.find((r) => r.title === 'Weekly standup (moved)')!;
      expect(movedRow.googleEventId).toBe(`${master.id}_20260713T090000Z`);
      expect(movedRow.recurrence).toBeNull();

      // syncToken persisted for the incremental phase.
      const links = await repo.getLinksForUser(userId);
      expect(links[0].syncToken).toMatch(/^st:/);
      expect(links[0].lastFullSyncAt).toBeInstanceOf(Date);
    });

    it('incremental pull applies adds, edits, and deletes', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      const a = await fake.insertEvent('primary', {
        summary: 'Event A',
        start: { dateTime: '2026-07-06T10:00:00Z' },
        end: { dateTime: '2026-07-06T11:00:00Z' },
      });
      const b = await fake.insertEvent('primary', {
        summary: 'Event B',
        start: { dateTime: '2026-07-07T10:00:00Z' },
        end: { dateTime: '2026-07-07T11:00:00Z' },
      });

      let link = await makeLink(fake);
      await service.syncCalendar(fake, link);

      // Change on the Google side after the import.
      await fake.patchEvent('primary', a.id, { summary: 'Event A v2' });
      await fake.deleteEvent('primary', b.id);
      await fake.insertEvent('primary', {
        summary: 'Event C',
        start: { dateTime: '2026-07-08T10:00:00Z' },
        end: { dateTime: '2026-07-08T11:00:00Z' },
      });

      [link] = await repo.getLinksForUser(userId);
      const stats = await service.syncCalendar(fake, link);

      expect(stats.mode).toBe('incremental');
      expect(stats.inserted).toBe(1);
      expect(stats.updated).toBe(1);
      expect(stats.deleted).toBe(1);

      const rows = await allEvents();
      expect(rows.map((r) => r.title).sort()).toEqual([
        'Event A v2',
        'Event C',
      ]);

      const [after] = await repo.getLinksForUser(userId);
      expect(after.syncToken).not.toBe(link.syncToken);
    });

    it('suppresses echoes: same etag is skipped, local fields untouched', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      const a = await fake.insertEvent('primary', {
        summary: 'Echo target',
        start: { dateTime: '2026-07-06T10:00:00Z' },
        end: { dateTime: '2026-07-06T11:00:00Z' },
      });
      let link = await makeLink(fake);
      await service.syncCalendar(fake, link);

      // Simulate the M2 outbound path: our write bumped Google's etag and we
      // recorded it locally; the change journal replays it on the next pull.
      const patched = await fake.patchEvent('primary', a.id, {
        summary: 'Written by app',
      });
      await db.query(
        `UPDATE events SET "googleEtag" = $1, title = 'Local truth'
       WHERE "userId" = $2 AND "googleEventId" = $3`,
        [patched.etag, userId, a.id]
      );

      [link] = await repo.getLinksForUser(userId);
      const stats = await service.syncCalendar(fake, link);
      expect(stats.skipped).toBe(1);
      expect(stats.updated).toBe(0);

      const rows = await allEvents();
      expect(rows[0].title).toBe('Local truth'); // not clobbered by the echo
    });

    it('410 stale syncToken triggers a full resync with deletion sweep', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      const a = await fake.insertEvent('primary', {
        summary: 'Survivor',
        start: { dateTime: '2026-07-06T10:00:00Z' },
        end: { dateTime: '2026-07-06T11:00:00Z' },
      });
      const b = await fake.insertEvent('primary', {
        summary: 'Doomed',
        start: { dateTime: '2026-07-07T10:00:00Z' },
        end: { dateTime: '2026-07-07T11:00:00Z' },
      });

      let link = await makeLink(fake);
      await service.syncCalendar(fake, link);

      // Google-side delete that the app never hears about incrementally,
      // because the token expires before the next pull.
      await fake.deleteEvent('primary', b.id);
      await fake.patchEvent('primary', a.id, { summary: 'Survivor v2' });
      fake.expireSyncTokens();

      [link] = await repo.getLinksForUser(userId);
      const stats = await service.syncCalendar(fake, link);

      expect(stats.mode).toBe('full'); // fell back after the 410
      const rows = await allEvents();
      expect(rows.map((r) => r.title)).toEqual(['Survivor v2']);

      const [after] = await repo.getLinksForUser(userId);
      expect(after.syncToken).toMatch(/^st:/); // re-established
      expect(after.lastError).toBeNull();
    });

    it('pages through large imports and only then persists the syncToken', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      fake.forcePageSize = 2;
      for (let i = 0; i < 5; i++) {
        await fake.insertEvent('primary', {
          summary: `Bulk ${i}`,
          start: { dateTime: `2026-07-0${i + 1}T10:00:00Z` },
          end: { dateTime: `2026-07-0${i + 1}T11:00:00Z` },
        });
      }
      const link = await makeLink(fake);
      const stats = await service.syncCalendar(fake, link);
      expect(stats.pages).toBe(3);
      expect(stats.inserted).toBe(5);
      const [after] = await repo.getLinksForUser(userId);
      expect(after.syncToken).toMatch(/^st:/);
    });

    it('records lastError on the link when the client fails mid-sync', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      const link = await makeLink(fake);
      const failing = {
        ...fake,
        listEvents: async () => {
          throw new Error('boom mid-sync');
        },
      } as never;
      await expect(service.syncCalendar(failing, link)).rejects.toThrow(
        'boom mid-sync'
      );
      const [after] = await repo.getLinksForUser(userId);
      expect(after.lastError).toContain('boom mid-sync');
      expect(after.syncToken).toBeNull(); // never advanced
    });
  }
);
