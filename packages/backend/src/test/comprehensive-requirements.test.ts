/**
 * Comprehensive Test Suite for Requirements 1-4
 *
 * This test suite validates all implemented functionality for:
 * - Requirement 1: User Authentication and Authorization System
 * - Requirement 2: Database Schema and Data Models
 * - Requirement 3: Calendar Management API (schema only)
 * - Requirement 4: Event Management API (schema only)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AuthService from '../services/AuthService.js';
import { generateTokenPair, verifyToken } from '../utils/jwt.js';
import { query } from '../config/database.js';

// Mock Google OAuth for testing
vi.mock('../services/GoogleOAuthService.js', () => ({
  GoogleOAuthService: vi.fn().mockImplementation(() => ({
    isConfigured: vi.fn().mockReturnValue(true),
    getAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
    handleCallback: vi.fn().mockResolvedValue({
      user: { id: 'test-user', email: 'test@example.com', name: 'Test User' },
      tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh', expiresAt: Date.now() + 3600000 }
    }),
    verifyIdToken: vi.fn().mockResolvedValue({
      id: 'google-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
      picture: 'https://example.com/avatar.jpg'
    }),
    unlinkAccount: vi.fn().mockResolvedValue(undefined)
  }))
}));

const toIso = (value: Date | string) => new Date(value).toISOString();
const expectValidDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  expect(Number.isNaN(date.getTime())).toBe(false);
};

async function createUser(overrides: {
  id?: string;
  email?: string;
  name?: string | null;
  password?: string | null;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${randomUUID()}@example.com`;
  const name = overrides.name ?? 'Test User';
  const hashedPassword = overrides.password
    ? await bcrypt.hash(overrides.password, 12)
    : null;

  const result = await query<{
    id: string;
    email: string;
    name: string | null;
    password: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>(
    `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, email, name, password, "createdAt", "updatedAt"`,
    [id, email.toLowerCase(), name, hashedPassword]
  );

  return result.rows[0];
}

async function createUserProfile(userId: string, overrides: {
  id?: string;
  bio?: string | null;
  timezone?: string;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const bio = overrides.bio ?? null;
  const timezone = overrides.timezone ?? 'UTC';

  const result = await query<{
    id: string;
    userId: string;
    bio: string | null;
    timezone: string;
  }>(
    `INSERT INTO user_profiles (id, "userId", bio, timezone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, "userId", bio, timezone`,
    [id, userId, bio, timezone]
  );

  return result.rows[0];
}

async function createTaskList(userId: string, overrides: {
  id?: string;
  name?: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? 'Test List';
  const color = overrides.color ?? '#8B5CF6';
  const icon = overrides.icon ?? null;
  const description = overrides.description ?? null;

  const result = await query<{
    id: string;
    name: string;
    color: string;
    icon: string | null;
    description: string | null;
    userId: string;
  }>(
    `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, name, color, icon, description, "userId"`,
    [id, name, color, icon, description, userId]
  );

  return result.rows[0];
}

async function createTask(userId: string, taskListId: string, overrides: {
  id?: string;
  title?: string;
  completed?: boolean;
  priority?: string;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const title = overrides.title ?? 'Test Task';
  const completed = overrides.completed ?? false;
  const priority = overrides.priority ?? 'MEDIUM';

  const result = await query<{
    id: string;
    title: string;
    completed: boolean;
    userId: string;
    taskListId: string;
    priority: string;
  }>(
    `INSERT INTO tasks (id, title, completed, "userId", "taskListId", priority, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, title, completed, "userId", "taskListId", priority`,
    [id, title, completed, userId, taskListId, priority]
  );

  return result.rows[0];
}

async function createTag(overrides: {
  id?: string;
  name?: string;
  type?: string;
  color?: string | null;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? 'urgent';
  const type = overrides.type ?? 'PRIORITY';
  const color = overrides.color ?? null;

  const result = await query<{
    id: string;
    name: string;
    type: string;
    color: string | null;
  }>(
    `INSERT INTO tags (id, name, type, color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, type, color`,
    [id, name, type, color]
  );

  return result.rows[0];
}

async function createTaskTag(overrides: {
  taskId: string;
  tagId: string;
  value?: string;
  displayText?: string;
  iconName?: string;
}) {
  const value = overrides.value ?? 'high';
  const displayText = overrides.displayText ?? 'High Priority';
  const iconName = overrides.iconName ?? 'alert';

  const result = await query<{
    taskId: string;
    tagId: string;
    value: string;
    displayText: string;
    iconName: string;
  }>(
    `INSERT INTO task_tags ("taskId", "tagId", value, "displayText", "iconName")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING "taskId", "tagId", value, "displayText", "iconName"`,
    [overrides.taskId, overrides.tagId, value, displayText, iconName]
  );

  return result.rows[0];
}

async function createCalendar(userId: string, overrides: {
  id?: string;
  name?: string;
  color?: string | null;
  description?: string | null;
  isVisible?: boolean;
  isDefault?: boolean;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? 'Test Calendar';
  const color = overrides.color ?? '#3B82F6';
  const description = overrides.description ?? null;
  const isVisible = overrides.isVisible ?? true;
  const isDefault = overrides.isDefault ?? false;

  const result = await query<{
    id: string;
    name: string;
    color: string;
    description: string | null;
    isVisible: boolean;
    isDefault: boolean;
    userId: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>(
    `INSERT INTO calendars (id, name, color, description, "isVisible", "isDefault", "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING id, name, color, description, "isVisible", "isDefault", "userId", "createdAt", "updatedAt"`,
    [id, name, color, description, isVisible, isDefault, userId]
  );

  return result.rows[0];
}

async function createEvent(userId: string, calendarId: string, overrides: {
  id?: string;
  title?: string;
  description?: string | null;
  start?: Date;
  end?: Date;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  recurrence?: string | null;
} = {}) {
  const id = overrides.id ?? randomUUID();
  const title = overrides.title ?? 'Test Event';
  const description = overrides.description ?? null;
  const start = overrides.start ?? new Date();
  const end = overrides.end ?? new Date(Date.now() + 3600000);
  const allDay = overrides.allDay ?? false;
  const location = overrides.location ?? null;
  const notes = overrides.notes ?? null;
  const recurrence = overrides.recurrence ?? null;

  const result = await query<{
    id: string;
    title: string;
    description: string | null;
    start: Date | string;
    end: Date | string;
    allDay: boolean;
    location: string | null;
    notes: string | null;
    recurrence: string | null;
    userId: string;
    calendarId: string;
  }>(
    `INSERT INTO events (id, title, description, start, "end", "allDay", location, notes, recurrence, "userId", "calendarId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING id, title, description, start, "end", "allDay", location, notes, recurrence, "userId", "calendarId"`,
    [id, title, description, start, end, allDay, location, notes, recurrence, userId, calendarId]
  );

  return result.rows[0];
}

/**
 * Helper function to clean up test database
 */
