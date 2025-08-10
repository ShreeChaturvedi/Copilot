import { PrismaClient, Priority, TagType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      name: 'John Doe',
      password: hashedPassword,
      profile: {
        create: {
          bio: 'Software developer and productivity enthusiast',
          timezone: 'America/New_York',
        },
      },
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      name: 'Jane Smith',
      password: hashedPassword,
      profile: {
        create: {
          bio: 'Project manager and team lead',
          timezone: 'America/Los_Angeles',
        },
      },
    },
  });

  console.log('✅ Created users');

  // Create sample calendars
  const personalCalendar = await prisma.calendar.create({
    data: {
      name: 'Personal',
      color: '#3B82F6',
      description: 'Personal events and appointments',
      isDefault: true,
      userId: user1.id,
    },
  });

  const workCalendar = await prisma.calendar.create({
    data: {
      name: 'Work',
      color: '#EF4444',
      description: 'Work meetings and deadlines',
      userId: user1.id,
    },
  });

  console.log('✅ Created calendars');

  // Create sample events
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await prisma.event.createMany({
    data: [
      {
        title: 'Team Meeting',
        description: 'Weekly team sync',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0),
        location: 'Conference Room A',
        userId: user1.id,
        calendarId: workCalendar.id,
      },
      {
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 14, 30),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 15, 30),
        location: 'Medical Center',
        userId: user1.id,
        calendarId: personalCalendar.id,
      },
      {
        title: 'Project Deadline',
        description: 'Submit final project deliverables',
        start: nextWeek,
        end: nextWeek,
        allDay: true,
        userId: user1.id,
        calendarId: workCalendar.id,
      },
    ],
  });

  console.log('✅ Created events');

  // Create sample task lists
  const personalTasks = await prisma.taskList.create({
    data: {
      name: 'Personal',
      color: '#8B5CF6',
      icon: 'user',
      description: 'Personal tasks and reminders',
      userId: user1.id,
    },
  });

  const workTasks = await prisma.taskList.create({
    data: {
      name: 'Work Projects',
      color: '#F59E0B',
      icon: 'briefcase',
      description: 'Work-related tasks and projects',
      userId: user1.id,
    },
  });

  console.log('✅ Created task lists');

  // Create sample tags
  await prisma.tag.createMany({
    data: [
      { name: 'urgent', type: TagType.PRIORITY, color: '#EF4444' },
      { name: 'home', type: TagType.LOCATION, color: '#10B981' },
      { name: 'office', type: TagType.LOCATION, color: '#3B82F6' },
      { name: 'meeting', type: TagType.LABEL, color: '#8B5CF6' },
      { name: 'personal', type: TagType.PROJECT, color: '#F59E0B' },
      { name: 'work', type: TagType.PROJECT, color: '#EF4444' },
    ],
  });

  const createdTags = await prisma.tag.findMany();
  console.log('✅ Created tags');

  // Create sample tasks
  const sampleTasks = [
    {
      title: 'Review project proposal',
      priority: Priority.HIGH,
      scheduledDate: tomorrow,
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Review project proposal tomorrow high priority',
      cleanTitle: 'Review project proposal',
    },
    {
      title: 'Buy groceries',
      priority: Priority.MEDIUM,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2),
      taskListId: personalTasks.id,
      userId: user1.id,
      originalInput: 'Buy groceries day after tomorrow',
      cleanTitle: 'Buy groceries',
    },
    {
      title: 'Call dentist for appointment',
      priority: Priority.LOW,
      taskListId: personalTasks.id,
      userId: user1.id,
      originalInput: 'Call dentist for appointment',
      cleanTitle: 'Call dentist for appointment',
    },
    {
      title: 'Prepare presentation slides',
      priority: Priority.HIGH,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Prepare presentation slides for next week high priority',
      cleanTitle: 'Prepare presentation slides',
    },
    {
      title: 'Complete code review',
      priority: Priority.MEDIUM,
      completed: true,
      completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Yesterday
      taskListId: workTasks.id,
      userId: user1.id,
      originalInput: 'Complete code review',
      cleanTitle: 'Complete code review',
    },
  ];

  for (const taskData of sampleTasks) {
    const task = await prisma.task.create({
      data: taskData,
    });

    // Add some tags to tasks
    if (taskData.title.includes('project') || taskData.title.includes('presentation')) {
      const workTag = createdTags.find(tag => tag.name === 'work');
      if (workTag) {
        await prisma.taskTag.create({
          data: {
            taskId: task.id,
            tagId: workTag.id,
            value: 'work',
            displayText: 'Work',
            iconName: 'briefcase',
          },
        });
      }
    }

    if (taskData.priority === Priority.HIGH) {
      const urgentTag = createdTags.find(tag => tag.name === 'urgent');
      if (urgentTag) {
        await prisma.taskTag.create({
          data: {
            taskId: task.id,
            tagId: urgentTag.id,
            value: 'urgent',
            displayText: 'Urgent',
            iconName: 'alert-triangle',
          },
        });
      }
    }

    if (taskData.title.includes('groceries') || taskData.title.includes('dentist')) {
      const personalTag = createdTags.find(tag => tag.name === 'personal');
      if (personalTag) {
        await prisma.taskTag.create({
          data: {
            taskId: task.id,
            tagId: personalTag.id,
            value: 'personal',
            displayText: 'Personal',
            iconName: 'user',
          },
        });
      }
    }
  }

  console.log('✅ Created tasks with tags');

  // Create some sample data for user2 as well
  await prisma.calendar.create({
    data: {
      name: 'Personal',
      color: '#10B981',
      description: 'Personal calendar',
      isDefault: true,
      userId: user2.id,
    },
  });

  const user2TaskList = await prisma.taskList.create({
    data: {
      name: 'To Do',
      color: '#6366F1',
      icon: 'check-square',
      description: 'General task list',
      userId: user2.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Plan team building event',
      priority: Priority.MEDIUM,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10),
      taskListId: user2TaskList.id,
      userId: user2.id,
      originalInput: 'Plan team building event next week',
      cleanTitle: 'Plan team building event',
    },
  });

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

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });