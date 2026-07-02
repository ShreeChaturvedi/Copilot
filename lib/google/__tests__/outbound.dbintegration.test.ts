/**
 * M2 two-way sync integration tests (#27): EventService write capture,
 * outbox drain, echo suppression, 412 merge paths, the edit-vs-delete
 * matrix, and recurring EXDATE write-back — FakeGoogleCalendarClient
 * against a REAL local Postgres (plan §9).
 *
 * Gated behind GOOGLE_SYNC_TEST_DB_URL like the M1 suite. Run locally with:
 *
 *   docker exec react-calendar-postgres psql -U postgres -c \
 *     'CREATE DATABASE taskflow_m2_test'
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow_m2_test \
 *     npm run db:migrate
 *   GOOGLE_SYNC_TEST_DB_URL=postgresql://postgres:postgres@localhost:5432/taskflow_m2_test \
 *     npx vitest run --config vitest.backend.config.ts lib/google/__tests__/outbound.dbintegration.test.ts
 *
 * A "sync cycle" here is the same composition googleApi.syncUser runs:
 * drain -> pull -> drain.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { FakeGoogleCalendarClient } from '../FakeGoogleCalendarClient.js';
import { GoogleApiError } from '../types.js';

const DB_URL = process.env.GOOGLE_SYNC_TEST_DB_URL;

// Serializes the google db suites: the M3 file's syncAllUsers/renewChannels
// sweeps scan every account, so the files must not interleave on one DB.
const GOOGLE_DB_SUITE_LOCK = 271_828;

// Imported dynamically AFTER pointing DATABASE_URL at the test database
// (test/backend-setup.ts overrides it with a bogus URL).
type Repo = typeof import('../syncRepo.js');
type Db = typeof import('../../config/database.js');
type OutboxModule = typeof import('../outbox.js');
type SyncModule = typeof import('../GoogleSyncService.js');
type EventServiceModule = typeof import('../../services/EventService.js');

describe.skipIf(!DB_URL)(
  'M2 outbound sync (Fake client + real Postgres)',
  () => {
    let db: Db;
    let repo: Repo;
    let outbox: OutboxModule;
    let service: InstanceType<SyncModule['GoogleSyncService']>;
    let events: InstanceType<EventServiceModule['EventService']>;
    let userId: string;
    let appCalendarId: string;
    let ctx: { userId: string };
    let lockClient: PoolClient;

    const CAL_ID = 'fake-primary@example.com';

    beforeAll(async () => {
      process.env.DATABASE_URL = DB_URL!;
      // The fire-and-forget post-write drain must stay inert in tests.
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_TOKEN_ENC_KEY;
      db = await import('../../config/database.js');
      repo = await import('../syncRepo.js');
      outbox = await import('../outbox.js');
      const syncMod: SyncModule = await import('../GoogleSyncService.js');
      service = new syncMod.GoogleSyncService();
      const esMod: EventServiceModule = await import(
        '../../services/EventService.js'
      );
      events = new esMod.EventService({ enableLogging: false });
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
      await db.query(`DELETE FROM users WHERE email LIKE 'm2-test-%'`);
      const u = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, name)
       VALUES (gen_random_uuid()::text, $1, 'M2 Test') RETURNING id`,
        [
          `m2-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        ]
      );
      userId = u.rows[0].id;
      ctx = { userId };
      // The write capture requires an enabled google_accounts row (plan §2),
      // exactly like the real connect flow. The token is never decrypted here
      // (the fire-and-forget drain is inert without GOOGLE_* env).
      await db.query(
        `INSERT INTO google_accounts ("userId", "googleUserId", email, "refreshTokenEnc")
       VALUES ($1, 'fake-google-user', 'm2-test@example.com', 'not-a-real-token')`,
        [userId]
      );
      appCalendarId = await repo.createImportCalendar(userId, 'M2 Linked');
    });

    async function makeLink(fake: FakeGoogleCalendarClient) {
      return repo.createLink({
        userId,
        googleCalendarId: (await fake.getCalendar('primary')).id,
        appCalendarId,
      });
    }

    /** One sync cycle exactly as googleApi.syncUser composes it. */
    async function syncCycle(fake: FakeGoogleCalendarClient) {
      const drain1 = await outbox.drainUserOps(fake, userId);
      const [link] = await repo.getLinksForUser(userId);
      const pull = await service.syncCalendar(fake, link);
      const drain2 = await outbox.drainUserOps(fake, userId);
      return { drain1, pull, drain2 };
    }

    async function eventRow(id: string) {
      const res = await db.query(
        `SELECT id, title, description, location, start, "end", "allDay",
              recurrence, exceptions, origin, "googleEventId", "googleEtag",
              "googleUpdatedAt", "googleSyncSnapshot", "updatedAt"
       FROM events WHERE id = $1`,
        [id]
      );
      return res.rows[0] as
        | {
            id: string;
            title: string;
            description: string | null;
            location: string | null;
            start: Date;
            end: Date;
            allDay: boolean;
            recurrence: string | null;
            exceptions: string[];
            origin: string;
            googleEventId: string | null;
            googleEtag: string | null;
            googleUpdatedAt: Date | null;
            googleSyncSnapshot: Record<string, unknown> | null;
            updatedAt: Date;
          }
        | undefined;
    }

    async function pendingOps() {
      const res = await db.query(
        `SELECT id, op, "eventId", "googleEventId", attempts, "ifMatchEtag",
              "nextAttemptAt", "lastError", payload
       FROM google_sync_ops WHERE "userId" = $1 ORDER BY "createdAt"`,
        [userId]
      );
      return res.rows as Array<{
        id: string;
        op: string;
        eventId: string | null;
        googleEventId: string | null;
        attempts: number;
        ifMatchEtag: string | null;
        nextAttemptAt: Date;
        lastError: string | null;
        payload: Record<string, unknown> | null;
      }>;
    }

    async function tombstones() {
      const res = await db.query(
        `SELECT "googleEventId", "deletedAt" FROM google_event_tombstones
       WHERE "userId" = $1`,
        [userId]
      );
      return res.rows as Array<{ googleEventId: string; deletedAt: Date }>;
    }

    const baseEvent = {
      title: 'M2 created in app',
      start: new Date('2026-07-10T14:00:00.000Z'),
      end: new Date('2026-07-10T15:00:00.000Z'),
      calendarId: '',
      description: 'from the app',
      location: 'HQ',
    };

    // ---------------------------------------------------------------- create

    it('app create on a linked calendar enqueues an insert and drains to Google', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);

      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );

      // Enqueued transactionally with the write; nothing on Google yet.
      let ops = await pendingOps();
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('insert');
      expect(ops[0].eventId).toBe(created.id);

      const { drain1 } = await syncCycle(fake);
      expect(drain1.succeeded).toBe(1);

      // Google has it; the row is mapped with etag + snapshot (echo basis).
      const row = (await eventRow(created.id))!;
      expect(row.googleEventId).toBeTruthy();
      const stored = fake.getStoredEvent('primary', row.googleEventId!)!;
      expect(stored.summary).toBe('M2 created in app');
      expect(stored.description).toBe('from the app');
      expect(stored.location).toBe('HQ');
      expect(stored.start?.dateTime).toBe('2026-07-10T14:00:00.000Z');
      expect(row.googleEtag).toBe(stored.etag);
      expect(row.googleSyncSnapshot).toMatchObject({
        title: 'M2 created in app',
      });
      expect(row.origin).toBe('app'); // provenance unchanged by sync

      ops = await pendingOps();
      expect(ops).toHaveLength(0);
    });

    it('create on an UNLINKED calendar enqueues nothing', async () => {
      const otherCal = await repo.createImportCalendar(userId, 'Unlinked');
      await events.create({ ...baseEvent, calendarId: otherCal }, ctx);
      expect(await pendingOps()).toHaveLength(0);
    });

    it('skipGoogleSync context suppresses capture on a linked calendar', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        { userId, skipGoogleSync: true }
      );
      expect(await pendingOps()).toHaveLength(0);
    });

    // ------------------------------------------------------------------ edit

    it('app edit patches Google with If-Match; etag advances; no ping-pong over 3 idle cycles', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const afterCreate = (await eventRow(created.id))!;

      await events.update(created.id, { title: 'M2 edited in app' }, ctx);
      const ops = await pendingOps();
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('patch');
      expect(ops[0].ifMatchEtag).toBe(afterCreate.googleEtag);

      const { drain1 } = await syncCycle(fake);
      expect(drain1.succeeded).toBe(1);

      const row = (await eventRow(created.id))!;
      const stored = fake.getStoredEvent('primary', row.googleEventId!)!;
      expect(stored.summary).toBe('M2 edited in app');
      expect(stored.etag).not.toBe(afterCreate.googleEtag); // etag advanced
      expect(row.googleEtag).toBe(stored.etag);

      // Echo suppression: our own writes replay in the journal but change
      // nothing. Three idle cycles: stable etags, zero pending ops, no writes.
      for (let i = 0; i < 3; i++) {
        const cycle = await syncCycle(fake);
        expect(cycle.drain1.due).toBe(0);
        expect(cycle.drain2.due).toBe(0);
        expect(cycle.pull.inserted).toBe(0);
        expect(cycle.pull.updated).toBe(0);
        expect(cycle.pull.deleted).toBe(0);
        const after = (await eventRow(created.id))!;
        expect(after.googleEtag).toBe(stored.etag);
        expect(fake.getStoredEvent('primary', row.googleEventId!)!.etag).toBe(
          stored.etag
        );
      }
      expect(await pendingOps()).toHaveLength(0);
    });

    it('rapid consecutive edits coalesce into one pending patch op', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);

      await events.update(created.id, { title: 'v2' }, ctx);
      await events.update(created.id, { title: 'v3' }, ctx);
      await events.update(created.id, { location: 'Elsewhere' }, ctx);

      const ops = await pendingOps();
      expect(ops).toHaveLength(1);
      expect((ops[0].payload as { summary?: string }).summary).toBe('v3');

      await syncCycle(fake);
      const row = (await eventRow(created.id))!;
      const stored = fake.getStoredEvent('primary', row.googleEventId!)!;
      expect(stored.summary).toBe('v3');
      expect(stored.location).toBe('Elsewhere');
    });

    // ---------------------------------------------------------------- delete

    it('app delete removes the event on Google (tombstone until drained)', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await events.delete(created.id, ctx);
      expect(await eventRow(created.id)).toBeUndefined();
      expect((await tombstones()).map((t) => t.googleEventId)).toEqual([gid]);
      const ops = await pendingOps();
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('delete');

      const { drain1, pull } = await syncCycle(fake);
      expect(drain1.succeeded).toBe(1);
      expect(fake.getStoredEvent('primary', gid)!.status).toBe('cancelled');
      expect(await tombstones()).toHaveLength(0);
      // The cancellation echoes back through the journal without resurrecting.
      expect(pull.inserted).toBe(0);
      expect(await eventRow(created.id)).toBeUndefined();
    });

    it('create-then-delete before any drain never touches Google', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await events.delete(created.id, ctx);

      expect(await pendingOps()).toHaveLength(0); // insert op cancelled
      expect(await tombstones()).toHaveLength(0); // never mapped
      const { drain1 } = await syncCycle(fake);
      expect(drain1.due).toBe(0);
      const listing = await fake.listEvents('primary', { maxResults: 100 });
      expect(listing.items).toHaveLength(0);
    });

    // ----------------------------------------------------- 412 + merge paths

    it('412 on patch drops the op; the pull three-way merges and re-patches app-won fields', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      // Concurrent edits: app changes the title, Google changes the location.
      await events.update(created.id, { title: 'App-side title' }, ctx);
      await fake.patchEvent('primary', gid, { location: 'Google-side room' });

      const { drain1, pull, drain2 } = await syncCycle(fake);
      expect(drain1.conflicts).toBe(1); // 412: stale If-Match dropped
      expect(pull.merged).toBe(1); // three-way merge ran
      expect(drain2.succeeded).toBe(1); // app-won title re-patched

      const row = (await eventRow(created.id))!;
      const stored = fake.getStoredEvent('primary', gid)!;
      // Both sides converged on the merged event.
      expect(row.title).toBe('App-side title');
      expect(row.location).toBe('Google-side room');
      expect(stored.summary).toBe('App-side title');
      expect(stored.location).toBe('Google-side room');
      expect(row.googleEtag).toBe(stored.etag);

      // And the merge settles: an idle cycle changes nothing.
      const idle = await syncCycle(fake);
      expect(idle.drain1.due).toBe(0);
      expect(idle.pull.updated).toBe(0);
      expect(fake.getStoredEvent('primary', gid)!.etag).toBe(stored.etag);
    });

    it('true same-field conflict resolves by LWW (app newer wins and propagates)', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      // Google edits the title (fake clock: 2026-07-01), then the app edits the
      // same field (updatedAt = real NOW(), later than the fake clock).
      await fake.patchEvent('primary', gid, { summary: 'Google title' });
      await events.update(created.id, { title: 'App title (newer)' }, ctx);

      const { pull, drain2 } = await syncCycle(fake);
      expect(pull.merged).toBe(1);
      expect(drain2.succeeded).toBe(1);

      expect((await eventRow(created.id))!.title).toBe('App title (newer)');
      expect(fake.getStoredEvent('primary', gid)!.summary).toBe(
        'App title (newer)'
      );
    });

    it('true same-field conflict resolves by LWW (Google newer wins, no outbound)', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await events.update(created.id, { title: 'App title (older)' }, ctx);
      // Make the app edit look old, then Google edits the same field.
      await db.query(
        `UPDATE events SET "updatedAt" = '2026-06-01T00:00:00.000Z' WHERE id = $1`,
        [created.id]
      );
      await fake.patchEvent('primary', gid, {
        summary: 'Google title (newer)',
      });

      const { drain1, pull, drain2 } = await syncCycle(fake);
      expect(drain1.conflicts).toBe(1); // pending patch 412s and is dropped
      expect(pull.merged).toBe(1);
      expect(drain2.due).toBe(0); // Google won everything: nothing to push

      expect((await eventRow(created.id))!.title).toBe('Google title (newer)');
      expect(fake.getStoredEvent('primary', gid)!.summary).toBe(
        'Google title (newer)'
      );
    });

    // ------------------------------------------------------ edit-vs-delete

    it('Google deleted + app edited (app newer): app wins, re-inserted as a NEW Google event', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const oldGid = (await eventRow(created.id))!.googleEventId!;

      await fake.deleteEvent('primary', oldGid); // cancellation @ fake clock
      await events.update(created.id, { title: 'Edited after G-delete' }, ctx);

      const { pull, drain2 } = await syncCycle(fake);
      expect(pull.deleted).toBe(0);
      expect(drain2.succeeded).toBe(1); // the re-insert

      const row = (await eventRow(created.id))!;
      expect(row.title).toBe('Edited after G-delete');
      expect(row.googleEventId).toBeTruthy();
      expect(row.googleEventId).not.toBe(oldGid); // remapped to a NEW id
      expect(fake.getStoredEvent('primary', row.googleEventId!)!.summary).toBe(
        'Edited after G-delete'
      );
    });

    it('Google deleted + app untouched: the app row is deleted', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await fake.deleteEvent('primary', gid);
      const { pull } = await syncCycle(fake);
      expect(pull.deleted).toBe(1);
      expect(await eventRow(created.id)).toBeUndefined();
    });

    it('Google deleted + app edited but Google newer: the app row is deleted', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await events.update(created.id, { title: 'Old app edit' }, ctx);
      await db.query(
        `UPDATE events SET "updatedAt" = '2026-06-01T00:00:00.000Z' WHERE id = $1`,
        [created.id]
      );
      await fake.deleteEvent('primary', gid); // cancellation @ 2026-07-01 > app edit

      const { pull } = await syncCycle(fake);
      expect(pull.deleted).toBe(1);
      expect(await eventRow(created.id)).toBeUndefined();
    });

    it('app deleted + Google edited AFTER the delete: Google wins, row resurrected', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await events.delete(created.id, ctx);
      // Backdate the tombstone so Google's edit (fake clock) is newer.
      await db.query(
        `UPDATE google_event_tombstones SET "deletedAt" = '2026-06-01T00:00:00.000Z'
       WHERE "userId" = $1`,
        [userId]
      );
      await fake.patchEvent('primary', gid, {
        summary: 'Edited after A-delete',
      });

      // Drain first would 412 (etag moved) — exactly the syncUser order.
      const { drain1, pull } = await syncCycle(fake);
      expect(drain1.conflicts).toBe(1); // delete op dropped, tombstone kept
      expect(pull.inserted).toBe(1); // resurrected from the inbound payload

      const res = await db.query(
        `SELECT title FROM events WHERE "userId" = $1 AND "googleEventId" = $2`,
        [userId, gid]
      );
      expect(res.rows[0]?.title).toBe('Edited after A-delete');
      expect(await tombstones()).toHaveLength(0);
      expect(await pendingOps()).toHaveLength(0);
    });

    it('app deleted (newer) + Google edited (older): delete wins, re-pushed with the fresh etag', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      // Google edits first (fake clock 2026-07-01), app deletes after (NOW()).
      await fake.patchEvent('primary', gid, { summary: 'Doomed edit' });
      await events.delete(created.id, ctx);

      const { drain1, pull, drain2 } = await syncCycle(fake);
      // The delete op's If-Match is stale (Google edited) -> 412 conflict.
      expect(drain1.conflicts).toBe(1);
      // Pull: tombstone newer than Google's update -> app wins; the delete is
      // re-enqueued with the fresh etag and drains in the same cycle.
      expect(pull.inserted).toBe(0);
      expect(drain2.succeeded).toBe(1);

      expect(fake.getStoredEvent('primary', gid)!.status).toBe('cancelled');
      expect(await tombstones()).toHaveLength(0);
      expect(await eventRow(created.id)).toBeUndefined();
    });

    it('both deleted: tombstone and pending op are cleaned up quietly', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );
      await syncCycle(fake);
      const gid = (await eventRow(created.id))!.googleEventId!;

      await fake.deleteEvent('primary', gid); // Google deletes
      await events.delete(created.id, ctx); // app deletes too

      const { drain1 } = await syncCycle(fake);
      // Fake returns 412 (etag moved by the cancel) or the delete succeeds on
      // the cancelled event — either way everything converges to clean state.
      expect(drain1.due).toBe(1);
      // A second cycle flushes any re-enqueued delete against the fresh etag.
      await syncCycle(fake);

      expect(await tombstones()).toHaveLength(0);
      expect(await pendingOps()).toHaveLength(0);
      expect(await eventRow(created.id)).toBeUndefined();
      expect(fake.getStoredEvent('primary', gid)!.status).toBe('cancelled');
    });

    // -------------------------------------------------------------- recurring

    it('recurring create + "this event" exception write back as RRULE + EXDATE and a standalone', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);

      const master = await events.create(
        {
          title: 'M2 weekly',
          start: new Date('2026-07-06T09:00:00.000Z'),
          end: new Date('2026-07-06T09:30:00.000Z'),
          calendarId: appCalendarId,
          recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
        },
        ctx
      );
      await syncCycle(fake);
      let row = (await eventRow(master.id))!;
      const gid = row.googleEventId!;
      expect(fake.getStoredEvent('primary', gid)!.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
      ]);

      // The app's "this event" edit pattern (EventCreationDialog): add the
      // occurrence start to master.exceptions + create a standalone one-off.
      await events.update(
        master.id,
        { exceptions: ['2026-07-13T09:00:00.000Z'] },
        ctx
      );
      const standalone = await events.create(
        {
          title: 'M2 weekly (moved)',
          start: new Date('2026-07-13T11:00:00.000Z'),
          end: new Date('2026-07-13T11:30:00.000Z'),
          calendarId: appCalendarId,
        },
        ctx
      );

      const { drain1 } = await syncCycle(fake);
      expect(drain1.succeeded).toBe(2); // master patch + standalone insert

      const storedMaster = fake.getStoredEvent('primary', gid)!;
      expect(storedMaster.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE:20260713T090000Z',
      ]);
      const standaloneRow = (await eventRow(standalone.id))!;
      expect(
        fake.getStoredEvent('primary', standaloneRow.googleEventId!)!.summary
      ).toBe('M2 weekly (moved)');

      // Idle cycle: the EXDATE echo does not bounce back as an app change.
      const idle = await syncCycle(fake);
      expect(idle.drain1.due).toBe(0);
      expect(idle.pull.updated).toBe(0);
      row = (await eventRow(master.id))!;
      expect(row.exceptions).toEqual(['2026-07-13T09:00:00.000Z']);
    });

    it('inbound instance-shell exceptions never re-emit EXDATE for override instances', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      // Google-origin recurring master with a modified instance.
      const gMaster = await fake.insertEvent('primary', {
        summary: 'G weekly',
        start: { dateTime: '2026-07-06T09:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-07-06T09:15:00Z', timeZone: 'UTC' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      });
      fake.injectEvent('primary', {
        id: `${gMaster.id}_20260713T090000Z`,
        summary: 'G weekly (moved)',
        recurringEventId: gMaster.id,
        originalStartTime: { dateTime: '2026-07-13T09:00:00Z' },
        start: { dateTime: '2026-07-13T11:00:00Z' },
        end: { dateTime: '2026-07-13T11:15:00Z' },
      });
      await makeLink(fake);
      await syncCycle(fake);

      // The folded exception is part of the synced base: a later Google-side
      // master edit must NOT read it as an app-side EXDATE addition.
      await fake.patchEvent('primary', gMaster.id, { summary: 'G weekly v2' });
      const { pull, drain2 } = await syncCycle(fake);
      expect(pull.merged).toBe(1);
      expect(drain2.due).toBe(0); // nothing written back

      const res = await db.query(
        `SELECT title, exceptions FROM events WHERE "userId" = $1 AND "googleEventId" = $2`,
        [userId, gMaster.id]
      );
      expect(res.rows[0].title).toBe('G weekly v2');
      expect(res.rows[0].exceptions).toEqual(['2026-07-13T09:00:00.000Z']);
      expect(fake.getStoredEvent('primary', gMaster.id)!.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
      ]); // no EXDATE injected
    });

    // ------------------------------------------------------- retry / backoff

    it('retryable failures back off on the op row and succeed on a later drain', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      const created = await events.create(
        { ...baseEvent, calendarId: appCalendarId },
        ctx
      );

      const failing = new Proxy(fake, {
        get(target, prop, receiver) {
          if (prop === 'insertEvent') {
            return async () => {
              throw new GoogleApiError(503, 'backendError', 'boom 503');
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const drain = await outbox.drainUserOps(failing, userId);
      expect(drain.retried).toBe(1);

      const [op] = await pendingOps();
      expect(op.attempts).toBe(1);
      expect(op.lastError).toContain('boom 503');
      expect(op.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

      // Backed-off op is not due: an immediate drain skips it.
      const drain2 = await outbox.drainUserOps(fake, userId);
      expect(drain2.due).toBe(0);

      // Once due again, the healthy client delivers it.
      await db.query(
        `UPDATE google_sync_ops SET "nextAttemptAt" = NOW() WHERE "userId" = $1`,
        [userId]
      );
      const drain3 = await outbox.drainUserOps(fake, userId);
      expect(drain3.succeeded).toBe(1);
      expect((await eventRow(created.id))!.googleEventId).toBeTruthy();
    });

    it('unretryable 400s are dropped so the outbox never wedges', async () => {
      const fake = new FakeGoogleCalendarClient(CAL_ID);
      await makeLink(fake);
      await events.create({ ...baseEvent, calendarId: appCalendarId }, ctx);

      const badRequest = new Proxy(fake, {
        get(target, prop, receiver) {
          if (prop === 'insertEvent') {
            return async () => {
              throw new GoogleApiError(400, 'badRequest', 'Invalid value');
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const drain = await outbox.drainUserOps(badRequest, userId);
      expect(drain.dropped).toBe(1);
      expect(await pendingOps()).toHaveLength(0);
    });
  }
);
