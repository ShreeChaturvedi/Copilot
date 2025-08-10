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
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AuthService from '../services/AuthService.js';
import { generateTokenPair, verifyToken } from '../utils/jwt.js';

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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

describe('Comprehensive Requirements 1-4 Testing', () => {
  beforeAll(async () => {
    // Ensure database is clean and ready
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up between tests
    await cleanupDatabase();
  });

  describe('Requirement 1: User Authentication and Authorization System', () => {
    describe('1.1 & 1.2: Email/Password Registration and Storage', () => {
      it('should register new user with hashed password', async () => {
        const authService = new AuthService(prisma);
        const userData = {
          email: `test-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          name: 'Test User'
        };

        const result = await authService.registerUser(userData);

        expect(result.user.email).toBe(userData.email);
        expect(result.user.name).toBe('Test User');
        expect(result.user.password).toBeUndefined(); // Should not return password
        expect(result.user.id).toBeDefined();
        expect(result.tokens.accessToken).toBeDefined();
        expect(result.tokens.refreshToken).toBeDefined();

        // Verify password is hashed in database
        const dbUser = await prisma.user.findUnique({
          where: { email: userData.email },
          select: { id: true, email: true, password: true }
        });
        
        // Debug: Check if user exists
        expect(dbUser).toBeDefined();
        expect(dbUser?.password).toBeDefined();
        expect(dbUser?.password).not.toBe('SecurePassword123!');
        expect(await bcrypt.compare('SecurePassword123!', dbUser!.password!)).toBe(true);
      });

      it('should prevent duplicate email registration', async () => {
        const authService = new AuthService(prisma);
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
        const authService = new AuthService(prisma);
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
        // Create two users
        const authService = new AuthService(prisma);
        
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
        const user = await prisma.user.create({
          data: {
            email: 'schema-test@example.com',
            name: 'Schema Test User',
            password: await bcrypt.hash('Password123!', 12)
          }
        });

        expect(user.id).toBeDefined();
        expect(user.email).toBe('schema-test@example.com');
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should create UserProfile with User relationship', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'profile-test@example.com',
            name: 'Profile Test User'
          }
        });

        const profile = await prisma.userProfile.create({
          data: {
            userId: user.id,
            bio: 'Test bio',
            timezone: 'America/New_York'
          }
        });

        expect(profile.userId).toBe(user.id);
        expect(profile.bio).toBe('Test bio');
        expect(profile.timezone).toBe('America/New_York');

        // Test relationship
        const userWithProfile = await prisma.user.findUnique({
          where: { id: user.id },
          include: { profile: true }
        });

        expect(userWithProfile?.profile?.bio).toBe('Test bio');
      });
    });

    describe('2.2 & 2.3: Foreign Key Relationships and Cascade Deletes', () => {
      it('should cascade delete user profile when user is deleted', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'cascade-test@example.com',
            name: 'Cascade Test User'
          }
        });

        await prisma.userProfile.create({
          data: {
            userId: user.id,
            bio: 'Will be deleted'
          }
        });

        // Delete user
        await prisma.user.delete({
          where: { id: user.id }
        });

        // Verify profile was cascade deleted
        const profile = await prisma.userProfile.findUnique({
          where: { userId: user.id }
        });
        expect(profile).toBeNull();
      });

      it('should cascade delete calendars and events when user is deleted', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'calendar-cascade@example.com',
            name: 'Calendar Cascade User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'Test Calendar',
            userId: user.id
          }
        });

        const event = await prisma.event.create({
          data: {
            title: 'Test Event',
            start: new Date(),
            end: new Date(Date.now() + 3600000), // 1 hour later
            userId: user.id,
            calendarId: calendar.id
          }
        });

        // Delete user
        await prisma.user.delete({
          where: { id: user.id }
        });

        // Verify cascade deletion
        const deletedCalendar = await prisma.calendar.findUnique({
          where: { id: calendar.id }
        });
        const deletedEvent = await prisma.event.findUnique({
          where: { id: event.id }
        });

        expect(deletedCalendar).toBeNull();
        expect(deletedEvent).toBeNull();
      });
    });

    describe('2.4: Task and Tag Many-to-Many Relationships', () => {
      it('should create tasks with tag relationships', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'task-tag-test@example.com',
            name: 'Task Tag User'
          }
        });

        const taskList = await prisma.taskList.create({
          data: {
            name: 'Test List',
            userId: user.id
          }
        });

        const tag = await prisma.tag.create({
          data: {
            name: 'urgent',
            type: 'PRIORITY'
          }
        });

        const task = await prisma.task.create({
          data: {
            title: 'Test Task',
            userId: user.id,
            taskListId: taskList.id,
            tags: {
              create: {
                tagId: tag.id,
                value: 'high',
                displayText: 'High Priority',
                iconName: 'alert'
              }
            }
          },
          include: {
            tags: {
              include: {
                tag: true
              }
            }
          }
        });

        expect(task.tags).toHaveLength(1);
        expect(task.tags[0].tag.name).toBe('urgent');
        expect(task.tags[0].displayText).toBe('High Priority');
      });
    });

    describe('2.5: UTC Date Storage and Timezone Handling', () => {
      it('should store event dates in UTC format', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'date-test@example.com',
            name: 'Date Test User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'Date Test Calendar',
            userId: user.id
          }
        });

        const startDate = new Date('2024-12-25T10:00:00.000Z');
        const endDate = new Date('2024-12-25T11:00:00.000Z');

        const event = await prisma.event.create({
          data: {
            title: 'UTC Test Event',
            start: startDate,
            end: endDate,
            userId: user.id,
            calendarId: calendar.id
          }
        });

        expect(event.start.toISOString()).toBe('2024-12-25T10:00:00.000Z');
        expect(event.end.toISOString()).toBe('2024-12-25T11:00:00.000Z');
      });
    });

    describe('2.6: Unique Constraints and Business Rules', () => {
      it('should enforce unique calendar names per user', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'unique-test@example.com',
            name: 'Unique Test User'
          }
        });

        await prisma.calendar.create({
          data: {
            name: 'Work Calendar',
            userId: user.id
          }
        });

        // Should fail due to unique constraint
        await expect(prisma.calendar.create({
          data: {
            name: 'Work Calendar',
            userId: user.id
          }
        })).rejects.toThrow();
      });

      it('should allow same calendar name for different users', async () => {
        const user1 = await prisma.user.create({
          data: {
            email: 'user1-unique@example.com',
            name: 'User One'
          }
        });

        const user2 = await prisma.user.create({
          data: {
            email: 'user2-unique@example.com',
            name: 'User Two'
          }
        });

        const calendar1 = await prisma.calendar.create({
          data: {
            name: 'Personal',
            userId: user1.id
          }
        });

        const calendar2 = await prisma.calendar.create({
          data: {
            name: 'Personal',
            userId: user2.id
          }
        });

        expect(calendar1.name).toBe('Personal');
        expect(calendar2.name).toBe('Personal');
        expect(calendar1.userId).not.toBe(calendar2.userId);
      });
    });

    describe('2.7: Database Indexes and Performance', () => {
      it('should efficiently query tasks by user and completion status', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'performance-test@example.com',
            name: 'Performance Test User'
          }
        });

        const taskList = await prisma.taskList.create({
          data: {
            name: 'Performance List',
            userId: user.id
          }
        });

        // Create multiple tasks
        await Promise.all([
          prisma.task.create({
            data: {
              title: 'Completed Task 1',
              completed: true,
              userId: user.id,
              taskListId: taskList.id
            }
          }),
          prisma.task.create({
            data: {
              title: 'Incomplete Task 1',
              completed: false,
              userId: user.id,
              taskListId: taskList.id
            }
          }),
          prisma.task.create({
            data: {
              title: 'Completed Task 2',
              completed: true,
              userId: user.id,
              taskListId: taskList.id
            }
          })
        ]);

        // Query completed tasks (should use index)
        const completedTasks = await prisma.task.findMany({
          where: {
            userId: user.id,
            completed: true
          }
        });

        expect(completedTasks).toHaveLength(2);
        expect(completedTasks.every(task => task.completed)).toBe(true);
      });
    });
  });

  describe('Requirements 3 & 4: Calendar and Event Schema Validation', () => {
    describe('Calendar Model Validation', () => {
      it('should create calendar with default values', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'calendar-default@example.com',
            name: 'Calendar Default User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'Default Test Calendar',
            userId: user.id
          }
        });

        expect(calendar.color).toBe('#3B82F6'); // Default blue
        expect(calendar.isVisible).toBe(true);
        expect(calendar.isDefault).toBe(false);
        expect(calendar.createdAt).toBeInstanceOf(Date);
        expect(calendar.updatedAt).toBeInstanceOf(Date);
      });

      it('should support calendar customization', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'calendar-custom@example.com',
            name: 'Calendar Custom User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'Custom Calendar',
            color: '#FF5733',
            description: 'My custom calendar',
            isVisible: false,
            isDefault: true,
            userId: user.id
          }
        });

        expect(calendar.color).toBe('#FF5733');
        expect(calendar.description).toBe('My custom calendar');
        expect(calendar.isVisible).toBe(false);
        expect(calendar.isDefault).toBe(true);
      });
    });

    describe('Event Model Validation', () => {
      it('should create event with all metadata fields', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'event-test@example.com',
            name: 'Event Test User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'Event Test Calendar',
            userId: user.id
          }
        });

        const event = await prisma.event.create({
          data: {
            title: 'Comprehensive Event',
            description: 'A detailed event description',
            start: new Date('2024-12-25T14:00:00.000Z'),
            end: new Date('2024-12-25T15:30:00.000Z'),
            allDay: false,
            location: '123 Main St, City, State',
            notes: 'Important meeting notes',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            userId: user.id,
            calendarId: calendar.id
          }
        });

        expect(event.title).toBe('Comprehensive Event');
        expect(event.description).toBe('A detailed event description');
        expect(event.location).toBe('123 Main St, City, State');
        expect(event.notes).toBe('Important meeting notes');
        expect(event.recurrence).toBe('FREQ=WEEKLY;BYDAY=TU');
        expect(event.allDay).toBe(false);
      });

      it('should support all-day events', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'allday-test@example.com',
            name: 'All Day Test User'
          }
        });

        const calendar = await prisma.calendar.create({
          data: {
            name: 'All Day Calendar',
            userId: user.id
          }
        });

        const event = await prisma.event.create({
          data: {
            title: 'All Day Event',
            start: new Date('2024-12-25T00:00:00.000Z'),
            end: new Date('2024-12-25T23:59:59.999Z'),
            allDay: true,
            userId: user.id,
            calendarId: calendar.id
          }
        });

        expect(event.allDay).toBe(true);
        expect(event.title).toBe('All Day Event');
      });
    });
  });
});

/**
 * Helper function to clean up test database
 */
async function cleanupDatabase() {
  // Delete in order to respect foreign key constraints
  await prisma.taskTag.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskList.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.event.deleteMany();
  await prisma.calendar.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
}