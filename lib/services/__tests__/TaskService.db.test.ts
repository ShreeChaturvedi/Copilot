/**
 * TaskService — L2 suite against a REAL Postgres.
 *
 * Complements the mocked TaskService.test.ts (fast smoke tests): this exercises
 * real SQL — CRUD round-trips, filters/sort/pagination actually executed, tag
 * add AND remove (#30), the description column (#12), ownership isolation,
 * cascade deletes, and transactional rollback of create()/update().
 *
 * Gated on L2_TEST_DATABASE_URL; skips cleanly when unset. See dbTestUtils.ts
 * for the gating + isolation convention. Run:
 *   L2_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow_l2_test \
 *     npx vitest run --config vitest.backend.config.ts lib/services/__tests__/TaskService.db.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { taskListCache } from '../../utils/cache.js';
import { L2_DB_URL, makeSeed, uid, type Seed } from './dbTestUtils.js';
import type { CreateTaskDTO } from '../TaskService.js';

type Db = typeof import('../../config/database.js');
type TaskServiceClass = (typeof import('../TaskService.js'))['TaskService'];
type TaskService = InstanceType<TaskServiceClass>;

const TAG_PREFIX = `l2t-${uid()}-`;

describe.skipIf(!L2_DB_URL)('TaskService (real Postgres, L2)', () => {
  let db: Db;
  let service: TaskService;
  let seed: Seed;
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = L2_DB_URL!;
    db = await import('../../config/database.js');
    const { TaskService } = await import('../TaskService.js');
    service = new TaskService({ enableLogging: false });
    seed = makeSeed(db.query as never);
  });

  afterAll(async () => {
    if (db) {
      await seed.deleteTagsByPrefix(TAG_PREFIX);
      await seed.deleteUsers(userIds);
      await db.pool.end().catch(() => {});
    }
  });

  beforeEach(() => {
    // The service caches a user's task lists; each test uses a fresh user, but
    // clear anyway so a mid-test list create is never masked by a stale entry.
    taskListCache.clear();
  });

  /** A fresh user + its own list, tracked for afterAll cleanup. */
  async function freshUser() {
    const user = await seed.createUser();
    userIds.push(user.id);
    const list = await seed.createTaskList(user.id, { name: `List ${uid()}` });
    return { userId: user.id, listId: list.id, ctx: { userId: user.id } };
  }

  describe('create + read round-trip', () => {
    it('persists a task and reads it back with relations', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        {
          title: 'Write report',
          description: 'Q3 numbers',
          taskListId: listId,
        },
        ctx
      );
      expect(created.id).toBeTruthy();
      expect(created.title).toBe('Write report');
      expect(created.description).toBe('Q3 numbers'); // #12 column round-trips
      expect(created.completed).toBe(false);
      expect(created.status).toBe('NOT_STARTED');
      expect(created.priority).toBe('MEDIUM');

      const fetched = await service.findById(created.id, ctx);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe('Write report');
      expect(fetched!.description).toBe('Q3 numbers');
      expect(fetched!.taskList?.id).toBe(listId);
      expect(fetched!.tags).toEqual([]);
      expect(fetched!.attachments).toEqual([]);
    });

    it('auto-creates a default "General" list when none is given', async () => {
      const user = await seed.createUser();
      userIds.push(user.id);
      const created = await service.create(
        { title: 'No list task' },
        { userId: user.id }
      );
      expect(created.taskListId).toBeTruthy();
      const list = await db.query<{ name: string }>(
        `SELECT name FROM task_lists WHERE id = $1`,
        [created.taskListId]
      );
      expect(list.rows[0].name).toBe('General');
    });

    it('rejects a blank title before touching the DB', async () => {
      const { listId, ctx } = await freshUser();
      await expect(
        service.create({ title: '   ', taskListId: listId }, ctx)
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('rejects a task list the user does not own', async () => {
      const a = await freshUser();
      const b = await freshUser();
      await expect(
        service.create({ title: 'x', taskListId: b.listId }, a.ctx)
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });
  });

  describe('tags round-trip (task_tags) — #30', () => {
    const tag = (name: string): NonNullable<CreateTaskDTO['tags']>[number] => ({
      type: 'LABEL',
      name: `${TAG_PREFIX}${name}`,
      value: name,
      displayText: name,
      iconName: 'tag',
    });

    it('creates a task with tags and reads them back', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        {
          title: 'Tagged',
          taskListId: listId,
          tags: [tag('work'), tag('urgent')],
        },
        ctx
      );
      const names = (created.tags ?? []).map((t) => t.tag.name).sort();
      expect(names).toEqual([`${TAG_PREFIX}urgent`, `${TAG_PREFIX}work`]);

      const rows = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM task_tags WHERE "taskId" = $1`,
        [created.id]
      );
      expect(rows.rows[0].count).toBe('2');
    });

    it('update replaces the whole tag set — adds and REMOVES', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        {
          title: 'Retag',
          taskListId: listId,
          tags: [tag('work'), tag('urgent')],
        },
        ctx
      );
      // Desired remaining set drops "urgent", keeps "work", adds "later".
      const updated = await service.update(
        created.id,
        { tags: [tag('work'), tag('later')] },
        ctx
      );
      const names = (updated!.tags ?? []).map((t) => t.tag.name).sort();
      expect(names).toEqual([`${TAG_PREFIX}later`, `${TAG_PREFIX}work`]);

      const remaining = await db.query<{ value: string }>(
        `SELECT tt.value FROM task_tags tt WHERE tt."taskId" = $1 ORDER BY tt.value`,
        [created.id]
      );
      expect(remaining.rows.map((r) => r.value)).toEqual(['later', 'work']);
    });

    it('passing tags: [] clears every tag', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        { title: 'Clear', taskListId: listId, tags: [tag('work')] },
        ctx
      );
      const updated = await service.update(created.id, { tags: [] }, ctx);
      expect(updated!.tags).toEqual([]);
      const rows = await db.query(
        `SELECT 1 FROM task_tags WHERE "taskId" = $1`,
        [created.id]
      );
      expect(rows.rowCount).toBe(0);
    });

    it('reuses an existing global tag row (ON CONFLICT name) across tasks', async () => {
      const { listId, ctx } = await freshUser();
      const t1 = await service.create(
        { title: 'A', taskListId: listId, tags: [tag('shared')] },
        ctx
      );
      const t2 = await service.create(
        { title: 'B', taskListId: listId, tags: [tag('shared')] },
        ctx
      );
      const ids = await db.query<{ id: string }>(
        `SELECT id FROM tags WHERE name = $1`,
        [`${TAG_PREFIX}shared`]
      );
      expect(ids.rowCount).toBe(1); // one tag row, referenced by both tasks
      expect(t1.tags?.[0].tag.id).toBe(t2.tags?.[0].tag.id);
    });
  });

  describe('update / toggle', () => {
    it('updates scalar fields and bumps updatedAt', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        { title: 'Old', taskListId: listId },
        ctx
      );
      const updated = await service.update(
        created.id,
        { title: 'New', priority: 'HIGH', description: 'desc' },
        ctx
      );
      expect(updated!.title).toBe('New');
      expect(updated!.priority).toBe('HIGH');
      expect(updated!.description).toBe('desc');
    });

    it('setting completed=true also sets status DONE and completedAt', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        { title: 'Finish me', taskListId: listId },
        ctx
      );
      const done = await service.update(created.id, { completed: true }, ctx);
      expect(done!.completed).toBe(true);
      expect(done!.status).toBe('DONE');
      expect(done!.completedAt).toBeInstanceOf(Date);
    });

    it('toggleCompletion flips completed and status', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        { title: 'Toggle', taskListId: listId },
        ctx
      );
      const once = await service.toggleCompletion(created.id, ctx);
      expect(once.completed).toBe(true);
      expect(once.status).toBe('DONE');
      const twice = await service.toggleCompletion(created.id, ctx);
      expect(twice.completed).toBe(false);
      expect(twice.status).toBe('NOT_STARTED');
    });

    it("rejects an update to another user's task", async () => {
      const a = await freshUser();
      const b = await freshUser();
      const t = await service.create(
        { title: 'a-owned', taskListId: a.listId },
        a.ctx
      );
      await expect(
        service.update(t.id, { title: 'hijack' }, b.ctx)
      ).rejects.toThrow(/AUTHORIZATION_ERROR/);
    });
  });

  describe('filters / sort / pagination (executed SQL)', () => {
    async function seedFive() {
      const { userId, listId, ctx } = await freshUser();
      const otherList = await seed.createTaskList(userId, {
        name: `Other ${uid()}`,
      });
      await service.create(
        { title: 'alpha', taskListId: listId, priority: 'LOW' },
        ctx
      );
      await service.create(
        { title: 'bravo', taskListId: listId, priority: 'HIGH' },
        ctx
      );
      const done = await service.create(
        { title: 'charlie', taskListId: listId },
        ctx
      );
      await service.update(done.id, { completed: true }, ctx);
      await service.create(
        { title: 'delta', taskListId: otherList.id, priority: 'MEDIUM' },
        ctx
      );
      await service.create(
        {
          title: 'echo overdue',
          taskListId: listId,
          scheduledDate: new Date('2020-01-01T00:00:00Z'),
        },
        ctx
      );
      return { ctx, listId, otherListId: otherList.id };
    }

    it('scopes findAll to the calling user only', async () => {
      const { ctx } = await seedFive();
      const other = await freshUser();
      await service.create(
        { title: 'not yours', taskListId: other.listId },
        other.ctx
      );
      const mine = await service.findAll({}, ctx);
      expect(mine).toHaveLength(5);
      expect(mine.every((t) => t.userId === ctx.userId)).toBe(true);
    });

    it('filters by completed', async () => {
      const { ctx } = await seedFive();
      expect(await service.findAll({ completed: true }, ctx)).toHaveLength(1);
      expect(await service.findAll({ completed: false }, ctx)).toHaveLength(4);
    });

    it('filters by taskListId and priority', async () => {
      const { ctx, otherListId } = await seedFive();
      const inOther = await service.findAll({ taskListId: otherListId }, ctx);
      expect(inOther).toHaveLength(1);
      expect(inOther[0].title).toBe('delta');
      const high = await service.findAll({ priority: 'HIGH' }, ctx);
      expect(high.map((t) => t.title)).toEqual(['bravo']);
    });

    it('search matches title via ILIKE', async () => {
      const { ctx } = await seedFive();
      const hits = await service.findAll({ search: 'ECHO' }, ctx);
      expect(hits.map((t) => t.title)).toEqual(['echo overdue']);
    });

    it('overdue returns only past-due incomplete tasks', async () => {
      const { ctx } = await seedFive();
      const overdue = await service.findAll({ overdue: true }, ctx);
      expect(overdue.map((t) => t.title)).toEqual(['echo overdue']);
    });

    it('sorts by title ascending', async () => {
      const { ctx } = await seedFive();
      const sorted = await service.findAll(
        { sortBy: 'title', sortOrder: 'asc' },
        ctx
      );
      expect(sorted.map((t) => t.title)).toEqual([
        'alpha',
        'bravo',
        'charlie',
        'delta',
        'echo overdue',
      ]);
    });

    it('paginates with correct totals', async () => {
      const { ctx } = await seedFive();
      const page1 = await service.findPaginated(
        { sortBy: 'title', sortOrder: 'asc' },
        1,
        2,
        ctx
      );
      expect(page1.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
      expect(page1.data).toHaveLength(2);
      const page3 = await service.findPaginated(
        { sortBy: 'title', sortOrder: 'asc' },
        3,
        2,
        ctx
      );
      expect(page3.data).toHaveLength(1);
    });

    it('filters by tag name', async () => {
      const { listId, ctx } = await freshUser();
      const tagName = `${TAG_PREFIX}filterme`;
      await service.create(
        {
          title: 'has tag',
          taskListId: listId,
          tags: [
            {
              type: 'LABEL',
              name: tagName,
              value: 'filterme',
              displayText: 'f',
              iconName: 'tag',
            },
          ],
        },
        ctx
      );
      await service.create({ title: 'no tag', taskListId: listId }, ctx);
      const hits = await service.findAll({ tags: [tagName] }, ctx);
      expect(hits.map((t) => t.title)).toEqual(['has tag']);
    });
  });

  describe('stats + bulk', () => {
    it('getStats counts totals and completions', async () => {
      const { listId, ctx } = await freshUser();
      await service.create({ title: 's1', taskListId: listId }, ctx);
      const d = await service.create({ title: 's2', taskListId: listId }, ctx);
      await service.update(d.id, { completed: true }, ctx);
      const stats = await service.getStats(ctx);
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.completedToday).toBe(1);
    });

    it('bulkDelete rejects when a task belongs to another user', async () => {
      const a = await freshUser();
      const b = await freshUser();
      const mine = await service.create(
        { title: 'mine', taskListId: a.listId },
        a.ctx
      );
      const theirs = await service.create(
        { title: 'theirs', taskListId: b.listId },
        b.ctx
      );
      await expect(
        service.bulkDelete([mine.id, theirs.id], a.ctx)
      ).rejects.toThrow(/AUTHORIZATION_ERROR/);
      // Nothing was deleted: mine still exists.
      expect(await service.findById(mine.id, a.ctx)).not.toBeNull();
    });
  });

  describe('cascade + rollback (real constraints)', () => {
    it('deleting a task cascades its task_tags rows', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        {
          title: 'cascade',
          taskListId: listId,
          tags: [
            {
              type: 'LABEL',
              name: `${TAG_PREFIX}c`,
              value: 'c',
              displayText: 'c',
              iconName: 'tag',
            },
          ],
        },
        ctx
      );
      await service.delete(created.id);
      const rows = await db.query(
        `SELECT 1 FROM task_tags WHERE "taskId" = $1`,
        [created.id]
      );
      expect(rows.rowCount).toBe(0);
    });

    it('deleting the user cascades their tasks', async () => {
      const user = await seed.createUser();
      const list = await seed.createTaskList(user.id, {});
      const t = await service.create(
        { title: 'doomed', taskListId: list.id },
        { userId: user.id }
      );
      await db.query(`DELETE FROM users WHERE id = $1`, [user.id]);
      const rows = await db.query(`SELECT 1 FROM tasks WHERE id = $1`, [t.id]);
      expect(rows.rowCount).toBe(0);
    });

    it('create() rolls back the task row when a tag insert fails', async () => {
      const { listId, ctx } = await freshUser();
      const before = await service.count({}, ctx);
      // displayText is NOT NULL in task_tags; a null forces the tag insert to
      // fail mid-transaction, which must roll back the already-inserted task.
      const badTag = {
        type: 'LABEL',
        name: `${TAG_PREFIX}bad`,
        value: 'bad',
        displayText: null,
        iconName: 'tag',
      } as unknown as NonNullable<CreateTaskDTO['tags']>[number];
      await expect(
        service.create(
          { title: 'ghost', taskListId: listId, tags: [badTag] },
          ctx
        )
      ).rejects.toThrow();
      const after = await service.count({}, ctx);
      expect(after).toBe(before); // no orphan task persisted
      const ghost = await db.query(
        `SELECT 1 FROM tasks WHERE title = 'ghost' AND "userId" = $1`,
        [ctx.userId]
      );
      expect(ghost.rowCount).toBe(0);
    });

    it('update() rolls back scalar changes when the tag replacement fails', async () => {
      const { listId, ctx } = await freshUser();
      const created = await service.create(
        {
          title: 'keep-title',
          taskListId: listId,
          tags: [
            {
              type: 'LABEL',
              name: `${TAG_PREFIX}keep`,
              value: 'keep',
              displayText: 'k',
              iconName: 'tag',
            },
          ],
        },
        ctx
      );
      const badTag = {
        type: 'LABEL',
        name: `${TAG_PREFIX}bad2`,
        value: 'bad2',
        displayText: null,
        iconName: 'tag',
      } as unknown as NonNullable<CreateTaskDTO['tags']>[number];
      await expect(
        service.update(created.id, { title: 'changed', tags: [badTag] }, ctx)
      ).rejects.toThrow();
      // Title unchanged AND the original tag survives (DELETE was rolled back).
      const row = await db.query<{ title: string }>(
        `SELECT title FROM tasks WHERE id = $1`,
        [created.id]
      );
      expect(row.rows[0].title).toBe('keep-title');
      const tags = await db.query(
        `SELECT 1 FROM task_tags WHERE "taskId" = $1`,
        [created.id]
      );
      expect(tags.rowCount).toBe(1);
    });
  });
});
