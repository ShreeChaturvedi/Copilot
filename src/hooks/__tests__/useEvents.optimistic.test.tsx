/**
 * Optimistic-update + rollback coverage for the event mutations (issue #21,
 * test-audit §L4 / §6.5). Real api client (src/services/api/events) over MSW.
 *
 * Note on create-rollback: eventApi.createEvent swallows a backend 5xx and
 * falls back to localStorage, so a create resolves even when the server errors
 * — there is no rollback to assert on that path. Rollback is therefore covered
 * through update and delete, whose clients reject cleanly on a 5xx.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import type { CalendarEvent } from '@shared/types';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  eventQueryKeys,
} from '../useEvents';
import { deferred, makeWrapper, ok, fail } from '@/test/optimistic';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
import { toast } from 'sonner';

interface Row {
  id: string;
  title: string;
  start: string;
  end: string;
  calendarName: string;
}

let db: Row[] = [];
const START = '2026-06-02T09:00:00.000Z';
const END = '2026-06-02T10:00:00.000Z';

const evt = (id: string, title: string): Row => ({
  id,
  title,
  start: START,
  end: END,
  calendarName: 'Personal',
});

function seed(rows: Row[]) {
  db = rows.map((r) => ({ ...r }));
}

const getEvents = http.get('/api/events', () => ok(db));
// createEvent resolves calendarName -> id via this GET before POSTing
const getCalendars = http.get('/api/calendars', () =>
  ok([
    {
      id: 'cal-1',
      name: 'Personal',
      color: '#3B82F6',
      isVisible: true,
      isDefault: true,
    },
  ])
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

function useEventHarness() {
  return {
    events: useEvents(),
    create: useCreateEvent(),
    update: useUpdateEvent(),
    del: useDeleteEvent(),
  };
}

async function mountEvents() {
  const { Wrapper, queryClient } = makeWrapper();
  const { result } = renderHook(() => useEventHarness(), { wrapper: Wrapper });
  await waitFor(() =>
    expect(
      queryClient.getQueryData<CalendarEvent[]>(eventQueryKeys.all)
    ).toHaveLength(db.length)
  );
  return { result, queryClient };
}

const cache = (qc: ReturnType<typeof makeWrapper>['queryClient']) =>
  qc.getQueryData<CalendarEvent[]>(eventQueryKeys.all) ?? [];

describe('useEvents — create (optimistic)', () => {
  it('inserts a temp event immediately, then commits the server event', async () => {
    seed([evt('a', 'Standup')]);
    const gate = deferred();
    server.use(
      getEvents,
      getCalendars,
      http.post('/api/events', async () => {
        await gate.promise;
        db.push(evt('srv-new', 'Review'));
        return ok(db[db.length - 1]);
      })
    );
    const { result, queryClient } = await mountEvents();

    act(() =>
      result.current.create.mutate({
        title: 'Review',
        start: new Date(START),
        end: new Date(END),
        calendarName: 'Personal',
      })
    );

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(2);
      expect(c.some((e) => e.id.startsWith('temp-'))).toBe(true);
    });

    gate.resolve();

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c.some((e) => e.id === 'srv-new')).toBe(true);
      expect(c.some((e) => e.id.startsWith('temp-'))).toBe(false);
    });
  });
});

describe('useEvents — update (optimistic)', () => {
  it('applies the new title immediately and keeps it on success', async () => {
    seed([evt('a', 'Standup')]);
    const gate = deferred();
    server.use(
      getEvents,
      http.put('/api/events/:id', async () => {
        await gate.promise;
        db[0] = { ...db[0], title: 'Standup moved' };
        return ok(db[0]);
      })
    );
    const { result, queryClient } = await mountEvents();

    act(() =>
      result.current.update.mutate({
        id: 'a',
        data: { title: 'Standup moved' },
      })
    );

    await waitFor(() =>
      expect(cache(queryClient).find((e) => e.id === 'a')?.title).toBe(
        'Standup moved'
      )
    );

    gate.resolve();

    await waitFor(() =>
      expect(cache(queryClient).find((e) => e.id === 'a')?.title).toBe(
        'Standup moved'
      )
    );
  });

  it('reverts the title when the update fails (5xx)', async () => {
    seed([evt('a', 'Standup')]);
    const gate = deferred();
    server.use(
      getEvents,
      http.put('/api/events/:id', async () => {
        await gate.promise;
        return fail('nope');
      })
    );
    const { result, queryClient } = await mountEvents();

    act(() =>
      result.current.update.mutate({
        id: 'a',
        data: { title: 'Standup moved' },
      })
    );

    await waitFor(() =>
      expect(cache(queryClient).find((e) => e.id === 'a')?.title).toBe(
        'Standup moved'
      )
    );

    gate.resolve();

    await waitFor(() =>
      expect(cache(queryClient).find((e) => e.id === 'a')?.title).toBe(
        'Standup'
      )
    );
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useEvents — delete (optimistic)', () => {
  it('removes the event immediately and commits on success', async () => {
    seed([evt('a', 'Standup'), evt('b', 'Lunch')]);
    const gate = deferred();
    server.use(
      getEvents,
      http.delete('/api/events/:id', async () => {
        await gate.promise;
        db = db.filter((r) => r.id !== 'a');
        return ok({});
      })
    );
    const { result, queryClient } = await mountEvents();

    act(() => result.current.del.mutate('a'));

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(1);
      expect(c.some((e) => e.id === 'a')).toBe(false);
    });

    gate.resolve();

    await waitFor(() => expect(cache(queryClient)).toHaveLength(1));
  });

  it('restores the event when the delete fails (5xx)', async () => {
    seed([evt('a', 'Standup'), evt('b', 'Lunch')]);
    const gate = deferred();
    server.use(
      getEvents,
      http.delete('/api/events/:id', async () => {
        await gate.promise;
        return fail('delete blew up');
      })
    );
    const { result, queryClient } = await mountEvents();

    act(() => result.current.del.mutate('a'));

    await waitFor(() => expect(cache(queryClient)).toHaveLength(1));

    gate.resolve();

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(2);
      expect(c.some((e) => e.id === 'a')).toBe(true);
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
