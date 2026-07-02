/**
 * TaskListService — L2 suite against a REAL Postgres.
 *
 * Complements the mocked TaskListService.test.ts. Covers CRUD, the
 * UNIQUE(userId, name) constraint, per-user duplicate-name validation,
 * archive/unarchive/getArchived (#11), delete-moves-tasks-to-default + the
 * cannot-delete-only-list rule, task-count aggregation, ownership isolation,
 * and cascade deletes.
 *
 * Gated on L2_TEST_DATABASE_URL; skips when unset. See dbTestUtils.ts.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { taskListCache } from '../../utils/cache.js';
import { L2_DB_URL, makeSeed, uid, type Seed } from './dbTestUtils.js';

type Db = typeof import('../../config/database.js');
type TaskListServiceClass =
  (typeof import('../TaskListService.js'))['TaskListService'];
type TaskListService = InstanceType<TaskListServiceClass>;

describe.skipIf(!L2_DB_URL)('TaskListService (real Postgres, L2)', () => {
  let db: Db;
  let service: TaskListService;
  let seed: Seed;
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = L2_DB_URL!;
    db = await import('../../config/database.js');
    const { TaskListService } = await import('../TaskListService.js');
    service = new TaskListService({ enableLogging: false });
    seed = makeSeed(db.query as never);
  });

  afterAll(async () => {
    if (db) {
      await seed.deleteUsers(userIds);
      await db.pool.end().catch(() => {});
    }
  });

  beforeEach(() => {
    taskListCache.clear();
  });

  async function freshUser() {
    const user = await seed.createUser();
    userIds.push(user.id);
    return { userId: user.id, ctx: { userId: user.id } };
  }

  /** Insert a task directly under a list (bypasses TaskService). */
  async function addTask(
    userId: string,
    listId: string,
    over: { title?: string; completed?: boolean } = {}
  ) {
    const res = await db.query<{ id: string }>(
      `INSERT INTO tasks (id, title, completed, status, priority, "taskListId", "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'MEDIUM', $4, $5, NOW(), NOW())
       RETURNING id`,
      [
        over.title ?? `Task ${uid()}`,
        over.completed ?? false,
        over.completed ? 'DONE' : 'NOT_STARTED',
        listId,
        userId,
      ]
    );
    return res.rows[0].id;
  }

  describe('create + validation + constraints', () => {
    it('creates a list and reads it back', async () => {
      const { ctx } = await freshUser();
      const created = await service.create(
        { name: `Work ${uid()}`, color: '#123456' },
        ctx
      );
      expect(created.id).toBeTruthy();
      expect(created.color).toBe('#123456');
      expect(created.isArchived).toBe(false);
      const found = await service.findById(created.id, ctx);
      expect(found!.name).toBe(created.name);
    });

    it('rejects a blank name and a bad color', async () => {
      const { ctx } = await freshUser();
      await expect(
        service.create({ name: '  ', color: '#fff' }, ctx)
      ).rejects.toThrow(/VALIDATION_ERROR/);
      await expect(
        service.create({ name: 'Nope', color: 'red' }, ctx)
      ).rejects.toThrow(/Invalid color/);
    });

    it('rejects a duplicate name for the same user (service validation)', async () => {
      const { ctx } = await freshUser();
      const name = `Dupe ${uid()}`;
      await service.create({ name, color: '#8B5CF6' }, ctx);
      await expect(
        service.create({ name, color: '#8B5CF6' }, ctx)
      ).rejects.toThrow(/already exists/);
    });

    it('enforces UNIQUE(userId, name) at the DB level', async () => {
      const { userId } = await freshUser();
      const name = `Raw ${uid()}`;
      await seed.createTaskList(userId, { name });
      await expect(seed.createTaskList(userId, { name })).rejects.toThrow();
    });

    it('allows the same list name for different users', async () => {
      const a = await freshUser();
      const b = await freshUser();
      const name = `Shared ${uid()}`;
      const la = await service.create({ name, color: '#8B5CF6' }, a.ctx);
      const lb = await service.create({ name, color: '#8B5CF6' }, b.ctx);
      expect(la.name).toBe(lb.name);
      expect(la.userId).not.toBe(lb.userId);
    });
  });

  describe('update', () => {
    it('renames a list', async () => {
      const { ctx } = await freshUser();
      const l = await service.create(
        { name: `Before ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const after = `After ${uid()}`;
      const updated = await service.update(l.id, { name: after }, ctx);
      expect(updated!.name).toBe(after);
    });

    it('rejects renaming onto an existing name', async () => {
      const { ctx } = await freshUser();
      const taken = `Taken ${uid()}`;
      await service.create({ name: taken, color: '#8B5CF6' }, ctx);
      const other = await service.create(
        { name: `Other ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      await expect(
        service.update(other.id, { name: taken }, ctx)
      ).rejects.toThrow(/already exists/);
    });

    it("rejects updating another user's list", async () => {
      const a = await freshUser();
      const b = await freshUser();
      const l = await service.create(
        { name: `A ${uid()}`, color: '#8B5CF6' },
        a.ctx
      );
      await expect(service.update(l.id, { name: 'x' }, b.ctx)).rejects.toThrow(
        /AUTHORIZATION_ERROR/
      );
    });
  });

  describe('findAll filters', () => {
    it('scopes to the user and excludes archived by default', async () => {
      const { userId, ctx } = await freshUser();
      const keep = await service.create(
        { name: `Keep ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const arch = await service.create(
        { name: `Arch ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      await service.archive(arch.id, ctx);
      const other = await freshUser();
      await service.create(
        { name: `Nope ${uid()}`, color: '#8B5CF6' },
        other.ctx
      );

      const visible = await service.findAll({}, ctx);
      expect(visible.map((l) => l.id)).toEqual([keep.id]);
      expect(visible.every((l) => l.userId === userId)).toBe(true);

      const withArchived = await service.findAll(
        { includeArchived: true },
        ctx
      );
      expect(withArchived.map((l) => l.id).sort()).toEqual(
        [keep.id, arch.id].sort()
      );
    });

    it('search filter matches name', async () => {
      const { ctx } = await freshUser();
      const token = uid();
      await service.create(
        { name: `Findable-${token}`, color: '#8B5CF6' },
        ctx
      );
      await service.create(
        { name: `Unrelated ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const hits = await service.findAll({ search: token }, ctx);
      expect(hits).toHaveLength(1);
    });

    it('hasActiveTasks filter returns only lists with incomplete tasks', async () => {
      const { userId, ctx } = await freshUser();
      const active = await service.create(
        { name: `Active ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const doneOnly = await service.create(
        { name: `Done ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      await addTask(userId, active.id, { completed: false });
      await addTask(userId, doneOnly.id, { completed: true });
      const hits = await service.findAll({ hasActiveTasks: true }, ctx);
      expect(hits.map((l) => l.id)).toEqual([active.id]);
    });
  });

  describe('archive / unarchive (#11)', () => {
    it('archive stamps archivedAt; getArchived lists it; unarchive restores', async () => {
      const { ctx } = await freshUser();
      const l = await service.create(
        { name: `Arch ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const archived = await service.archive(l.id, ctx);
      expect(archived!.isArchived).toBe(true);
      expect(archived!.archivedAt).toBeInstanceOf(Date);

      const list = await service.getArchived(ctx);
      expect(list.map((x) => x.id)).toContain(l.id);

      const restored = await service.unarchive(l.id, ctx);
      expect(restored!.isArchived).toBe(false);
      expect(restored!.archivedAt).toBeNull();
      expect(await service.getArchived(ctx)).toHaveLength(0);
    });

    it("rejects archiving another user's list", async () => {
      const a = await freshUser();
      const b = await freshUser();
      const l = await service.create(
        { name: `A ${uid()}`, color: '#8B5CF6' },
        a.ctx
      );
      await expect(service.archive(l.id, b.ctx)).rejects.toThrow(
        /AUTHORIZATION_ERROR/
      );
    });
  });

  describe('delete semantics', () => {
    it('refuses to delete the only list', async () => {
      const { ctx } = await freshUser();
      const only = await service.create(
        { name: `Only ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      await expect(service.delete(only.id, ctx)).rejects.toThrow(
        /only task list/
      );
    });

    it('moves tasks to the default list before deleting', async () => {
      const { userId, ctx } = await freshUser();
      const general = await service.create(
        { name: 'General', color: '#8B5CF6' },
        ctx
      );
      const doomed = await service.create(
        { name: `Doomed ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      const taskId = await addTask(userId, doomed.id);
      await service.delete(doomed.id, ctx);
      const moved = await db.query<{ taskListId: string }>(
        `SELECT "taskListId" FROM tasks WHERE id = $1`,
        [taskId]
      );
      expect(moved.rows[0].taskListId).toBe(general.id);
      expect(await service.findById(doomed.id, ctx)).toBeNull();
    });
  });

  describe('aggregates + defaults', () => {
    it('getWithTaskCount reports task and completed counts', async () => {
      const { userId, ctx } = await freshUser();
      const l = await service.create(
        { name: `Counts ${uid()}`, color: '#8B5CF6' },
        ctx
      );
      await addTask(userId, l.id, { completed: true });
      await addTask(userId, l.id, { completed: false });
      const rows = await service.getWithTaskCount(ctx);
      const row = rows.find((r) => r.id === l.id)!;
      expect(row.taskCount).toBe(2);
      expect(row.completedTaskCount).toBe(1);
      expect(row.pendingTaskCount).toBe(1);
    });

    it('getDefault returns the General list when present', async () => {
      const { ctx } = await freshUser();
      const general = await service.create(
        { name: 'General', color: '#8B5CF6' },
        ctx
      );
      const def = await service.getDefault(ctx);
      expect(def.id).toBe(general.id);
    });

    it('getDefault creates a General list when the user has none', async () => {
      const { ctx } = await freshUser();
      const def = await service.getDefault(ctx);
      expect(def.name).toBe('General');
      const rows = await db.query(
        `SELECT 1 FROM task_lists WHERE "userId" = $1 AND name = 'General'`,
        [ctx.userId]
      );
      expect(rows.rowCount).toBe(1);
    });

    it('setDefault flags one list, unsets the previous default, and getDefault honors it', async () => {
      const { userId, ctx } = await freshUser();
      const a = await service.create(
        { name: `A ${uid()}`, color: '#111111' },
        ctx
      );
      const b = await service.create(
        { name: `B ${uid()}`, color: '#222222' },
        ctx
      );

      // Set A as the default.
      const firstDefault = await service.setDefault(a.id, ctx);
      expect(firstDefault?.id).toBe(a.id);
      expect(firstDefault?.isDefault).toBe(true);
      expect((await service.getDefault(ctx)).id).toBe(a.id);

      // Switching to B must unset A (at most one default per owner).
      const secondDefault = await service.setDefault(b.id, ctx);
      expect(secondDefault?.isDefault).toBe(true);
      expect((await service.getDefault(ctx)).id).toBe(b.id);

      const flagged = await db.query<{ id: string }>(
        `SELECT id FROM task_lists WHERE "userId" = $1 AND "isDefault" = true`,
        [userId]
      );
      expect(flagged.rows.map((r) => r.id)).toEqual([b.id]);
    });

    it("setDefault rejects a list the caller doesn't own", async () => {
      const owner = await freshUser();
      const other = await freshUser();
      const list = await service.create(
        { name: `Owned ${uid()}`, color: '#333333' },
        owner.ctx
      );
      await expect(service.setDefault(list.id, other.ctx)).rejects.toThrow(
        /AUTHORIZATION_ERROR/
      );
    });
  });

  describe('cascade deletes', () => {
    it('deleting a list cascades its tasks (raw FK)', async () => {
      const { userId } = await freshUser();
      const list = await seed.createTaskList(userId, { name: `Casc ${uid()}` });
      const taskId = await addTask(userId, list.id);
      await db.query(`DELETE FROM task_lists WHERE id = $1`, [list.id]);
      const rows = await db.query(`SELECT 1 FROM tasks WHERE id = $1`, [
        taskId,
      ]);
      expect(rows.rowCount).toBe(0);
    });

    it('deleting the user cascades their task lists', async () => {
      const { userId } = await freshUser();
      const list = await seed.createTaskList(userId, {
        name: `Casc2 ${uid()}`,
      });
      await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
      const rows = await db.query(`SELECT 1 FROM task_lists WHERE id = $1`, [
        list.id,
      ]);
      expect(rows.rowCount).toBe(0);
    });
  });
});
