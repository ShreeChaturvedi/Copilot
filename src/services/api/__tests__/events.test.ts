/**
 * Regression tests for the event API service layer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventApi } from '../events';
import { calendarApi } from '../calendars';

vi.mock('../calendars', () => ({
  calendarApi: {
    fetchCalendars: vi.fn(),
  },
}));

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const okEvent = {
  id: 'evt-1',
  title: 'Standup',
  start: '2026-07-10T10:00:00.000Z',
  end: '2026-07-10T11:00:00.000Z',
  calendar: { name: 'Personal' },
};

describe('eventApi.updateEvent (#38: calendar change must persist)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse({ success: true, data: okEvent }));
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(calendarApi.fetchCalendars).mockResolvedValue([
      { id: 'cal-work', name: 'Work', color: '#3B82F6', visible: true },
      { id: 'cal-personal', name: 'Personal', color: '#10B981', visible: true },
    ] as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const putBody = () => {
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(call, 'a PUT request should be issued').toBeTruthy();
    return JSON.parse((call![1] as RequestInit).body as string);
  };

  it('resolves calendarName to calendarId and does not send calendarName', async () => {
    await eventApi.updateEvent('evt-1', {
      title: 'Standup',
      calendarName: 'Personal',
    });

    const body = putBody();
    expect(body.calendarId).toBe('cal-personal');
    expect(body).not.toHaveProperty('calendarName');
  });

  it('falls back to calendarName when the calendar cannot be resolved', async () => {
    vi.mocked(calendarApi.fetchCalendars).mockRejectedValueOnce(
      new Error('offline')
    );

    await eventApi.updateEvent('evt-1', {
      title: 'Standup',
      calendarName: 'Personal',
    });

    const body = putBody();
    expect(body.calendarId).toBeUndefined();
    expect(body.calendarName).toBe('Personal');
  });

  it('sends no calendar field when the update does not change the calendar', async () => {
    await eventApi.updateEvent('evt-1', { title: 'Renamed' });

    const body = putBody();
    expect(body).not.toHaveProperty('calendarId');
    expect(body).not.toHaveProperty('calendarName');
  });
});
