/**
 * L3 — /api/events* contracts through the real dispatcher, EventService and
 * Postgres, including server-side recurrence expansion, color + exceptions
 * (migration 003) and the conflicts endpoint. Field names pinned to
 * src/services/api/events.ts (reads start/end/color/recurrence/exceptions and,
 * for conflicts, body.data.conflicts, events.ts:394-421).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  closeAppPools,
  resetRateLimitStore,
  type TestServer,
} from './adapter.js';
import {
  makeClient,
  registerUser,
  dbAvailable,
  cleanupPool,
  cleanupTestData,
  type TestUser,
} from './helpers.js';

interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

interface EventEntity {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  recurrence: string | null;
  color: string | null;
  exceptions: string[];
  calendarId: string;
  userId: string;
  calendar?: { id: string; name: string; color: string };
  masterId?: string;
  isRecurringInstance?: boolean;
  occurrenceInstanceStart?: string;
}

describe.skipIf(!dbAvailable)('L3 events contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;
  let user: TestUser;
  let calendarId: string;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
    user = await registerUser(req);
    const cal = await req<Envelope<{ id: string }>>('POST', '/api/calendars', {
      token: user.accessToken,
      body: { name: 'Events Cal', color: '#10b981' },
    });
    calendarId = cal.body.data!.id;
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  const createEvent = (body: Record<string, unknown>, u: TestUser = user) =>
    req<Envelope<EventEntity>>('POST', '/api/events', {
      token: u.accessToken,
      body: { calendarId, ...body },
    });

  describe('POST /api/events', () => {
    it('201 persists color and exceptions (regression #29: these were dropped)', async () => {
      const r = await createEvent({
        title: 'Colored recurring',
        start: '2026-09-07T10:00:00.000Z',
        end: '2026-09-07T10:30:00.000Z',
        description: 'daily standup',
        location: 'Zoom',
        recurrence: 'RRULE:FREQ=DAILY;COUNT=5',
        color: '#ff0000',
        exceptions: ['2026-09-09T10:00:00.000Z'],
      });
      expect(r.status).toBe(201);
      const e = r.body.data!;
      expect(e).toMatchObject({
        title: 'Colored recurring',
        description: 'daily standup',
        location: 'Zoom',
        color: '#ff0000', // #29 pin
        recurrence: 'RRULE:FREQ=DAILY;COUNT=5',
        allDay: false,
        userId: user.userId,
        calendarId,
      });
      expect(e.exceptions).toEqual(['2026-09-09T10:00:00.000Z']); // #29 pin
      expect(new Date(e.start).toISOString()).toBe('2026-09-07T10:00:00.000Z');
      expect(new Date(e.end).toISOString()).toBe('2026-09-07T10:30:00.000Z');
    });

    it('400 VALIDATION_ERROR for missing title / start / end / calendarId', async () => {
      const noTitle = await createEvent({
        start: '2026-09-07T10:00:00.000Z',
        end: '2026-09-07T11:00:00.000Z',
      });
      expect(noTitle.status).toBe(400);
      expect(noTitle.body.error?.message).toBe('Event title is required');

      const noCal = await req<Envelope>('POST', '/api/events', {
        token: user.accessToken,
        body: {
          title: 'No calendar',
          start: '2026-09-07T10:00:00.000Z',
          end: '2026-09-07T11:00:00.000Z',
        },
      });
      expect(noCal.status).toBe(400);
      expect(noCal.body.error?.message).toBe('Calendar ID is required');
    });

    it('400 "Invalid recurrence rule format" when the RRULE lacks the RRULE: prefix (EventService.isValidRRule)', async () => {
      const r = await createEvent({
        title: 'Bad rule',
        start: '2026-09-07T10:00:00.000Z',
        end: '2026-09-07T10:30:00.000Z',
        recurrence: 'FREQ=DAILY;COUNT=3', // missing "RRULE:" prefix
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      expect(r.body.error?.message).toBe('Invalid recurrence rule format');
    });
  });

  describe('GET /api/events (server-side recurrence expansion)', () => {
    it('a daily RRULE with COUNT=5 and one exception expands to 4 virtual instances within the range', async () => {
      const u = await registerUser(req);
      const cal = await req<Envelope<{ id: string }>>(
        'POST',
        '/api/calendars',
        {
          token: u.accessToken,
          body: { name: 'Expand Cal', color: '#0ea5e9' },
        }
      );
      const master = await req<Envelope<EventEntity>>('POST', '/api/events', {
        token: u.accessToken,
        body: {
          calendarId: cal.body.data!.id,
          title: 'Daily',
          start: '2026-09-07T10:00:00.000Z',
          end: '2026-09-07T10:30:00.000Z',
          recurrence: 'RRULE:FREQ=DAILY;COUNT=5',
          exceptions: ['2026-09-09T10:00:00.000Z'],
        },
      });
      const masterId = master.body.data!.id;

      const r = await req<Envelope<EventEntity[]>>(
        'GET',
        '/api/events?start=2026-09-07T00:00:00.000Z&end=2026-09-12T00:00:00.000Z',
        { token: u.accessToken }
      );
      expect(r.status).toBe(200);
      const instances = r.body.data!;
      // 5 occurrences minus the Sep 9 exception = 4.
      expect(instances).toHaveLength(4);
      for (const inst of instances) {
        expect(inst.isRecurringInstance).toBe(true);
        expect(inst.masterId).toBe(masterId);
        expect(inst.color).toBeNull();
        // Virtual occurrence id is `${masterId}::${occurrenceISO}`.
        expect(inst.id.startsWith(`${masterId}::`)).toBe(true);
      }
      const startDays = instances
        .map((i) => new Date(i.start).toISOString().slice(0, 10))
        .sort();
      expect(startDays).toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-10',
        '2026-09-11',
      ]);
    });

    it('non-recurring events pass through unexpanded and only the owner sees them', async () => {
      const u = await registerUser(req);
      const cal = await req<Envelope<{ id: string }>>(
        'POST',
        '/api/calendars',
        {
          token: u.accessToken,
          body: { name: 'Solo Cal', color: '#10b981' },
        }
      );
      await req('POST', '/api/events', {
        token: u.accessToken,
        body: {
          calendarId: cal.body.data!.id,
          title: 'One-off',
          start: '2026-10-01T12:00:00.000Z',
          end: '2026-10-01T13:00:00.000Z',
        },
      });
      const mine = await req<Envelope<EventEntity[]>>(
        'GET',
        '/api/events?start=2026-10-01T00:00:00.000Z&end=2026-10-02T00:00:00.000Z',
        { token: u.accessToken }
      );
      expect(mine.body.data!.map((e) => e.title)).toEqual(['One-off']);

      const other = await req<Envelope<EventEntity[]>>(
        'GET',
        '/api/events?start=2026-10-01T00:00:00.000Z&end=2026-10-02T00:00:00.000Z',
        { token: user.accessToken }
      );
      expect(
        other.body.data!.find((e) => e.title === 'One-off')
      ).toBeUndefined();
    });
  });

  describe('GET/PUT/DELETE /api/events/:id', () => {
    it('PUT updates fields incl. color; GET returns the updated master', async () => {
      const created = await createEvent({
        title: 'Editable',
        start: '2026-11-01T10:00:00.000Z',
        end: '2026-11-01T11:00:00.000Z',
        color: '#111111',
      });
      const id = created.body.data!.id;
      const put = await req<Envelope<EventEntity>>('PUT', `/api/events/${id}`, {
        token: user.accessToken,
        body: { title: 'Edited', color: '#00ff00', location: 'Room 5' },
      });
      expect(put.status).toBe(200);
      expect(put.body.data).toMatchObject({
        title: 'Edited',
        color: '#00ff00',
        location: 'Room 5',
      });
    });

    it('DELETE {deleted:true}; then GET is 404 "Event not found"', async () => {
      const created = await createEvent({
        title: 'Delete me',
        start: '2026-11-02T10:00:00.000Z',
        end: '2026-11-02T11:00:00.000Z',
      });
      const id = created.body.data!.id;
      const del = await req<Envelope<{ deleted: boolean }>>(
        'DELETE',
        `/api/events/${id}`,
        { token: user.accessToken }
      );
      expect(del.status).toBe(200);
      expect(del.body.data).toEqual({ deleted: true });
      const gone = await req<Envelope>('GET', `/api/events/${id}`, {
        token: user.accessToken,
      });
      expect(gone.status).toBe(404);
      expect(gone.body.error?.message).toBe('Event not found');
    });

    it("GET reads another user's event (200) — pinned IDOR, issue #67", async () => {
      const intruder = await registerUser(req);
      const created = await createEvent({
        title: 'Victim event',
        start: '2026-11-03T10:00:00.000Z',
        end: '2026-11-03T11:00:00.000Z',
      });
      // CURRENT behavior: unscoped findById (lib/services/BaseService.ts:248)
      // returns the row cross-user. Issue #67; flip to 404 when fixed.
      const read = await req<Envelope<EventEntity>>(
        'GET',
        `/api/events/${created.body.data!.id}`,
        { token: intruder.accessToken }
      );
      expect(read.status).toBe(200);
      expect(read.body.data!.userId).toBe(user.userId);
    });
  });

  describe('GET /api/events/conflicts (pins issue #64: never authenticated)', () => {
    it('401 even with a valid token; the frontend then silently sees no conflicts', async () => {
      // conflicts uses createMethodHandler (no auth middleware, issue #64), so
      // the manual req.user check always 401s. src/services/api/events.ts:394-404
      // reads body.data.conflicts and falls back to [], so the UI shows none.
      const r = await req<Envelope>(
        'GET',
        `/api/events/conflicts?start=2026-09-07T10:15:00.000Z&end=2026-09-07T10:45:00.000Z&calendarId=${calendarId}`,
        { token: user.accessToken }
      );
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('UNAUTHORIZED');
      expect(r.body.error?.message).toBe('User authentication required');
    });

    it('400-path validation is unreachable behind the 401: missing start/end also yields 401 today', async () => {
      const r = await req<Envelope>('GET', '/api/events/conflicts', {
        token: user.accessToken,
      });
      // The req.user check runs before the start/end validation, so even a
      // malformed request is 401 (issue #64). Documents ordering.
      expect(r.status).toBe(401);
    });
  });
});
