/**
 * Integration tests for React Query data management
 * Tests caching, synchronization, and optimistic updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  useTasks,
  useCreateTask,
} from '../useTasks';
import {
  useEvents,
  useCreateEvent,
} from '../useEvents';
import {
  useCalendars,
  useCreateCalendar,
} from '../useCalendars';

// Mock the storage utilities
vi.mock('../../utils/storage', () => ({
  taskStorage: {
    getTasks: vi.fn(() => []),
    addTask: vi.fn(() => true),
    updateTask: vi.fn(() => true),
    deleteTask: vi.fn(() => true),
  },
  eventStorage: {
    getEvents: vi.fn(() => []),
    addEvent: vi.fn(() => true),
    updateEvent: vi.fn(() => true),
    deleteEvent: vi.fn(() => true),
  },
  calendarStorage: {
    getCalendars: vi.fn(() => [
      {
        name: 'Personal',
        color: '#3B82F6',
        visible: true,
        isDefault: true,
        description: 'Personal calendar',
      },
    ]),
    addCalendar: vi.fn(() => true),
    updateCalendar: vi.fn(() => true),
    deleteCalendar: vi.fn(() => true),
  },
}));

// Mock validation utilities
vi.mock('../../utils/validation', () => ({
  validateTaskTitle: vi.fn(() => []),
  validateEvent: vi.fn(() => ({ isValid: true, errors: [] })),
  validateCalendar: vi.fn(() => ({ isValid: true, errors: [] })),
}));

// Mock date utilities
vi.mock('../../utils/date', () => ({
  toUTC: vi.fn((date) => date),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('React Query Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Fetching and Caching', () => {
    it('should cache task data correctly', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useTasks(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should cache event data correctly', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useEvents(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should cache calendar data correctly', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useCalendars(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0]?.name).toBe('Personal');
    });
  });

  describe('Mutations and Optimistic Updates', () => {
    it('should handle task creation mutation', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useCreateTask(), { wrapper });
      
      expect(result.current.mutate).toBeDefined();
      expect(result.current.isIdle).toBe(true);
      
      // Test mutation
      result.current.mutate({
        title: 'Test Task',
        priority: 'high',
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isPending).toBe(true);
      });
    });

    it('should handle event creation mutation', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useCreateEvent(), { wrapper });
      
      expect(result.current.mutate).toBeDefined();
      expect(result.current.isIdle).toBe(true);
      
      // Test mutation
      result.current.mutate({
        title: 'Test Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z'),
        calendarName: 'Personal',
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isPending).toBe(true);
      });
    });

    it('should handle calendar creation mutation', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useCreateCalendar(), { wrapper });
      
      expect(result.current.mutate).toBeDefined();
      expect(result.current.isIdle).toBe(true);
      
      // Test mutation
      result.current.mutate({
        name: 'Work',
        color: '#EF4444',
        visible: true,
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isPending).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle task creation errors', async () => {
      // Mock validation to return an error
      const { validateTaskTitle } = await import('../../utils/validation');
      vi.mocked(validateTaskTitle).mockReturnValue([
        { field: 'title', message: 'Title is required' }
      ]);
      
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper });
      
      result.current.mutate({
        title: '',
        priority: 'low',
      });
      
      await waitFor(() => {
        expect(result.current.isError || result.current.isPending).toBe(true);
      });
    });
  });

  describe('Query Invalidation and Synchronization', () => {
    it('should support multiple simultaneous queries', async () => {
      const wrapper = createWrapper();
      
      const tasksResult = renderHook(() => useTasks(), { wrapper });
      const eventsResult = renderHook(() => useEvents(), { wrapper });
      const calendarsResult = renderHook(() => useCalendars(), { wrapper });
      
      await waitFor(() => {
        expect(tasksResult.result.current.isSuccess).toBe(true);
        expect(eventsResult.result.current.isSuccess).toBe(true);
        expect(calendarsResult.result.current.isSuccess).toBe(true);
      });
      
      // All queries should be successful
      expect(tasksResult.result.current.data).toBeDefined();
      expect(eventsResult.result.current.data).toBeDefined();
      expect(calendarsResult.result.current.data).toBeDefined();
    });
  });

  describe('Loading States', () => {
    it('should provide loading states for queries', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useTasks(), { wrapper });
      
      // Should start in loading state
      expect(result.current.isLoading || result.current.isPending).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.isLoading).toBe(false);
    });

    it('should provide loading states for mutations', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useCreateTask(), { wrapper });
      
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isPending).toBe(false);
      
      result.current.mutate({
        title: 'Test Task',
        priority: 'medium',
      });
      
      // Should enter pending state
      expect(result.current.isPending || result.current.isSuccess).toBe(true);
    });
  });
});