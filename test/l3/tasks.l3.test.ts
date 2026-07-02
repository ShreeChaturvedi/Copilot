/**
 * L3 — /api/tasks* contracts through the real dispatcher, TaskService and
 * Postgres. Field names are pinned to what the frontend client actually reads
 * in src/services/api/tasks.ts (reviveTaskDates, tasks.ts:59-144; list unwrap
 * `body.data?.data ?? body.data`, tasks.ts:184-186).
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
  TAG_PREFIX,
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

interface TagRelation {
  id: string;
  value: string;
  displayText: string;
  iconName: string;
  tag: { id: string; name: string; type: string; color: string | null };
}

interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  taskListId: string;
  taskList?: { id: string; name: string; color: string };
  tags?: TagRelation[];
  attachments?: unknown[];
  createdAt: string;
  updatedAt: string;
}

type TaskList = Envelope<{ data: Task[] }>;

describe.skipIf(!dbAvailable)('L3 tasks contracts', () => {
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

  const createTask = async (
    body: Record<string, unknown>,
    u: TestUser = user
  ) =>
    req<Envelope<Task>>('POST', '/api/tasks', { token: u.accessToken, body });

  describe('POST /api/tasks', () => {
    it('201 minimal create: auto-creates the "General" default list and returns the full entity reviveTaskDates consumes (tasks.ts:59-144)', async () => {
      const r = await createTask({ title: 'Minimal task' });
      expect(r.status).toBe(201);
      const t = r.body.data!;
      expect(t).toMatchObject({
        title: 'Minimal task',
        description: null,
        completed: false,
        completedAt: null,
        scheduledDate: null,
        priority: 'MEDIUM', // uppercase from backend; client lowercases (tasks.ts:64-67)
        status: 'NOT_STARTED', // client maps to lowercase status (tasks.ts:79-90)
        userId: user.userId,
      });
      expect(t.id).toEqual(expect.any(String));
      // Default list handling (TaskService.getOrCreateDefaultTaskList): name
      // 'General', color '#8B5CF6'; taskList relation is embedded.
      expect(t.taskList).toMatchObject({ name: 'General', color: '#8B5CF6' });
      expect(t.taskListId).toBe(t.taskList!.id);
      expect(t.tags).toEqual([]);
      expect(t.attachments).toEqual([]);
      expect(new Date(t.createdAt).getTime()).not.toBeNaN();
      expect(new Date(t.updatedAt).getTime()).not.toBeNaN();
    });

    it('201 full create: description, priority, scheduledDate and the tag relation shape (tags[].{id,value,displayText,iconName,tag.{id,name,type,color}}, tasks.ts:116-141)', async () => {
      const tagName = `${TAG_PREFIX}focus`;
      const r = await createTask({
        title: 'Full task',
        description: 'Write the L3 suite',
        priority: 'HIGH',
        scheduledDate: '2026-09-01T09:00:00.000Z',
        tags: [
          {
            type: 'LABEL',
            name: tagName,
            value: tagName,
            displayText: '#focus',
            iconName: 'Tag',
            color: '#22c55e',
          },
        ],
      });
      expect(r.status).toBe(201);
      const t = r.body.data!;
      expect(t.description).toBe('Write the L3 suite');
      expect(t.priority).toBe('HIGH');
      expect(new Date(t.scheduledDate!).toISOString()).toBe(
        '2026-09-01T09:00:00.000Z'
      );
      expect(t.tags).toHaveLength(1);
      // Exact relation shape the client destructures (tasks.ts:116-141).
      const rel = t.tags![0];
      expect(rel.value).toBe(tagName);
      expect(rel.displayText).toBe('#focus');
      expect(rel.iconName).toBe('Tag');
      expect(rel.tag).toMatchObject({ name: tagName, type: 'LABEL' });
      expect(rel.tag.id).toEqual(expect.any(String));
    });

    it('400 VALIDATION_ERROR without a title', async () => {
      const r = await createTask({ description: 'no title' });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      expect(r.body.error?.message).toBe('Task title is required');
    });
  });

  describe('GET /api/tasks (list, filters, pagination)', () => {
    it('default list is wrapped as data.data (tasks.ts:184-186 handles the double nest)', async () => {
      const r = await req<TaskList>('GET', '/api/tasks', {
        token: user.accessToken,
      });
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data?.data)).toBe(true);
      // Only this user's rows ever appear.
      for (const t of r.body.data!.data) expect(t.userId).toBe(user.userId);
    });

    it('completed/priority/search filters apply server-side', async () => {
      const u = await registerUser(req);
      await createTask({ title: 'L3 grep needle apple', priority: 'HIGH' }, u);
      const made = await createTask({ title: 'L3 other banana' }, u);
      await req('PATCH', `/api/tasks/${made.body.data!.id}?action=toggle`, {
        token: u.accessToken,
      });

      const done = await req<TaskList>('GET', '/api/tasks?completed=true', {
        token: u.accessToken,
      });
      expect(done.body.data!.data.map((t) => t.title)).toEqual([
        'L3 other banana',
      ]);

      const high = await req<TaskList>('GET', '/api/tasks?priority=HIGH', {
        token: u.accessToken,
      });
      expect(high.body.data!.data.map((t) => t.title)).toEqual([
        'L3 grep needle apple',
      ]);

      const search = await req<TaskList>('GET', '/api/tasks?search=needle', {
        token: u.accessToken,
      });
      expect(search.body.data!.data).toHaveLength(1);
      expect(search.body.data!.data[0].title).toContain('needle');
    });

    it('tags filter matches tag name', async () => {
      const u = await registerUser(req);
      const tagName = `${TAG_PREFIX}filterme`;
      await createTask(
        {
          title: 'Tagged for filter',
          tags: [
            {
              type: 'LABEL',
              name: tagName,
              value: tagName,
              displayText: '#filterme',
              iconName: 'Tag',
            },
          ],
        },
        u
      );
      await createTask({ title: 'Untagged' }, u);
      const r = await req<TaskList>(
        'GET',
        `/api/tasks?tags=${encodeURIComponent(tagName)}`,
        { token: u.accessToken }
      );
      expect(r.body.data!.data.map((t) => t.title)).toEqual([
        'Tagged for filter',
      ]);
    });

    it('pagination (page/limit) returns {data, pagination:{page,limit,total,totalPages}}', async () => {
      const u = await registerUser(req);
      for (let i = 0; i < 3; i++)
        await createTask({ title: `Page task ${i}` }, u);
      const r = await req<
        Envelope<{
          data: Task[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        }>
      >('GET', '/api/tasks?page=1&limit=2', { token: u.accessToken });
      expect(r.status).toBe(200);
      expect(r.body.data!.data).toHaveLength(2);
      expect(r.body.data!.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });
  });

  describe('GET/PUT/PATCH/DELETE /api/tasks/:id', () => {
    it('GET returns the task with taskList and tags relations', async () => {
      const created = await createTask({ title: 'Fetch me' });
      const r = await req<Envelope<Task>>(
        'GET',
        `/api/tasks/${created.body.data!.id}`,
        { token: user.accessToken }
      );
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        id: created.body.data!.id,
        title: 'Fetch me',
      });
      expect(r.body.data!.taskList).toBeDefined();
      expect(r.body.data!.tags).toEqual([]);
    });

    it('PUT updates title/description; PUT with tags REPLACES the tag set — removal round-trips (regression #30)', async () => {
      const tag = (name: string, display: string) => ({
        type: 'LABEL',
        name: `${TAG_PREFIX}${name}`,
        value: `${TAG_PREFIX}${name}`,
        displayText: display,
        iconName: 'Tag',
      });
      const created = await createTask({
        title: 'Tag host',
        tags: [tag('keep', '#keep'), tag('drop', '#drop')],
      });
      const id = created.body.data!.id;
      expect(created.body.data!.tags).toHaveLength(2);

      // Frontend sends the DESIRED remaining tag set on removal
      // (UpdateTaskDTO.tags doc, lib/services/TaskService.ts:111-116).
      const r = await req<Envelope<Task>>('PUT', `/api/tasks/${id}`, {
        token: user.accessToken,
        body: {
          title: 'Tag host renamed',
          description: 'now with words',
          tags: [tag('keep', '#keep')],
        },
      });
      expect(r.status).toBe(200);
      expect(r.body.data!.title).toBe('Tag host renamed');
      expect(r.body.data!.description).toBe('now with words');
      expect(r.body.data!.tags!.map((t) => t.tag.name)).toEqual([
        `${TAG_PREFIX}keep`,
      ]);

      // Empty array clears all tags.
      const cleared = await req<Envelope<Task>>('PUT', `/api/tasks/${id}`, {
        token: user.accessToken,
        body: { tags: [] },
      });
      expect(cleared.body.data!.tags).toEqual([]);
    });

    it('PATCH ?action=toggle flips completed and sets status/completedAt (client calls this at tasks.ts:409)', async () => {
      const created = await createTask({ title: 'Toggle me' });
      const id = created.body.data!.id;
      const on = await req<Envelope<Task>>(
        'PATCH',
        `/api/tasks/${id}?action=toggle`,
        { token: user.accessToken }
      );
      expect(on.status).toBe(200);
      expect(on.body.data).toMatchObject({ completed: true, status: 'DONE' });
      expect(on.body.data!.completedAt).not.toBeNull();

      const off = await req<Envelope<Task>>(
        'PATCH',
        `/api/tasks/${id}?action=toggle`,
        { token: user.accessToken }
      );
      expect(off.body.data).toMatchObject({
        completed: false,
        status: 'NOT_STARTED',
        completedAt: null,
      });
    });

    it('PATCH with status=DONE implies completed=true (handler normalization, api/_handlers/tasks/[id].ts:169-171)', async () => {
      const created = await createTask({ title: 'Status task' });
      const r = await req<Envelope<Task>>(
        'PATCH',
        `/api/tasks/${created.body.data!.id}`,
        { token: user.accessToken, body: { status: 'DONE' } }
      );
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ status: 'DONE', completed: true });
    });

    it('DELETE returns {deleted:true} and the row is gone', async () => {
      const created = await createTask({ title: 'Delete me' });
      const id = created.body.data!.id;
      const r = await req<Envelope<{ deleted: boolean }>>(
        'DELETE',
        `/api/tasks/${id}`,
        { token: user.accessToken }
      );
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ deleted: true });
      const gone = await req<Envelope>('GET', `/api/tasks/${id}`, {
        token: user.accessToken,
      });
      expect(gone.status).toBe(404);
      expect(gone.body.error?.code).toBe('NOT_FOUND');
    });

    it('404 NOT_FOUND "Task not found" for an unknown id', async () => {
      const r = await req<Envelope>('GET', '/api/tasks/does-not-exist', {
        token: user.accessToken,
      });
      expect(r.status).toBe(404);
      expect(r.body.error?.message).toBe('Task not found');
    });
  });

  describe("cross-user access (another user's task)", () => {
    it("GET leaks the other user's task (200) — pinned IDOR, issue #67; PUT/PATCH correctly 403", async () => {
      const intruder = await registerUser(req);
      const created = await createTask({ title: 'Victim task' });
      const id = created.body.data!.id;

      // CURRENT behavior: unscoped findById (lib/services/BaseService.ts:248,
      // TaskService.ts:843) returns the row to ANY authenticated user. Issue
      // #67; flip to 404 when the fix lands.
      const read = await req<Envelope<Task>>('GET', `/api/tasks/${id}`, {
        token: intruder.accessToken,
      });
      expect(read.status).toBe(200);
      expect(read.body.data!.userId).toBe(user.userId);

      const put = await req<Envelope>('PUT', `/api/tasks/${id}`, {
        token: intruder.accessToken,
        body: { title: 'hacked' },
      });
      expect(put.status).toBe(403);
      expect(put.body.error?.code).toBe('FORBIDDEN');

      const patch = await req<Envelope>(
        'PATCH',
        `/api/tasks/${id}?action=toggle`,
        { token: intruder.accessToken }
      );
      expect(patch.status).toBe(403);
    });

    it("DELETE destroys the other user's task (200) — pinned IDOR, issue #67", async () => {
      const intruder = await registerUser(req);
      const created = await createTask({ title: 'Deletable victim' });
      const id = created.body.data!.id;

      // CURRENT behavior: TaskService.delete never checks ownership
      // (api/_handlers/tasks/[id].ts:230-233). Issue #67; flip to 404 when
      // fixed.
      const del = await req<Envelope<{ deleted: boolean }>>(
        'DELETE',
        `/api/tasks/${id}`,
        { token: intruder.accessToken }
      );
      expect(del.status).toBe(200);
      expect(del.body.data).toEqual({ deleted: true });

      const gone = await req<Envelope>('GET', `/api/tasks/${id}`, {
        token: user.accessToken,
      });
      expect(gone.status).toBe(404);
    });
  });

  describe('stats/bulk (pins issue #64: never authenticated)', () => {
    it('GET /api/tasks/stats -> 401 even with a valid token', async () => {
      // createMethodHandler has no auth middleware (issue #64), so the
      // manual req.user check always fails. The frontend would consume
      // data.{total,completed,pending,overdue,...} (TaskStats) if this worked.
      const r = await req<Envelope>('GET', '/api/tasks/stats', {
        token: user.accessToken,
      });
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('UNAUTHORIZED');
      expect(r.body.error?.message).toBe('User authentication required');
    });

    it('PATCH /api/tasks/bulk -> 401 even with a valid token (and POST is 405: only PATCH/DELETE are routed)', async () => {
      const patch = await req<Envelope>('PATCH', '/api/tasks/bulk', {
        token: user.accessToken,
        body: { action: 'complete', taskIds: ['x'] },
      });
      expect(patch.status).toBe(401);
      expect(patch.body.error?.code).toBe('UNAUTHORIZED');

      const post = await req<Envelope>('POST', '/api/tasks/bulk', {
        token: user.accessToken,
        body: {},
      });
      expect(post.status).toBe(405);
      expect(post.body.error?.code).toBe('METHOD_NOT_ALLOWED');
    });
  });
});
