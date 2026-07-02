/**
 * L3 — /api/task-lists* contracts through the real dispatcher, TaskListService
 * and Postgres. The frontend consumes task lists via useTaskManagement /
 * dialogs; the archive flow (migration 006) is exercised end to end.
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

interface TaskListEntity {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  userId: string;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

describe.skipIf(!dbAvailable)('L3 task-lists contracts', () => {
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

  const createList = (body: Record<string, unknown>, u: TestUser = user) =>
    req<Envelope<TaskListEntity>>('POST', '/api/task-lists', {
      token: u.accessToken,
      body,
    });

  it('POST 201 returns the full entity incl. isArchived:false/archivedAt:null (migration 006 fields)', async () => {
    const r = await createList({
      name: 'Groceries',
      color: '#8B5CF6',
      icon: 'cart',
      description: 'shopping',
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      name: 'Groceries',
      color: '#8B5CF6',
      icon: 'cart',
      description: 'shopping',
      userId: user.userId,
      isArchived: false,
      archivedAt: null,
    });
  });

  it('POST 400 VALIDATION_ERROR without name and without color', async () => {
    const noName = await createList({ color: '#fff' });
    expect(noName.status).toBe(400);
    expect(noName.body.error?.code).toBe('VALIDATION_ERROR');

    const noColor = await createList({ name: 'Colorless' });
    expect(noColor.status).toBe(400);
    expect(noColor.body.error?.message).toBe('Task list color is required');
  });

  it('POST duplicate name for the same user -> 400 "Task list name already exists"', async () => {
    const u = await registerUser(req);
    await createList({ name: 'Dupe', color: '#111111' }, u);
    const r = await createList({ name: 'Dupe', color: '#222222' }, u);
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    expect(r.body.error?.message).toBe('Task list name already exists');
  });

  it('GET list excludes archived by default; ?archived=true returns only archived', async () => {
    const u = await registerUser(req);
    const active = await createList({ name: 'Active', color: '#10b981' }, u);
    const toArchive = await createList({ name: 'Old', color: '#64748b' }, u);

    const arch = await req<Envelope<TaskListEntity>>(
      'PATCH',
      `/api/task-lists/${toArchive.body.data!.id}?action=archive`,
      { token: u.accessToken }
    );
    expect(arch.status).toBe(200);
    expect(arch.body.data).toMatchObject({ isArchived: true });
    expect(arch.body.data!.archivedAt).not.toBeNull();

    const defaultList = await req<Envelope<TaskListEntity[]>>(
      'GET',
      '/api/task-lists',
      { token: u.accessToken }
    );
    expect(defaultList.status).toBe(200);
    expect(defaultList.body.data!.map((l) => l.name)).toEqual(['Active']);
    expect(defaultList.body.data![0].id).toBe(active.body.data!.id);

    const archived = await req<Envelope<TaskListEntity[]>>(
      'GET',
      '/api/task-lists?archived=true',
      { token: u.accessToken }
    );
    expect(archived.body.data!.map((l) => l.name)).toEqual(['Old']);

    // Unarchive brings it back.
    const un = await req<Envelope<TaskListEntity>>(
      'PATCH',
      `/api/task-lists/${toArchive.body.data!.id}?action=unarchive`,
      { token: u.accessToken }
    );
    expect(un.body.data).toMatchObject({ isArchived: false, archivedAt: null });
    const after = await req<Envelope<TaskListEntity[]>>(
      'GET',
      '/api/task-lists',
      { token: u.accessToken }
    );
    expect(after.body.data!.map((l) => l.name).sort()).toEqual([
      'Active',
      'Old',
    ]);
  });

  it('PUT updates name/color; GET/:id returns the entity', async () => {
    const created = await createList({ name: 'Rename me', color: '#111111' });
    const id = created.body.data!.id;
    const put = await req<Envelope<TaskListEntity>>(
      'PUT',
      `/api/task-lists/${id}`,
      { token: user.accessToken, body: { name: 'Renamed', color: '#222222' } }
    );
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ name: 'Renamed', color: '#222222' });

    const get = await req<Envelope<TaskListEntity>>(
      'GET',
      `/api/task-lists/${id}`,
      { token: user.accessToken }
    );
    expect(get.status).toBe(200);
    expect(get.body.data!.name).toBe('Renamed');
  });

  it('DELETE {deleted:true}; tasks in the deleted list are MOVED to the default list, not destroyed', async () => {
    const u = await registerUser(req);
    // A first task seeds the "General" default list; then a second list holds
    // the task we will orphan by deleting its list.
    await req('POST', '/api/tasks', {
      token: u.accessToken,
      body: { title: 'seed default list' },
    });
    const list = await createList({ name: 'Doomed', color: '#000000' }, u);
    const task = await req<Envelope<{ id: string; taskListId: string }>>(
      'POST',
      '/api/tasks',
      {
        token: u.accessToken,
        body: { title: 'Rehomed task', taskListId: list.body.data!.id },
      }
    );
    expect(task.status).toBe(201);

    const del = await req<Envelope<{ deleted: boolean }>>(
      'DELETE',
      `/api/task-lists/${list.body.data!.id}`,
      { token: u.accessToken }
    );
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({ deleted: true });

    // TaskListService.delete reassigns tasks to the default list before
    // dropping the row (lib/services/TaskListService.ts), so the task survives
    // and now lives in a different list.
    const moved = await req<Envelope<{ id: string; taskListId: string }>>(
      'GET',
      `/api/tasks/${task.body.data!.id}`,
      { token: u.accessToken }
    );
    expect(moved.status).toBe(200);
    expect(moved.body.data!.taskListId).not.toBe(list.body.data!.id);
  });

  it('404 "Task list not found" for an unknown id', async () => {
    const r = await req<Envelope>('GET', '/api/task-lists/none', {
      token: user.accessToken,
    });
    expect(r.status).toBe(404);
    expect(r.body.error?.message).toBe('Task list not found');
  });

  it('GET /api/task-lists/stats -> 401 even with a valid token (pins issue #64)', async () => {
    const r = await req<Envelope>('GET', '/api/task-lists/stats', {
      token: user.accessToken,
    });
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe('UNAUTHORIZED');
  });
});
