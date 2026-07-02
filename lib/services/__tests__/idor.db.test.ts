/**
 * IDOR owner-scoping — L2 suite against a REAL Postgres (#62).
 *
 * Regression for the verified cross-user authorization hole: any authenticated
 * user could read or delete another user's task/event (and, as audited here,
 * calendar/task_list/attachment) by knowing its id, because the single-resource
 * findById/delete paths ignored context.userId.
 *
 * Seeds user A with a private task, event, calendar, task list and attachment,
 * then acts as user B and asserts a 404 shape (null / false / thrown
 * AUTHORIZATION_ERROR) — never the row. User A still reads/deletes their own.
 *
 * Gated on L2_TEST_DATABASE_URL; skips cleanly when unset. See dbTestUtils.ts.
 * Run:
 *   L2_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow_idor_test \
 *     npx vitest run --config vitest.backend.config.ts lib/services/__tests__/idor.db.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { L2_DB_URL, makeSeed, uid, type Seed } from './dbTestUtils.js';

type Db = typeof import('../../config/database.js');
type Ctx = { userId: string };

describe.skipIf(!L2_DB_URL)(
  'IDOR owner-scoping (real Postgres, L2) — #62',
  () => {
    let db: Db;
    let seed: Seed;
    let services: {
      task: InstanceType<(typeof import('../TaskService.js'))['TaskService']>;
      event: InstanceType<
        (typeof import('../EventService.js'))['EventService']
      >;
      calendar: InstanceType<
        (typeof import('../CalendarService.js'))['CalendarService']
      >;
      taskList: InstanceType<
        (typeof import('../TaskListService.js'))['TaskListService']
      >;
      attachment: InstanceType<
        (typeof import('../AttachmentService.js'))['AttachmentService']
      >;
    };

    const userIds: string[] = [];
    let A: Ctx;
    let B: Ctx;
    let taskId: string;
    let eventId: string;
    let calId: string;
    let listId: string;
    let attachmentId: string;

    beforeAll(async () => {
      process.env.DATABASE_URL = L2_DB_URL!;
      db = await import('../../config/database.js');
      const { TaskService } = await import('../TaskService.js');
      const { EventService } = await import('../EventService.js');
      const { CalendarService } = await import('../CalendarService.js');
      const { TaskListService } = await import('../TaskListService.js');
      const { AttachmentService } = await import('../AttachmentService.js');
      services = {
        task: new TaskService({ enableLogging: false }),
        event: new EventService({ enableLogging: false }),
        calendar: new CalendarService({ enableLogging: false }),
        taskList: new TaskListService({ enableLogging: false }),
        attachment: new AttachmentService({ enableLogging: false }),
      };
      seed = makeSeed(db.query as never);

      const a = await seed.createUser();
      const b = await seed.createUser();
      userIds.push(a.id, b.id);
      A = { userId: a.id };
      B = { userId: b.id };

      // A's private task (in A's own list)
      const list = await seed.createTaskList(a.id, { name: `A list ${uid()}` });
      listId = list.id;
      const task = await services.task.create(
        { title: 'A private task', taskListId: list.id },
        A
      );
      taskId = task.id;

      // A's private event (in A's own calendar)
      const cal = await seed.createCalendar(a.id, { name: `A cal ${uid()}` });
      calId = cal.id;
      const event = await services.event.create(
        {
          title: 'A private event',
          start: new Date('2026-08-01T10:00:00.000Z'),
          end: new Date('2026-08-01T11:00:00.000Z'),
          calendarId: cal.id,
        },
        A
      );
      eventId = event.id;

      // A's attachment on A's task (seeded via raw SQL; owned through the task)
      const att = await db.query<{ id: string }>(
        `INSERT INTO attachments (id, "fileName", "fileUrl", "fileType", "fileSize", "taskId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW()) RETURNING id`,
        ['a.pdf', 'https://example.com/a.pdf', 'application/pdf', 123, task.id]
      );
      attachmentId = att.rows[0].id;
    });

    afterAll(async () => {
      if (db) {
        await seed.deleteUsers(userIds); // cascades everything the suite created
        await db.pool.end().catch(() => {});
      }
    });

    describe('cross-user access is denied (B gets a 404 shape, never the row)', () => {
      it('task: A reads it; B gets null', async () => {
        expect((await services.task.findById(taskId, A))?.id).toBe(taskId);
        expect(await services.task.findById(taskId, B)).toBeNull();
      });

      it('event: A reads it; B gets null', async () => {
        expect((await services.event.findById(eventId, A))?.id).toBe(eventId);
        expect(await services.event.findById(eventId, B)).toBeNull();
      });

      it('calendar: A reads it; B gets null', async () => {
        expect((await services.calendar.findById(calId, A))?.id).toBe(calId);
        expect(await services.calendar.findById(calId, B)).toBeNull();
      });

      it('task list: A reads it; B gets null', async () => {
        expect((await services.taskList.findById(listId, A))?.id).toBe(listId);
        expect(await services.taskList.findById(listId, B)).toBeNull();
      });

      it('attachment: A reads it; B gets null', async () => {
        expect((await services.attachment.findById(attachmentId, A))?.id).toBe(
          attachmentId
        );
        expect(await services.attachment.findById(attachmentId, B)).toBeNull();
      });

      it("task: B's delete removes nothing (false) and the row survives", async () => {
        expect(await services.task.delete(taskId, B)).toBe(false);
        expect((await services.task.findById(taskId, A))?.id).toBe(taskId);
      });

      it("event: B's delete removes nothing (false) and the row survives", async () => {
        expect(await services.event.delete(eventId, B)).toBe(false);
        expect((await services.event.findById(eventId, A))?.id).toBe(eventId);
      });

      it("calendar: B's delete is rejected and the row survives", async () => {
        await expect(services.calendar.delete(calId, B)).rejects.toThrow(
          /AUTHORIZATION_ERROR/
        );
        expect((await services.calendar.findById(calId, A))?.id).toBe(calId);
      });

      it("task list: B's delete is rejected and the row survives", async () => {
        await expect(services.taskList.delete(listId, B)).rejects.toThrow(
          /AUTHORIZATION_ERROR/
        );
        expect((await services.taskList.findById(listId, A))?.id).toBe(listId);
      });

      it("attachment: B's delete is rejected and the row survives", async () => {
        await expect(
          services.attachment.delete(attachmentId, B)
        ).rejects.toThrow(/AUTHORIZATION_ERROR/);
        expect((await services.attachment.findById(attachmentId, A))?.id).toBe(
          attachmentId
        );
      });
    });

    // Runs last: these mutate A's own rows. Order respects FK cascades
    // (attachment before its task).
    describe('the legitimate owner can still delete their own rows', () => {
      it('attachment: A deletes their own', async () => {
        expect(await services.attachment.delete(attachmentId, A)).toBe(true);
        expect(await services.attachment.findById(attachmentId, A)).toBeNull();
      });

      it('task: A deletes their own', async () => {
        expect(await services.task.delete(taskId, A)).toBe(true);
        expect(await services.task.findById(taskId, A)).toBeNull();
      });

      it('event: A deletes their own', async () => {
        expect(await services.event.delete(eventId, A)).toBe(true);
        expect(await services.event.findById(eventId, A)).toBeNull();
      });
    });
  }
);
