/**
 * Optimistic-update + rollback coverage for the task mutations (issue #21,
 * test-audit §L4 / §6.5). Exercises the real api client (src/services/api/tasks)
 * over MSW — no service mock — and asserts the mid-flight optimistic cache
 * write, then the commit on success and the rollback to the prior snapshot on a
 * 5xx. Covers create, update, the tag add/remove path, and delete.
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
import type { Task } from '@shared/types';
import { useTasks, taskQueryKeys } from '../useTasks';
import { deferred, makeWrapper, ok, fail } from '@/test/optimistic';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
import { toast } from 'sonner';

const ISO = '2026-06-01T12:00:00.000Z';

interface Row {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  tags?: Array<Record<string, unknown>>;
}

let db: Row[] = [];

const row = (id: string, title: string, extra: Partial<Row> = {}): Row => ({
  id,
  title,
  completed: false,
  priority: 'MEDIUM',
  status: 'NOT_STARTED',
  createdAt: ISO,
  updatedAt: ISO,
  ...extra,
});

function seed(rows: Row[]) {
  db = rows.map((r) => ({ ...r }));
}

/** GET always mirrors the in-memory db so a post-settle refetch is consistent. */
const getTasks = http.get('/api/tasks', () => ok(db));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

/** Render useTasks and wait until the seeded rows are in the cache. */
async function mountTasks() {
  const { Wrapper, queryClient } = makeWrapper();
  const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
  await waitFor(() =>
    expect(queryClient.getQueryData<Task[]>(taskQueryKeys.all)).toHaveLength(
      db.length
    )
  );
  return { result, queryClient };
}

const cache = (qc: ReturnType<typeof makeWrapper>['queryClient']) =>
  qc.getQueryData<Task[]>(taskQueryKeys.all) ?? [];

describe('useTasks — create (optimistic)', () => {
  it('inserts a temp task immediately, then commits the server task', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.post('/api/tasks', async () => {
        await gate.promise;
        db.push(row('srv-new', 'Gamma'));
        return ok(db[db.length - 1]);
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() => result.current.addTask.mutate({ title: 'Gamma' }));

    // Optimistic: a temp row is prepended before the request resolves
    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(3);
      expect(c[0].id).toMatch(/^temp-/);
      expect(c[0].title).toBe('Gamma');
    });

    gate.resolve();

    // Commit: temp replaced by the real server row
    await waitFor(() => {
      const c = cache(queryClient);
      expect(c.some((t) => t.id === 'srv-new')).toBe(true);
      expect(c.some((t) => t.id.startsWith('temp-'))).toBe(false);
    });
  });

  it('rolls back the temp task when the create fails (5xx)', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.post('/api/tasks', async () => {
        await gate.promise;
        return fail('server on fire');
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() => result.current.addTask.mutate({ title: 'Gamma' }));

    await waitFor(() => expect(cache(queryClient)).toHaveLength(3));

    gate.resolve();

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(2);
      expect(c.some((t) => t.id.startsWith('temp-'))).toBe(false);
    });
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useTasks — update (optimistic)', () => {
  it('applies the new title immediately and keeps it on success', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.put('/api/tasks/:id', async () => {
        await gate.promise;
        db[0] = { ...db[0], title: 'Alpha edited' };
        return ok(db[0]);
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() =>
      result.current.updateTask.mutate({
        id: 'a',
        updates: { title: 'Alpha edited' },
      })
    );

    await waitFor(() =>
      expect(cache(queryClient).find((t) => t.id === 'a')?.title).toBe(
        'Alpha edited'
      )
    );

    gate.resolve();

    await waitFor(() =>
      expect(cache(queryClient).find((t) => t.id === 'a')?.title).toBe(
        'Alpha edited'
      )
    );
  });

  it('reverts the title when the update fails (5xx)', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.put('/api/tasks/:id', async () => {
        await gate.promise;
        return fail('nope');
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() =>
      result.current.updateTask.mutate({
        id: 'a',
        updates: { title: 'Alpha edited' },
      })
    );

    await waitFor(() =>
      expect(cache(queryClient).find((t) => t.id === 'a')?.title).toBe(
        'Alpha edited'
      )
    );

    gate.resolve();

    await waitFor(() =>
      expect(cache(queryClient).find((t) => t.id === 'a')?.title).toBe('Alpha')
    );
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useTasks — tag add/remove (optimistic via update)', () => {
  const tag = {
    id: 'tag-1',
    type: 'label' as const,
    value: 'urgent',
    displayText: 'urgent',
    iconName: 'Tag',
  };

  it('rolls back an added tag when the update fails', async () => {
    seed([row('a', 'Alpha')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.put('/api/tasks/:id', async () => {
        await gate.promise;
        return fail('tag write failed');
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() =>
      result.current.updateTask.mutate({
        id: 'a',
        updates: { tags: [tag] },
      })
    );

    // Optimistic: tag appears on the row
    await waitFor(() =>
      expect(cache(queryClient).find((t) => t.id === 'a')?.tags).toHaveLength(1)
    );

    gate.resolve();

    // Rollback: tag list returns to empty
    await waitFor(() => {
      const t = cache(queryClient).find((x) => x.id === 'a');
      expect(t?.tags ?? []).toHaveLength(0);
    });
  });

  it('removes a tag optimistically and commits on success', async () => {
    seed([row('a', 'Alpha', { tags: [tag] })]);
    const gate = deferred();
    server.use(
      getTasks,
      http.put('/api/tasks/:id', async () => {
        await gate.promise;
        db[0] = { ...db[0], tags: [] };
        return ok(db[0]);
      })
    );
    const { result, queryClient } = await mountTasks();
    expect(cache(queryClient).find((t) => t.id === 'a')?.tags).toHaveLength(1);

    act(() =>
      result.current.updateTask.mutate({ id: 'a', updates: { tags: [] } })
    );

    await waitFor(() =>
      expect(
        cache(queryClient).find((t) => t.id === 'a')?.tags ?? []
      ).toHaveLength(0)
    );

    gate.resolve();

    await waitFor(() =>
      expect(
        cache(queryClient).find((t) => t.id === 'a')?.tags ?? []
      ).toHaveLength(0)
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('useTasks — delete (optimistic)', () => {
  it('removes the row immediately and commits on success', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.delete('/api/tasks/:id', async () => {
        await gate.promise;
        db = db.filter((r) => r.id !== 'a');
        return ok({});
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() => result.current.deleteTask.mutate('a'));

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(1);
      expect(c.some((t) => t.id === 'a')).toBe(false);
    });

    gate.resolve();

    await waitFor(() => expect(cache(queryClient)).toHaveLength(1));
  });

  it('restores the row when the delete fails (5xx)', async () => {
    seed([row('a', 'Alpha'), row('b', 'Bravo')]);
    const gate = deferred();
    server.use(
      getTasks,
      http.delete('/api/tasks/:id', async () => {
        await gate.promise;
        return fail('delete blew up');
      })
    );
    const { result, queryClient } = await mountTasks();

    act(() => result.current.deleteTask.mutate('a'));

    await waitFor(() => expect(cache(queryClient)).toHaveLength(1));

    gate.resolve();

    await waitFor(() => {
      const c = cache(queryClient);
      expect(c).toHaveLength(2);
      expect(c.some((t) => t.id === 'a')).toBe(true);
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
