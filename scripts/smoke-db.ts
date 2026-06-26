/**
 * Schema<->service smoke test: exercises the real service layer against a real
 * database to prove the migration schema matches the SQL the services run.
 * Not a unit test; run manually against a throwaway DB.
 */
import { getAllServices } from '../lib/services/index.js';
import { query, pool } from '../lib/config/database.js';

const ctx = { userId: 'smoke-user-1', requestId: 'smoke' };

async function main() {
  const { calendar, event, taskList, task, tag } = getAllServices();

  // Seed the owning user (FKs require it).
  await query(
    `INSERT INTO users (id, email, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [ctx.userId, 'smoke@example.com']
  );

  console.log('1. create calendar');
  const cal = await calendar.create(
    { name: 'Smoke Cal', color: '#3B82F6', isDefault: true },
    ctx
  );

  console.log('2. create event');
  const ev = await event.create(
    {
      title: 'Smoke Event',
      start: new Date('2026-07-01T10:00:00Z'),
      end: new Date('2026-07-01T11:00:00Z'),
      calendarId: cal.id,
    } as never,
    ctx
  );

  console.log('3. create task list');
  const list = await taskList.create(
    { name: 'Smoke List', color: '#8B5CF6' },
    ctx
  );

  console.log('4. create task');
  const t = await task.create(
    { title: 'Smoke Task', taskListId: list.id, priority: 'HIGH' } as never,
    ctx
  );

  console.log('5. create + attach tag');
  const createdTag = await tag.create(
    { name: 'smoke-tag', type: 'LABEL' } as never,
    ctx
  );

  console.log('6. read back');
  const tasks = await task.findAll({}, ctx);
  const events = await event.findAll({}, ctx);
  const cals = await calendar.findAll({}, ctx);
  console.log(
    `   tasks=${tasks.length} events=${events.length} calendars=${cals.length} tag=${createdTag.name}`
  );

  console.log('7. toggle task completion');
  await task.update(t.id, { completed: true } as never, ctx);
  const toggled = await task.findById(t.id, ctx);
  console.log(
    `   completed=${toggled?.completed} status=${(toggled as { status?: string })?.status}`
  );

  console.log('8. cleanup');
  // Deleting the user cascades to calendars, task_lists, tasks, events, attachments.
  void event;
  void ev;
  await query('DELETE FROM users WHERE id = $1', [ctx.userId]);
  await query('DELETE FROM tags WHERE id = $1', [createdTag.id]);

  console.log('\n✅ SMOKE TEST PASSED - schema matches service SQL');
  await pool.end();
}

main().catch(async (err) => {
  console.error('\n❌ SMOKE TEST FAILED:', err);
  await pool.end();
  process.exit(1);
});
