/**
 * EventService — L2 suite against a REAL Postgres.
 *
 * Complements the mocked EventService.test.ts and the focused tz regression
 * (EventService.tz.integration.test.ts). Covers CRUD, UTC storage, per-event
 * color + exceptions round-trip (#29), real recurrence expansion over stored
 * rows (#8/#29 class), conflict detection, calendar/date filters, ownership
 * isolation, and cascade deletes.
 *
 * Gated on L2_TEST_DATABASE_URL; skips when unset. See dbTestUtils.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { L2_DB_URL, makeSeed, uid, type Seed } from './dbTestUtils.js';
import type { CreateEventDTO } from '../EventService.js';

type Db = typeof import('../../config/database.js');
type EventServiceClass = (typeof import('../EventService.js'))['EventService'];
type EventService = InstanceType<EventServiceClass>;

const MONDAY_9AM = '2026-07-06T09:00:00.000Z'; // 2026-07-06 is a Monday
const WEEKLY_MON = 'RRULE:FREQ=WEEKLY;BYDAY=MO';

describe.skipIf(!L2_DB_URL)('EventService (real Postgres, L2)', () => {
  let db: Db;
  let service: EventService;
  let seed: Seed;
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = L2_DB_URL!;
    db = await import('../../config/database.js');
    const { EventService } = await import('../EventService.js');
    service = new EventService({ enableLogging: false });
    seed = makeSeed(db.query as never);
  });

  afterAll(async () => {
    if (db) {
      await seed.deleteUsers(userIds);
      await db.pool.end().catch(() => {});
    }
  });

  async function freshUser() {
    const user = await seed.createUser();
    userIds.push(user.id);
    const cal = await seed.createCalendar(user.id, { name: `Cal ${uid()}` });
    return { userId: user.id, calId: cal.id, ctx: { userId: user.id } };
  }

  const base = (
    calId: string,
    over: Partial<CreateEventDTO> = {}
  ): CreateEventDTO => ({
    title: 'Meeting',
    start: new Date('2026-08-01T10:00:00.000Z'),
    end: new Date('2026-08-01T11:00:00.000Z'),
    calendarId: calId,
    ...over,
  });

  describe('create + read', () => {
    it('stores start/end as UTC and reads them back unchanged', async () => {
      const { calId, ctx } = await freshUser();
      const created = await service.create(base(calId), ctx);
      const row = await db.query<{ start: Date; end: Date }>(
        `SELECT start, "end" FROM events WHERE id = $1`,
        [created.id]
      );
      expect(row.rows[0].start.toISOString()).toBe('2026-08-01T10:00:00.000Z');
      expect(row.rows[0].end.toISOString()).toBe('2026-08-01T11:00:00.000Z');
      const fetched = await service.findById(created.id, ctx);
      expect(fetched!.title).toBe('Meeting');
      expect(fetched!.calendarId).toBe(calId);
      // findAll enriches the calendar relation (findById does not).
      const [viaList] = await service.findByCalendar(calId, ctx);
      expect(viaList.calendar?.id).toBe(calId);
    });

    it('round-trips per-event color and exceptions (#29)', async () => {
      const { calId, ctx } = await freshUser();
      const created = await service.create(
        base(calId, {
          color: '#ff0000',
          recurrence: WEEKLY_MON,
          start: new Date(MONDAY_9AM),
          end: new Date('2026-07-06T09:30:00.000Z'),
          exceptions: ['2026-07-20T09:00:00.000Z'],
        }),
        ctx
      );
      const fetched = await service.findById(created.id, ctx);
      expect(fetched!.color).toBe('#ff0000');
      expect(fetched!.exceptions).toEqual(['2026-07-20T09:00:00.000Z']);
    });

    it('rejects start >= end for a timed event', async () => {
      const { calId, ctx } = await freshUser();
      await expect(
        service.create(
          base(calId, {
            start: new Date('2026-08-01T11:00:00.000Z'),
            end: new Date('2026-08-01T10:00:00.000Z'),
          }),
          ctx
        )
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('rejects a calendar the user does not own', async () => {
      const a = await freshUser();
      const b = await freshUser();
      await expect(service.create(base(b.calId), a.ctx)).rejects.toThrow(
        /VALIDATION_ERROR/
      );
    });

    it('rejects a malformed RRULE and accepts BYSETPOS (#42)', async () => {
      const { calId, ctx } = await freshUser();
      await expect(
        service.create(base(calId, { recurrence: 'FREQ=DAILY' }), ctx)
      ).rejects.toThrow(/VALIDATION_ERROR/);
      const ok = await service.create(
        base(calId, { recurrence: 'RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1' }),
        ctx
      );
      expect(ok.recurrence).toBe('RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1');
    });
  });

  describe('update', () => {
    it('updates scalar fields and moves calendars', async () => {
      const { userId, calId, ctx } = await freshUser();
      const other = await seed.createCalendar(userId, {
        name: `Cal2 ${uid()}`,
      });
      const created = await service.create(base(calId), ctx);
      const updated = await service.update(
        created.id,
        { title: 'Renamed', location: 'HQ', calendarId: other.id },
        ctx
      );
      expect(updated!.title).toBe('Renamed');
      expect(updated!.location).toBe('HQ');
      expect(updated!.calendarId).toBe(other.id);
    });

    it("rejects updating another user's event", async () => {
      const a = await freshUser();
      const b = await freshUser();
      const ev = await service.create(base(a.calId), a.ctx);
      await expect(
        service.update(ev.id, { title: 'x' }, b.ctx)
      ).rejects.toThrow(/AUTHORIZATION_ERROR/);
    });
  });

  describe('filters (executed SQL)', () => {
    async function seedEvents() {
      const { userId, calId, ctx } = await freshUser();
      const cal2 = await seed.createCalendar(userId, { name: `Cal2 ${uid()}` });
      await service.create(
        base(calId, {
          title: 'aug-1',
          start: new Date('2026-08-01T10:00:00Z'),
          end: new Date('2026-08-01T11:00:00Z'),
        }),
        ctx
      );
      await service.create(
        base(calId, {
          title: 'aug-15 allday',
          allDay: true,
          start: new Date('2026-08-15T00:00:00Z'),
          end: new Date('2026-08-15T23:59:59Z'),
        }),
        ctx
      );
      await service.create(
        base(cal2.id, {
          title: 'sep-1',
          start: new Date('2026-09-01T10:00:00Z'),
          end: new Date('2026-09-01T11:00:00Z'),
        }),
        ctx
      );
      return { ctx, calId, cal2Id: cal2.id };
    }

    it('scopes to the user', async () => {
      const { ctx } = await seedEvents();
      const other = await freshUser();
      await service.create(base(other.calId), other.ctx);
      const mine = await service.findAll({}, ctx);
      expect(mine).toHaveLength(3);
      expect(mine.every((e) => e.userId === ctx.userId)).toBe(true);
    });

    it('filters by calendarId and calendarIds', async () => {
      const { ctx, calId, cal2Id } = await seedEvents();
      expect(await service.findAll({ calendarId: cal2Id }, ctx)).toHaveLength(
        1
      );
      expect(
        await service.findAll({ calendarIds: [calId, cal2Id] }, ctx)
      ).toHaveLength(3);
    });

    it('filters by allDay and search', async () => {
      const { ctx } = await seedEvents();
      const allday = await service.findAll({ allDay: true }, ctx);
      expect(allday.map((e) => e.title)).toEqual(['aug-15 allday']);
      const found = await service.findAll({ search: 'sep' }, ctx);
      expect(found.map((e) => e.title)).toEqual(['sep-1']);
    });

    it('date range returns only overlapping non-recurring events', async () => {
      const { ctx } = await seedEvents();
      const augustOnly = await service.findByDateRange(
        new Date('2026-08-01T00:00:00Z'),
        new Date('2026-08-31T23:59:59Z'),
        ctx
      );
      expect(augustOnly.map((e) => e.title).sort()).toEqual([
        'aug-1',
        'aug-15 allday',
      ]);
    });
  });

  describe('recurrence expansion over real rows (#8/#29)', () => {
    async function seedWeekly(exceptions: string[] = []) {
      const { calId, ctx } = await freshUser();
      const master = await service.create(
        base(calId, {
          title: 'Standup',
          recurrence: WEEKLY_MON,
          start: new Date(MONDAY_9AM),
          end: new Date('2026-07-06T09:15:00.000Z'),
          exceptions,
        }),
        ctx
      );
      return { ctx, master };
    }

    it('expands a weekly master into one occurrence per Monday in range', async () => {
      const { ctx, master } = await seedWeekly();
      const occ = await service.findByDateRange(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-31T23:59:59Z'),
        ctx
      );
      expect(occ).toHaveLength(4); // Jul 6, 13, 20, 27
      expect(occ.every((o) => o.isRecurringInstance)).toBe(true);
      expect(occ.every((o) => o.masterId === master.id)).toBe(true);
      const starts = occ.map((o) => o.start.toISOString());
      expect(starts).toContain('2026-07-06T09:00:00.000Z');
      expect(starts).toContain('2026-07-27T09:00:00.000Z');
    });

    it('omits an occurrence listed in exceptions', async () => {
      const { ctx } = await seedWeekly(['2026-07-20T09:00:00.000Z']);
      const occ = await service.findByDateRange(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-31T23:59:59Z'),
        ctx
      );
      expect(occ).toHaveLength(3);
      expect(occ.map((o) => o.start.toISOString())).not.toContain(
        '2026-07-20T09:00:00.000Z'
      );
    });

    it('createRecurring persists exactly one master row', async () => {
      const { calId, ctx } = await freshUser();
      const result = await service.createRecurring(
        base(calId, {
          recurrence: WEEKLY_MON,
          start: new Date(MONDAY_9AM),
          end: new Date('2026-07-06T10:00:00Z'),
        }),
        ctx
      );
      expect(result).toHaveLength(1);
      const rows = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM events WHERE "userId" = $1`,
        [ctx.userId]
      );
      expect(rows.rows[0].count).toBe('1');
    });
  });

  describe('conflicts', () => {
    it('detects an overlapping non-recurring event', async () => {
      const { calId, ctx } = await freshUser();
      const ev = await service.create(base(calId), ctx); // 10:00-11:00Z
      const conflicts = await service.getConflicts(
        {
          start: new Date('2026-08-01T10:30:00.000Z'),
          end: new Date('2026-08-01T11:30:00.000Z'),
          calendarId: calId,
        },
        undefined,
        ctx
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingEvent.id).toBe(ev.id);
      expect(conflicts[0].overlapDuration).toBe(30);
    });

    it('returns no conflict for a disjoint window and honors excludeId', async () => {
      const { calId, ctx } = await freshUser();
      const ev = await service.create(base(calId), ctx);
      const none = await service.getConflicts(
        {
          start: new Date('2026-08-01T12:00:00.000Z'),
          end: new Date('2026-08-01T13:00:00.000Z'),
          calendarId: calId,
        },
        undefined,
        ctx
      );
      expect(none).toHaveLength(0);
      // Overlapping window but excluding the only event -> no conflict.
      const excluded = await service.getConflicts(
        { start: ev.start, end: ev.end, calendarId: calId },
        ev.id,
        ctx
      );
      expect(excluded).toHaveLength(0);
    });

    it('detects a conflict from a recurring occurrence', async () => {
      const { calId, ctx } = await freshUser();
      await service.create(
        base(calId, {
          title: 'Weekly',
          recurrence: WEEKLY_MON,
          start: new Date(MONDAY_9AM),
          end: new Date('2026-07-06T10:00:00.000Z'),
        }),
        ctx
      );
      // Jul 13 (a Monday) 09:30-09:45 overlaps that week's 09:00-10:00 occurrence.
      const conflicts = await service.getConflicts(
        {
          start: new Date('2026-07-13T09:30:00.000Z'),
          end: new Date('2026-07-13T09:45:00.000Z'),
          calendarId: calId,
        },
        undefined,
        ctx
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingEvent.isRecurringInstance).toBe(true);
    });
  });

  describe('cascade deletes', () => {
    it('deleting a calendar cascades its events', async () => {
      const { calId, ctx } = await freshUser();
      const ev = await service.create(base(calId), ctx);
      await db.query(`DELETE FROM calendars WHERE id = $1`, [calId]);
      const rows = await db.query(`SELECT 1 FROM events WHERE id = $1`, [
        ev.id,
      ]);
      expect(rows.rowCount).toBe(0);
    });

    it('deleting the user cascades their events', async () => {
      const { userId, calId, ctx } = await freshUser();
      const ev = await service.create(base(calId), ctx);
      await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
      const rows = await db.query(`SELECT 1 FROM events WHERE id = $1`, [
        ev.id,
      ]);
      expect(rows.rowCount).toBe(0);
    });
  });
});
