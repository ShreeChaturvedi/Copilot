/**
 * L3 — /api/calendars* contracts through the real dispatcher, CalendarService
 * and Postgres. Field names pinned to src/services/api/calendars.ts, which maps
 * server `isVisible` -> client `visible` and reads id/name/color/description/
 * isDefault/userId/createdAt/updatedAt (calendars.ts:95-105 et al).
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
  error?: { code: string; message: string; timestamp: string };
}

interface CalendarEntity {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isVisible: boolean;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number };
}

describe.skipIf(!dbAvailable)('L3 calendars contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;
  let user: TestUser;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
    user = await registerUser(req);
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  const createCal = (body: Record<string, unknown>, u: TestUser = user) =>
    req<Envelope<CalendarEntity>>('POST', '/api/calendars', {
      token: u.accessToken,
      body,
    });

  it('POST 201: first calendar becomes isDefault; the client reads isVisible (mapped to `visible`, calendars.ts:95-105)', async () => {
    const u = await registerUser(req);
    const r = await createCal({ name: 'Work', color: '#10b981' }, u);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      name: 'Work',
      color: '#10b981',
      description: null,
      isVisible: true,
      isDefault: true, // first calendar for the user
      userId: u.userId,
    });

    const second = await createCal({ name: 'Home', color: '#0ea5e9' }, u);
    expect(second.body.data!.isDefault).toBe(false);
  });

  it('POST 400 VALIDATION_ERROR: name and color are both required (color required only here, not in task-lists)', async () => {
    const noName = await createCal({ color: '#333333' });
    expect(noName.status).toBe(400);
    expect(noName.body.error?.message).toBe('Calendar name is required');

    const noColor = await createCal({ name: 'Colorless' });
    expect(noColor.status).toBe(400);
    expect(noColor.body.error?.message).toBe('Calendar color is required');
  });

  it('POST duplicate name -> 400 (CalendarService name-uniqueness per user)', async () => {
    const u = await registerUser(req);
    await createCal({ name: 'Dupe', color: '#111111' }, u);
    const r = await createCal({ name: 'Dupe', color: '#222222' }, u);
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('GET list is a plain array under data; ?withEventCounts=true adds eventCount (fetchCalendars, calendars.ts:73-105)', async () => {
    const u = await registerUser(req);
    const cal = await createCal({ name: 'Counted', color: '#10b981' }, u);
    await req('POST', '/api/events', {
      token: u.accessToken,
      body: {
        title: 'One event',
        start: '2026-09-01T10:00:00.000Z',
        end: '2026-09-01T11:00:00.000Z',
        calendarId: cal.body.data!.id,
      },
    });

    const plain = await req<Envelope<CalendarEntity[]>>(
      'GET',
      '/api/calendars',
      { token: u.accessToken }
    );
    expect(plain.status).toBe(200);
    expect(Array.isArray(plain.body.data)).toBe(true);
    expect(plain.body.data!.map((c) => c.name)).toEqual(['Counted']);

    const counted = await req<Envelope<CalendarEntity[]>>(
      'GET',
      '/api/calendars?withEventCounts=true',
      { token: u.accessToken }
    );
    expect(counted.status).toBe(200);
    // getWithEventCounts embeds the count as `_count.events`
    // (lib/services/CalendarService.ts:30-33).
    const c = counted.body.data!.find((x) => x.id === cal.body.data!.id)!;
    expect(c._count?.events).toBe(1);
  });

  it('PUT updates name/color/description/isVisible (payload from calendars.ts:169-175)', async () => {
    const created = await createCal({ name: 'Editable', color: '#111111' });
    const r = await req<Envelope<CalendarEntity>>(
      'PUT',
      `/api/calendars/${created.body.data!.id}`,
      {
        token: user.accessToken,
        body: {
          name: 'Edited',
          color: '#222222',
          description: 'now described',
          isVisible: false,
        },
      }
    );
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      name: 'Edited',
      color: '#222222',
      description: 'now described',
      isVisible: false,
    });
  });

  it('PATCH ?action=toggle-visibility flips isVisible (client calls this at calendars.ts:261)', async () => {
    const created = await createCal({ name: 'Blinky', color: '#111111' });
    const id = created.body.data!.id;
    const off = await req<Envelope<CalendarEntity>>(
      'PATCH',
      `/api/calendars/${id}?action=toggle-visibility`,
      { token: user.accessToken }
    );
    expect(off.status).toBe(200);
    expect(off.body.data!.isVisible).toBe(false);
    const on = await req<Envelope<CalendarEntity>>(
      'PATCH',
      `/api/calendars/${id}?action=toggle-visibility`,
      { token: user.accessToken }
    );
    expect(on.body.data!.isVisible).toBe(true);
  });

  it('PATCH ?action=set-default moves the default flag exclusively (calendars.ts:297)', async () => {
    const u = await registerUser(req);
    const first = await createCal({ name: 'First', color: '#111111' }, u);
    const second = await createCal({ name: 'Second', color: '#222222' }, u);
    expect(first.body.data!.isDefault).toBe(true);

    const r = await req<Envelope<CalendarEntity>>(
      'PATCH',
      `/api/calendars/${second.body.data!.id}?action=set-default`,
      { token: u.accessToken }
    );
    expect(r.status).toBe(200);
    expect(r.body.data!.isDefault).toBe(true);

    const list = await req<Envelope<CalendarEntity[]>>(
      'GET',
      '/api/calendars',
      {
        token: u.accessToken,
      }
    );
    const defaults = list.body.data!.filter((c) => c.isDefault);
    expect(defaults.map((c) => c.name)).toEqual(['Second']);
  });

  it('DELETE {deleted:true}; events in the calendar cascade away (needs a 2nd calendar: the only-calendar guard blocks otherwise)', async () => {
    const u = await registerUser(req);
    const cal = await createCal({ name: 'Doomed', color: '#000000' }, u);
    // A second calendar so CalendarService.delete's "Cannot delete the only
    // calendar" guard (lib/services/CalendarService.ts) doesn't fire.
    await createCal({ name: 'Keeper', color: '#10b981' }, u);
    const ev = await req<Envelope<{ id: string }>>('POST', '/api/events', {
      token: u.accessToken,
      body: {
        title: 'Doomed event',
        start: '2026-09-01T10:00:00.000Z',
        end: '2026-09-01T11:00:00.000Z',
        calendarId: cal.body.data!.id,
      },
    });
    expect(ev.status).toBe(201);

    const del = await req<Envelope<{ deleted: boolean }>>(
      'DELETE',
      `/api/calendars/${cal.body.data!.id}`,
      { token: u.accessToken }
    );
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({ deleted: true });

    // events.calendarId is ON DELETE CASCADE, so the event is gone.
    const gone = await req<Envelope>('GET', `/api/events/${ev.body.data!.id}`, {
      token: u.accessToken,
    });
    expect(gone.status).toBe(404);
  });

  it("deleting a user's only calendar is blocked by the guard (row survives)", async () => {
    const u = await registerUser(req);
    const cal = await createCal({ name: 'Solo', color: '#111111' }, u);
    const del = await req<Envelope>(
      'DELETE',
      `/api/calendars/${cal.body.data!.id}`,
      {
        token: u.accessToken,
      }
    );
    // The service throws VALIDATION_ERROR: "Cannot delete the only calendar";
    // the DELETE handler doesn't map that string, so it surfaces as 500. The
    // point pinned here is that the calendar is NOT deleted.
    expect(del.status).toBeGreaterThanOrEqual(400);
    const still = await req<Envelope>(
      'GET',
      `/api/calendars/${cal.body.data!.id}`,
      {
        token: u.accessToken,
      }
    );
    expect(still.status).toBe(200);
  });

  it('404 "Calendar not found" for an unknown id', async () => {
    const r = await req<Envelope>('GET', '/api/calendars/none', {
      token: user.accessToken,
    });
    expect(r.status).toBe(404);
    expect(r.body.error?.message).toBe('Calendar not found');
  });
});
