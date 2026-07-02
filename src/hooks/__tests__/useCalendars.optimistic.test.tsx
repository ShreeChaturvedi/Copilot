/**
 * Optimistic-update + rollback coverage for the calendar mutations (issue #21,
 * test-audit §L4 / §6.5). Real api client (src/services/api/calendars) over MSW.
 * Covers add, update, delete and the visibility toggle: the optimistic cache
 * write, commit on success, and rollback to the prior snapshot on a 5xx.
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
import type { Calendar } from '@shared/types';
import { useCalendars, calendarQueryKeys } from '../useCalendars';
import { deferred, makeWrapper, ok, fail } from '@/test/optimistic';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
import { toast } from 'sonner';

interface Row {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  isDefault: boolean;
}

let db: Row[] = [];

const cal = (id: string, name: string, extra: Partial<Row> = {}): Row => ({
  id,
  name,
  color: '#3B82F6',
  isVisible: true,
  isDefault: false,
  ...extra,
});

function seed(rows: Row[]) {
  db = rows.map((r) => ({ ...r }));
}

const getCalendars = http.get('/api/calendars', () => ok(db));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

async function mountCalendars() {
  const { Wrapper, queryClient } = makeWrapper();
  const { result } = renderHook(() => useCalendars(), { wrapper: Wrapper });
  await waitFor(() =>
    expect(
      queryClient.getQueryData<Calendar[]>(calendarQueryKeys.all)
    ).toHaveLength(db.length)
  );
  return { result, queryClient };
}

const cache = (qc: ReturnType<typeof makeWrapper>['queryClient']) =>
  qc.getQueryData<Calendar[]>(calendarQueryKeys.all) ?? [];
const byName = (
  qc: ReturnType<typeof makeWrapper>['queryClient'],
  name: string
) => cache(qc).find((c) => c.name === name);

describe('useCalendars — add (optimistic)', () => {
  it('inserts a temp calendar immediately, then commits the server one', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.post('/api/calendars', async () => {
        await gate.promise;
        db.push(cal('cal-3', 'Archive', { color: '#10B981' }));
        return ok(db[db.length - 1]);
      })
    );
    const { result, queryClient } = await mountCalendars();

    act(() =>
      result.current.addCalendar.mutate({ name: 'Archive', color: '#10B981' })
    );

    await waitFor(() => {
      expect(cache(queryClient)).toHaveLength(3);
      expect(byName(queryClient, 'Archive')).toBeTruthy();
    });

    gate.resolve();

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c.some((x) => x.id === 'cal-3')).toBe(true);
      expect(c.some((x) => String(x.id).startsWith('temp-'))).toBe(false);
    });
  });

  it('rolls back the temp calendar when the add fails (5xx)', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.post('/api/calendars', async () => {
        await gate.promise;
        return fail('server on fire');
      })
    );
    const { result, queryClient } = await mountCalendars();

    act(() =>
      result.current.addCalendar.mutate({ name: 'Archive', color: '#10B981' })
    );

    await waitFor(() => expect(cache(queryClient)).toHaveLength(3));

    gate.resolve();

    await waitFor(() => {
      expect(cache(queryClient)).toHaveLength(2);
      expect(byName(queryClient, 'Archive')).toBeUndefined();
    });
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useCalendars — update (optimistic)', () => {
  it('reverts the color when the update fails (5xx)', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.put('/api/calendars/:id', async () => {
        await gate.promise;
        return fail('nope');
      })
    );
    const { result, queryClient } = await mountCalendars();

    act(() =>
      result.current.updateCalendar.mutate({
        name: 'Work',
        updates: { color: '#000000' },
      })
    );

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.color).toBe('#000000')
    );

    gate.resolve();

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.color).toBe('#3B82F6')
    );
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useCalendars — delete (optimistic)', () => {
  it('restores the calendar when the delete fails (5xx)', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.delete('/api/calendars/:id', async () => {
        await gate.promise;
        return fail('delete blew up');
      })
    );
    const { result, queryClient } = await mountCalendars();

    act(() => result.current.deleteCalendar.mutate('Work'));

    await waitFor(() => {
      expect(cache(queryClient)).toHaveLength(1);
      expect(byName(queryClient, 'Work')).toBeUndefined();
    });

    gate.resolve();

    await waitFor(() => {
      expect(cache(queryClient)).toHaveLength(2);
      expect(byName(queryClient, 'Work')).toBeTruthy();
    });
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useCalendars — toggle visibility (optimistic)', () => {
  it('flips visibility immediately and commits on success', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.patch('/api/calendars/:id', async () => {
        await gate.promise;
        db[1] = { ...db[1], isVisible: false };
        return ok(db[1]);
      })
    );
    const { result, queryClient } = await mountCalendars();
    expect(byName(queryClient, 'Work')?.visible).toBe(true);

    act(() => result.current.toggleCalendar.mutate('Work'));

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.visible).toBe(false)
    );

    gate.resolve();

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.visible).toBe(false)
    );
  });

  it('reverts visibility when the toggle fails (5xx)', async () => {
    seed([cal('cal-1', 'Personal', { isDefault: true }), cal('cal-2', 'Work')]);
    const gate = deferred();
    server.use(
      getCalendars,
      http.patch('/api/calendars/:id', async () => {
        await gate.promise;
        return fail('nope');
      })
    );
    const { result, queryClient } = await mountCalendars();

    act(() => result.current.toggleCalendar.mutate('Work'));

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.visible).toBe(false)
    );

    gate.resolve();

    await waitFor(() =>
      expect(byName(queryClient, 'Work')?.visible).toBe(true)
    );
  });
});
