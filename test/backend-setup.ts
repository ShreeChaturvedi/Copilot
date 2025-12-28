/**
 * Backend test setup file
 * Configures the testing environment for backend API and service tests
 */
import { expect, vi } from 'vitest';
type ConsoleLike = Pick<Console, 'log' | 'debug' | 'info' | 'warn' | 'error'>;

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Mock console methods to reduce noise in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).console = {
  ...(console as ConsoleLike),
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as ConsoleLike;

// Keep real timers by default; individual tests can opt into fake timers.

// Global test utilities
// Provide explicit global declaration casts for Vitest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).createMockContext = (overrides: Record<string, unknown> = {}) => ({
  userId: 'test-user-123',
  requestId: 'test-request-123',
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Mock Prisma for tests that don't explicitly mock it
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    taskList: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    taskTag: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  })),
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Avoid resetAllMocks here so module mocks keep their implementations.

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend expect with custom matchers for backend testing
expect.extend({
  toBeValidTaskId(received) {
    const pass = typeof received === 'string' && received.startsWith('task-');
    return {
      message: () => `expected ${received} to be a valid task ID`,
      pass,
    };
  },
  
  toBeValidTaskListId(received) {
    const pass = typeof received === 'string' && received.startsWith('list-');
    return {
      message: () => `expected ${received} to be a valid task list ID`,
      pass,
    };
  },
  
  toBeValidUserId(received) {
    const pass = typeof received === 'string' && received.startsWith('user-');
    return {
      message: () => `expected ${received} to be a valid user ID`,
      pass,
    };
  },
  
  toHaveValidTimestamps(received) {
    const hasCreatedAt = received.createdAt instanceof Date;
    const hasUpdatedAt = received.updatedAt instanceof Date;
    const pass = hasCreatedAt && hasUpdatedAt;
    
    return {
      message: () => `expected object to have valid createdAt and updatedAt timestamps`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare global {
  // Avoid namespace usage; declare the module augmentation under Vitest types when needed
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidTaskId(): unknown;
      toBeValidTaskListId(): unknown;
      toBeValidUserId(): unknown;
      toHaveValidTimestamps(): unknown;
    }
  }

  // Global test utilities
  function createMockContext(overrides?: Record<string, unknown>): Record<string, unknown>;
  function createMockUser(overrides?: Record<string, unknown>): Record<string, unknown>;
}