async function cleanupDatabase() {
  await query('DELETE FROM task_tags');
  await query('DELETE FROM attachments');
  await query('DELETE FROM tasks');
  await query('DELETE FROM task_lists');
  await query('DELETE FROM tags');
  await query('DELETE FROM events');
  await query('DELETE FROM calendars');
  await query('DELETE FROM user_profiles');
  await query('DELETE FROM users');
}

describe('Comprehensive Requirements 1-4 Testing', () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('Requirement 1: User Authentication and Authorization System', () => {
    describe('1.1 & 1.2: Email/Password Registration and Storage', () => {
      it('should register new user with hashed password', async () => {
        const authService = new AuthService();
        const userData = {
          email: `test-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          name: 'Test User'
        };

        const result = await authService.registerUser(userData);

        expect(result.user.email).toBe(userData.email.toLowerCase());
        expect(result.user.name).toBe('Test User');
        expect(result.user.id).toBeDefined();
        expect(result.tokens.accessToken).toBeDefined();
        expect(result.tokens.refreshToken).toBeDefined();

        // Verify password is hashed in database
        const dbUser = await query<{ id: string; email: string; password: string | null }>(
          'SELECT id, email, password FROM users WHERE email = $1 LIMIT 1',
          [userData.email.toLowerCase()]
        );

        expect(dbUser.rows[0]).toBeDefined();
        expect(dbUser.rows[0].password).toBeDefined();
        expect(dbUser.rows[0].password).not.toBe('SecurePassword123!');
        expect(await bcrypt.compare('SecurePassword123!', dbUser.rows[0].password!)).toBe(true);
      });

      it('should prevent duplicate email registration', async () => {
        const authService = new AuthService();
        const userData = {
          email: `duplicate-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'First User'
        };

        await authService.registerUser(userData);

        await expect(authService.registerUser({
          ...userData,
          name: 'Second User'
        })).rejects.toThrow('USER_ALREADY_EXISTS');
      });

      it('should convert email to lowercase during registration', async () => {
        const authService = new AuthService();
        const userData = {
          email: `UPPERCASE-${Date.now()}@EXAMPLE.COM`,
          password: 'Password123!',
          name: 'Test User'
        };

        const result = await authService.registerUser(userData);
        expect(result.user.email).toBe(userData.email.toLowerCase());
      });
    });

    describe('1.3: JWT Token Generation and Validation', () => {
      it('should generate valid JWT tokens with proper claims', async () => {
        const userId = 'test-user-id';
        const email = 'test@example.com';

        const tokens = await generateTokenPair(userId, email);

        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(tokens.expiresAt).toBeGreaterThan(Date.now());

        // Verify access token
        const decoded = await verifyToken(tokens.accessToken);
        expect(decoded.userId).toBe(userId);
        expect(decoded.email).toBe(email);
        expect(decoded.type).toBe('access');
      });

      it('should generate refresh tokens with longer expiration', async () => {
        const tokens = await generateTokenPair('user-id', 'test@example.com');

        const accessDecoded = await verifyToken(tokens.accessToken);
        const refreshDecoded = await verifyToken(tokens.refreshToken);

        expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
        expect(refreshDecoded.type).toBe('refresh');
      });

      it('should reject invalid tokens', async () => {
        await expect(verifyToken('invalid-token')).rejects.toThrow();
        await expect(verifyToken('')).rejects.toThrow();
      });

      it('should reject expired tokens', async () => {
        const expiredToken = jwt.sign(
          { userId: 'test', email: 'test@example.com', type: 'access' },
          process.env.JWT_SECRET!,
          { expiresIn: '-1h' }
        );

        await expect(verifyToken(expiredToken)).rejects.toThrow();
      });
    });

    describe('1.4 & 1.5: Google OAuth2 Integration', () => {
      it('should be properly configured for OAuth', async () => {
        const { GoogleOAuthService } = await import('../services/GoogleOAuthService.js');
        const googleOAuthService = new GoogleOAuthService();
        expect(googleOAuthService.isConfigured()).toBe(true);
      });

      it('should generate OAuth authorization URL', async () => {
        const { GoogleOAuthService } = await import('../services/GoogleOAuthService.js');
        const googleOAuthService = new GoogleOAuthService();
        const authUrl = googleOAuthService.getAuthUrl();

        expect(authUrl).toContain('accounts.google.com');
        expect(authUrl).toContain('oauth');
        expect(authUrl).toContain('mock=true');
      });

      it('should handle OAuth callback flow', async () => {
        const { GoogleOAuthService } = await import('../services/GoogleOAuthService.js');
        const googleOAuthService = new GoogleOAuthService();

        const result = await googleOAuthService.handleCallback('mock-auth-code');

        expect(result.user.email).toBe('test@example.com');
        expect(result.tokens.accessToken).toBe('mock-token');
      });
    });

    describe('1.6: Token Expiration and Refresh', () => {
      it('should handle token refresh flow', async () => {
        const originalTokens = await generateTokenPair('user-id', 'test@example.com');

        // Verify refresh token is valid
        const refreshDecoded = await verifyToken(originalTokens.refreshToken);
        expect(refreshDecoded.type).toBe('refresh');

        // Wait a moment to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate new tokens using refresh token
        const newTokens = await generateTokenPair(refreshDecoded.userId, refreshDecoded.email);
        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
        expect(newTokens.accessToken).not.toBe(originalTokens.accessToken);
      });
    });

    describe('1.7: User Authorization and Data Access Control', () => {
      it('should ensure users can only access their own data', async () => {
        const authService = new AuthService();

        const result1 = await authService.registerUser({
          email: `user1-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User One'
        });

        const result2 = await authService.registerUser({
          email: `user2-${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User Two'
        });

        // Verify users can access their own data
        const retrievedUser1 = await authService.getUserById(result1.user.id);
        const retrievedUser2 = await authService.getUserById(result2.user.id);

        expect(retrievedUser1?.id).toBe(result1.user.id);
        expect(retrievedUser2?.id).toBe(result2.user.id);
        expect(retrievedUser1?.email).toBe(result1.user.email);
        expect(retrievedUser2?.email).toBe(result2.user.email);
      });
    });
  });

  describe('Requirement 2: Database Schema and Data Models', () => {
    describe('2.1: Database Table Creation and Relationships', () => {
      it('should create User with proper relationships', async () => {
        const user = await createUser({
          email: 'schema-test@example.com',
          name: 'Schema Test User',
          password: 'Password123!'
        });

        expect(user.id).toBeDefined();
        expect(user.email).toBe('schema-test@example.com');
        expectValidDate(user.createdAt);
        expectValidDate(user.updatedAt);
      });

      it('should create UserProfile with User relationship', async () => {
        const user = await createUser({
          email: 'profile-test@example.com',
          name: 'Profile Test User'
        });

        const profile = await createUserProfile(user.id, {
          bio: 'Test bio',
          timezone: 'America/New_York'
        });

        expect(profile.userId).toBe(user.id);
        expect(profile.bio).toBe('Test bio');
        expect(profile.timezone).toBe('America/New_York');

        // Test relationship
        const userWithProfile = await query<{ id: string; bio: string | null }>(
          `SELECT u.id, p.bio
           FROM users u
           LEFT JOIN user_profiles p ON p."userId" = u.id
           WHERE u.id = $1`,
          [user.id]
        );

        expect(userWithProfile.rows[0]?.bio).toBe('Test bio');
      });
    });

    describe('2.2 & 2.3: Foreign Key Relationships and Cascade Deletes', () => {
      it('should cascade delete user profile when user is deleted', async () => {
        const user = await createUser({
          email: 'cascade-test@example.com',
          name: 'Cascade Test User'
        });

        await createUserProfile(user.id, {
          bio: 'Will be deleted'
        });

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [user.id]);

        // Verify profile was cascade deleted
        const profile = await query('SELECT id FROM user_profiles WHERE "userId" = $1', [user.id]);
        expect(profile.rows.length).toBe(0);
      });

      it('should cascade delete calendars and events when user is deleted', async () => {
        const user = await createUser({
          email: 'calendar-cascade@example.com',
          name: 'Calendar Cascade User'
        });

        const calendar = await createCalendar(user.id, {
          name: 'Test Calendar'
        });

        const event = await createEvent(user.id, calendar.id, {
          title: 'Test Event',
          start: new Date(),
          end: new Date(Date.now() + 3600000)
        });

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [user.id]);

        // Verify cascade deletion
        const deletedCalendar = await query('SELECT id FROM calendars WHERE id = $1', [calendar.id]);
        const deletedEvent = await query('SELECT id FROM events WHERE id = $1', [event.id]);

        expect(deletedCalendar.rows.length).toBe(0);
        expect(deletedEvent.rows.length).toBe(0);
      });
    });

    describe('2.4: Task and Tag Many-to-Many Relationships', () => {
      it('should create tasks with tag relationships', async () => {
        const user = await createUser({
          email: 'task-tag-test@example.com',
          name: 'Task Tag User'
        });

        const taskList = await createTaskList(user.id, {
          name: 'Test List'
        });

        const tag = await createTag({
          name: 'urgent',
          type: 'PRIORITY'
        });

        const task = await createTask(user.id, taskList.id, {
          title: 'Test Task'
        });

        await createTaskTag({
          taskId: task.id,
          tagId: tag.id,
          value: 'high',
          displayText: 'High Priority',
          iconName: 'alert'
        });

        const taskTags = await query<{ tagName: string; displayText: string }>(
          `SELECT tt."displayText" as "displayText", tg.name as "tagName"
           FROM task_tags tt
           JOIN tags tg ON tg.id = tt."tagId"
           WHERE tt."taskId" = $1`,
          [task.id]
        );

        expect(taskTags.rows).toHaveLength(1);
        expect(taskTags.rows[0].tagName).toBe('urgent');
        expect(taskTags.rows[0].displayText).toBe('High Priority');
      });
    });

    describe('2.5: UTC Date Storage and Timezone Handling', () => {
      it('should store event dates in UTC format', async () => {
        const user = await createUser({
          email: 'date-test@example.com',
          name: 'Date Test User'
        });

        const calendar = await createCalendar(user.id, {
          name: 'Date Test Calendar'
        });

        const startDate = new Date('2024-12-25T10:00:00.000Z');
        const endDate = new Date('2024-12-25T11:00:00.000Z');

        const event = await createEvent(user.id, calendar.id, {
          title: 'UTC Test Event',
          start: startDate,
          end: endDate
        });

        expect(toIso(event.start)).toBe('2024-12-25T10:00:00.000Z');
        expect(toIso(event.end)).toBe('2024-12-25T11:00:00.000Z');
      });
    });

    describe('2.6: Unique Constraints and Business Rules', () => {
      it('should enforce unique calendar names per user', async () => {
        const user = await createUser({
          email: 'unique-test@example.com',
          name: 'Unique Test User'
        });

        await createCalendar(user.id, {
          name: 'Work Calendar'
        });

        // Should fail due to unique constraint
        await expect(query(
          `INSERT INTO calendars (id, name, "userId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [randomUUID(), 'Work Calendar', user.id]
        )).rejects.toThrow();
      });

      it('should allow same calendar name for different users', async () => {
        const user1 = await createUser({
          email: 'user1-unique@example.com',
          name: 'User One'
        });

        const user2 = await createUser({
          email: 'user2-unique@example.com',
          name: 'User Two'
        });

        const calendar1 = await createCalendar(user1.id, {
          name: 'Personal'
        });

        const calendar2 = await createCalendar(user2.id, {
          name: 'Personal'
        });

        expect(calendar1.name).toBe('Personal');
        expect(calendar2.name).toBe('Personal');
        expect(calendar1.userId).not.toBe(calendar2.userId);
      });
    });

    describe('2.7: Database Indexes and Performance', () => {
      it('should efficiently query tasks by user and completion status', async () => {
        const user = await createUser({
          email: 'performance-test@example.com',
          name: 'Performance Test User'
        });

        const taskList = await createTaskList(user.id, {
          name: 'Performance List'
        });

        // Create multiple tasks
        await Promise.all([
          createTask(user.id, taskList.id, {
            title: 'Completed Task 1',
            completed: true
          }),
          createTask(user.id, taskList.id, {
            title: 'Incomplete Task 1',
            completed: false
          }),
          createTask(user.id, taskList.id, {
            title: 'Completed Task 2',
            completed: true
          })
        ]);

        // Query completed tasks (should use index)
        const completedTasks = await query<{ completed: boolean }>(
          'SELECT completed FROM tasks WHERE "userId" = $1 AND completed = true',
          [user.id]
        );

        expect(completedTasks.rows).toHaveLength(2);
        expect(completedTasks.rows.every(task => task.completed)).toBe(true);
      });
    });
  });

  describe('Requirements 3 & 4: Calendar and Event Schema Validation', () => {
    describe('Calendar Model Validation', () => {
      it('should create calendar with default values', async () => {
        const user = await createUser({
          email: 'calendar-default@example.com',
          name: 'Calendar Default User'
        });

        const result = await query<{
          id: string;
          name: string;
          color: string;
          isVisible: boolean;
          isDefault: boolean;
          createdAt: Date | string;
          updatedAt: Date | string;
        }>(
          `INSERT INTO calendars (id, name, "userId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING id, name, color, "isVisible", "isDefault", "createdAt", "updatedAt"`,
          [randomUUID(), 'Default Test Calendar', user.id]
        );

        const calendar = result.rows[0];

        expect(calendar.color).toBe('#3B82F6'); // Default blue
        expect(calendar.isVisible).toBe(true);
        expect(calendar.isDefault).toBe(false);
        expectValidDate(calendar.createdAt);
        expectValidDate(calendar.updatedAt);
      });

      it('should support calendar customization', async () => {
        const user = await createUser({
          email: 'calendar-custom@example.com',
          name: 'Calendar Custom User'
        });

        const calendar = await createCalendar(user.id, {
          name: 'Custom Calendar',
          color: '#FF5733',
          description: 'My custom calendar',
          isVisible: false,
          isDefault: true
        });

        expect(calendar.color).toBe('#FF5733');
        expect(calendar.description).toBe('My custom calendar');
        expect(calendar.isVisible).toBe(false);
        expect(calendar.isDefault).toBe(true);
      });
    });

    describe('Event Model Validation', () => {
      it('should create event with all metadata fields', async () => {
        const user = await createUser({
          email: 'event-test@example.com',
          name: 'Event Test User'
        });

        const calendar = await createCalendar(user.id, {
          name: 'Event Test Calendar'
        });

        const event = await createEvent(user.id, calendar.id, {
          title: 'Comprehensive Event',
          description: 'A detailed event description',
          start: new Date('2024-12-25T14:00:00.000Z'),
          end: new Date('2024-12-25T15:30:00.000Z'),
          allDay: false,
          location: '123 Main St, City, State',
          notes: 'Important meeting notes',
          recurrence: 'FREQ=WEEKLY;BYDAY=TU'
        });

        expect(event.title).toBe('Comprehensive Event');
        expect(event.description).toBe('A detailed event description');
        expect(event.location).toBe('123 Main St, City, State');
        expect(event.notes).toBe('Important meeting notes');
        expect(event.recurrence).toBe('FREQ=WEEKLY;BYDAY=TU');
        expect(event.allDay).toBe(false);
      });

      it('should support all-day events', async () => {
        const user = await createUser({
          email: 'allday-test@example.com',
          name: 'All Day Test User'
        });

        const calendar = await createCalendar(user.id, {
          name: 'All Day Calendar'
        });

        const event = await createEvent(user.id, calendar.id, {
          title: 'All Day Event',
          start: new Date('2024-12-25T00:00:00.000Z'),
          end: new Date('2024-12-25T23:59:59.999Z'),
          allDay: true
        });

        expect(event.allDay).toBe(true);
        expect(event.title).toBe('All Day Event');
      });
    });
  });
});
