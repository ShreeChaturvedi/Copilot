import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../config/database.js';

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user1 = await withTransaction(async (tx) => {
    const upsert = await query<{ id: string; email: string; name: string | null }>(
      `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, name`,
      ['john@example.com', 'John Doe', hashedPassword], tx);
    const u = upsert.rows[0];
    await query(
      `INSERT INTO user_profiles (id, "userId", bio, timezone)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT ("userId") DO NOTHING`,
      [u.id, 'Software developer and productivity enthusiast', 'America/New_York'], tx);
    return u;
  });

  const user2 = await withTransaction(async (tx) => {
    const upsert = await query<{ id: string; email: string; name: string | null }>(
      `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, name`,
      ['jane@example.com', 'Jane Smith', hashedPassword], tx);
    const u = upsert.rows[0];
    await query(
      `INSERT INTO user_profiles (id, "userId", bio, timezone)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT ("userId") DO NOTHING`,
      [u.id, 'Project manager and team lead', 'America/Los_Angeles'], tx);
    return u;
  });

  console.log('✅ Created users');

  // Create sample calendars
  const personalCalendar = await query<{ id: string }>(
    `INSERT INTO calendars (id, name, color, description, "isDefault", "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Personal', '#3B82F6', 'Personal events and appointments', true, $1, NOW(), NOW())
     RETURNING id`,
    [user1.id]
  ).then(r => r.rows[0]);

  const workCalendar = await query<{ id: string }>(
    `INSERT INTO calendars (id, name, color, description, "isDefault", "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Work', '#EF4444', 'Work meetings and deadlines', false, $1, NOW(), NOW())
     RETURNING id`,
    [user1.id]
  ).then(r => r.rows[0]);

  console.log('✅ Created calendars');

  // Create sample events
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await query(
    `INSERT INTO events (id, title, description, start, "end", location, "userId", "calendarId", "createdAt", "updatedAt", "allDay") VALUES
     (gen_random_uuid()::text, 'Team Meeting', 'Weekly team sync', $1, $2, 'Conference Room A', $3, $4, NOW(), NOW(), false),
     (gen_random_uuid()::text, 'Doctor Appointment', 'Annual checkup', $5, $6, 'Medical Center', $3, $7, NOW(), NOW(), false),
     (gen_random_uuid()::text, 'Project Deadline', 'Submit final project deliverables', $8, $8, NULL, $3, $4, NOW(), NOW(), true)
    `,
    [
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0),
      user1.id,
      workCalendar.id,
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 14, 30),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 15, 30),
      personalCalendar.id,
      nextWeek,
    ]
  );

  console.log('✅ Created events');

  // Create sample task lists
  const personalTasks = await query<{ id: string }>(
    `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Personal', '#8B5CF6', 'user', 'Personal tasks and reminders', $1, NOW(), NOW()) RETURNING id`,
    [user1.id]
  ).then(r => r.rows[0]);

  const workTasks = await query<{ id: string }>(
    `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Work Projects', '#F59E0B', 'briefcase', 'Work-related tasks and projects', $1, NOW(), NOW()) RETURNING id`,
    [user1.id]
  ).then(r => r.rows[0]);

  console.log('✅ Created task lists');

  // Create sample tags
  await query(
    `INSERT INTO tags (id, name, type, color) VALUES
     (gen_random_uuid()::text, 'urgent', 'PRIORITY', '#EF4444'),
     (gen_random_uuid()::text, 'home', 'LOCATION', '#10B981'),
     (gen_random_uuid()::text, 'office', 'LOCATION', '#3B82F6'),
     (gen_random_uuid()::text, 'meeting', 'LABEL', '#8B5CF6'),
     (gen_random_uuid()::text, 'personal', 'PROJECT', '#F59E0B'),
     (gen_random_uuid()::text, 'work', 'PROJECT', '#EF4444')
     ON CONFLICT (name) DO NOTHING`
  );

  const createdTags = await query<{ id: string; name: string }>(`SELECT id, name FROM tags`);
  console.log('✅ Created tags');

  // Create sample tasks
  const sampleTasks: Array<{ title: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'; scheduledDate?: Date; taskListId: string; userId: string; originalInput: string; cleanTitle: string; completed?: boolean; completedAt?: Date }> = [
    {
      title: 'Review project proposal',
      priority: 'HIGH',
      scheduledDate: tomorrow,
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Review project proposal tomorrow high priority',
      cleanTitle: 'Review project proposal',
    },
    {
      title: 'Buy groceries',
      priority: 'MEDIUM',
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2),
      taskListId: personalTasks.id,
      userId: user1.id,
      originalInput: 'Buy groceries day after tomorrow',
      cleanTitle: 'Buy groceries',
    },
    {
      title: 'Call dentist for appointment',
      priority: 'LOW',
      taskListId: personalTasks.id,
      userId: user1.id,
      originalInput: 'Call dentist for appointment',
      cleanTitle: 'Call dentist for appointment',
    },
    {
      title: 'Prepare presentation slides',
      priority: 'HIGH',
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Prepare presentation slides for next week high priority',
      cleanTitle: 'Prepare presentation slides',
    },
    {
      title: 'Complete code review',
      priority: 'MEDIUM',
      completed: true,
      completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Yesterday
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Complete code review',
      cleanTitle: 'Complete code review',
    },
  ];

  for (const taskData of sampleTasks) {
    const taskRes = await query<{ id: string }>(
      `INSERT INTO tasks (id, title, priority, "scheduledDate", "taskListId", "userId", "originalInput", "cleanTitle", completed, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, COALESCE($8, false), NOW(), NOW()) RETURNING id`,
      [taskData.title, taskData.priority, taskData.scheduledDate ?? null, taskData.taskListId, taskData.userId, taskData.originalInput, taskData.cleanTitle, taskData.completed ?? false]
    );
    const task = taskRes.rows[0];

    // Add some tags to tasks
    if (taskData.title.includes('project') || taskData.title.includes('presentation')) {
      const workTag = createdTags.rows.find((tag) => tag.name === 'work');
      if (workTag) {
        await query(`INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName") VALUES ($1, $2, 'work', 'Work', 'briefcase')`, [task.id, workTag.id]);
      }
    }

    if (taskData.priority === 'HIGH') {
      const urgentTag = createdTags.rows.find((tag) => tag.name === 'urgent');
      if (urgentTag) {
        await query(`INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName") VALUES ($1, $2, 'urgent', 'Urgent', 'alert-triangle')`, [task.id, urgentTag.id]);
      }
    }

    if (taskData.title.includes('groceries') || taskData.title.includes('dentist')) {
      const personalTag = createdTags.rows.find((tag) => tag.name === 'personal');
      if (personalTag) {
        await query(`INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName") VALUES ($1, $2, 'personal', 'Personal', 'user')`, [task.id, personalTag.id]);
      }
    }
  }

  console.log('✅ Created tasks with tags');

  // Create some sample data for user2 as well
  await query(
    `INSERT INTO calendars (id, name, color, description, "isDefault", "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Personal', '#10B981', 'Personal calendar', true, $1, NOW(), NOW())`,
    [user2.id]
  );

  const user2TaskList = await query<{ id: string }>(
    `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'To Do', '#6366F1', 'check-square', 'General task list', $1, NOW(), NOW()) RETURNING id`,
    [user2.id]
  ).then(r => r.rows[0]);

  await query(
    `INSERT INTO tasks (id, title, priority, "scheduledDate", "taskListId", "userId", "originalInput", "cleanTitle", completed, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Plan team building event', 'MEDIUM', $1, $2, $3, 'Plan team building event next week', 'Plan team building event', false, NOW(), NOW())`,
    [new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10), user2TaskList.id, user2.id]
  );

  console.log('✅ Created sample data for second user');

  console.log('🎉 Database seeding completed successfully!');
  console.log(`
📊 Summary:
- Users: 2
- Calendars: 3
- Events: 3
- Task Lists: 3
- Tasks: 6
- Tags: 6
- Task-Tag relationships: Multiple
  `);
}

main().catch((e) => {
  console.error('❌ Error during seeding:', e);
  process.exit(1);
});