/**
 * Common test fixtures and data for API integration tests
 */

// User fixtures
export const testUsers = {
  standard: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  admin: {
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  secondary: {
    id: 'user-456',
    email: 'other@example.com',
    name: 'Other User',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
};

// Calendar fixtures
export const testCalendars = {
  primary: {
    id: 'cal-123',
    userId: 'user-123',
    name: 'Work Calendar',
    color: '#3B82F6',
    isVisible: true,
    isDefault: true,
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-10T00:00:00Z'),
  },
  personal: {
    id: 'cal-456',
    userId: 'user-123',
    name: 'Personal Calendar',
    color: '#10B981',
    isVisible: true,
    isDefault: false,
    createdAt: new Date('2024-01-11T00:00:00Z'),
    updatedAt: new Date('2024-01-11T00:00:00Z'),
  },
  hidden: {
    id: 'cal-789',
    userId: 'user-123',
    name: 'Hidden Calendar',
    color: '#6B7280',
    isVisible: false,
    isDefault: false,
    createdAt: new Date('2024-01-12T00:00:00Z'),
    updatedAt: new Date('2024-01-12T00:00:00Z'),
  },
};

// Event fixtures
export const testEvents = {
  meeting: {
    id: 'event-123',
    calendarId: 'cal-123',
    userId: 'user-123',
    title: 'Team Meeting',
    description: 'Weekly team sync',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    isAllDay: false,
    location: 'Conference Room A',
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z'),
  },
  allDay: {
    id: 'event-456',
    calendarId: 'cal-456',
    userId: 'user-123',
    title: 'Birthday',
    description: "Mom's birthday",
    startTime: new Date('2024-01-20T00:00:00Z'),
    endTime: new Date('2024-01-20T23:59:59Z'),
    isAllDay: true,
    createdAt: new Date('2024-01-14T11:00:00Z'),
    updatedAt: new Date('2024-01-14T11:00:00Z'),
  },
  recurring: {
    id: 'event-789',
    calendarId: 'cal-123',
    userId: 'user-123',
    title: 'Daily Standup',
    description: 'Daily team standup',
    startTime: new Date('2024-01-15T09:00:00Z'),
    endTime: new Date('2024-01-15T09:15:00Z'),
    isAllDay: false,
    rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
    createdAt: new Date('2024-01-14T12:00:00Z'),
    updatedAt: new Date('2024-01-14T12:00:00Z'),
  },
};

// Task List fixtures
export const testTaskLists = {
  work: {
    id: 'list-123',
    userId: 'user-123',
    name: 'Work Tasks',
    color: '#3B82F6',
    icon: 'briefcase',
    sortOrder: 0,
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-10T00:00:00Z'),
  },
  personal: {
    id: 'list-456',
    userId: 'user-123',
    name: 'Personal',
    color: '#10B981',
    icon: 'home',
    sortOrder: 1,
    createdAt: new Date('2024-01-11T00:00:00Z'),
    updatedAt: new Date('2024-01-11T00:00:00Z'),
  },
  shopping: {
    id: 'list-789',
    userId: 'user-123',
    name: 'Shopping',
    color: '#F59E0B',
    icon: 'shopping-cart',
    sortOrder: 2,
    createdAt: new Date('2024-01-12T00:00:00Z'),
    updatedAt: new Date('2024-01-12T00:00:00Z'),
  },
};

// Task fixtures
export const testTasks = {
  incomplete: {
    id: 'task-123',
    userId: 'user-123',
    taskListId: 'list-123',
    title: 'Complete project proposal',
    description: 'Write and submit Q1 project proposal',
    completed: false,
    priority: 'HIGH',
    scheduledDate: new Date('2024-01-20T00:00:00Z'),
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z'),
  },
  completed: {
    id: 'task-456',
    userId: 'user-123',
    taskListId: 'list-123',
    title: 'Review documentation',
    description: 'Review and approve API docs',
    completed: true,
    completedAt: new Date('2024-01-14T15:00:00Z'),
    priority: 'MEDIUM',
    createdAt: new Date('2024-01-13T10:00:00Z'),
    updatedAt: new Date('2024-01-14T15:00:00Z'),
  },
  lowPriority: {
    id: 'task-789',
    userId: 'user-123',
    taskListId: 'list-456',
    title: 'Buy groceries',
    description: 'Milk, eggs, bread',
    completed: false,
    priority: 'LOW',
    createdAt: new Date('2024-01-14T12:00:00Z'),
    updatedAt: new Date('2024-01-14T12:00:00Z'),
  },
};

// Tag fixtures
export const testTags = {
  priority: {
    id: 'tag-123',
    userId: 'user-123',
    name: 'high-priority',
    type: 'PRIORITY',
    color: '#EF4444',
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-10T00:00:00Z'),
  },
  category: {
    id: 'tag-456',
    userId: 'user-123',
    name: 'work',
    type: 'CATEGORY',
    color: '#3B82F6',
    createdAt: new Date('2024-01-11T00:00:00Z'),
    updatedAt: new Date('2024-01-11T00:00:00Z'),
  },
  custom: {
    id: 'tag-789',
    userId: 'user-123',
    name: 'urgent',
    type: 'CUSTOM',
    color: '#F97316',
    createdAt: new Date('2024-01-12T00:00:00Z'),
    updatedAt: new Date('2024-01-12T00:00:00Z'),
  },
};

// Attachment fixtures
export const testAttachments = {
  document: {
    id: 'att-123',
    userId: 'user-123',
    taskId: 'task-123',
    filename: 'proposal.pdf',
    fileUrl: 'https://blob.vercel-storage.com/proposal-abc123.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    createdAt: new Date('2024-01-14T10:00:00Z'),
  },
  image: {
    id: 'att-456',
    userId: 'user-123',
    eventId: 'event-123',
    filename: 'screenshot.png',
    fileUrl: 'https://blob.vercel-storage.com/screenshot-def456.png',
    fileSize: 512000,
    mimeType: 'image/png',
    createdAt: new Date('2024-01-14T11:00:00Z'),
  },
  spreadsheet: {
    id: 'att-789',
    userId: 'user-123',
    taskId: 'task-456',
    filename: 'budget.xlsx',
    fileUrl: 'https://blob.vercel-storage.com/budget-ghi789.xlsx',
    fileSize: 204800,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    createdAt: new Date('2024-01-14T12:00:00Z'),
  },
};

// Helper to create date ranges
export const dateRanges = {
  thisWeek: {
    start: new Date('2024-01-15T00:00:00Z'),
    end: new Date('2024-01-21T23:59:59Z'),
  },
  nextWeek: {
    start: new Date('2024-01-22T00:00:00Z'),
    end: new Date('2024-01-28T23:59:59Z'),
  },
  thisMonth: {
    start: new Date('2024-01-01T00:00:00Z'),
    end: new Date('2024-01-31T23:59:59Z'),
  },
};

// API Response fixtures
export const apiResponses = {
  success: <T>(data: T) => ({
    success: true,
    data,
    meta: {
      timestamp: expect.any(String),
    },
  }),
  error: (code: string, message: string) => ({
    success: false,
    error: {
      code,
      message,
      timestamp: expect.any(String),
      requestId: expect.any(String),
    },
  }),
  paginated: <T>(data: T[], page: number, limit: number, total: number) => ({
    success: true,
    data,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      timestamp: expect.any(String),
    },
  }),
};
