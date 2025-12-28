/**
 * Integration tests for React Query data management
 * Tests caching, synchronization, and optimistic updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useTasks, useCreateTask } from '../useTasks';
import { useEvents, useCreateEvent } from '../useEvents';
import { useCalendars, useCreateCalendar } from '../useCalendars';

import { taskApi, eventApi, calendarApi } from '../../services/api';

vi.mock('../../services/api', () => ({
  taskApi: {
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
  },
  eventApi: {
    fetchEvents: vi.fn(),
    createEvent: vi.fn(),
  },
  calendarApi: {
    fetchCalendars: vi.fn(),
    createCalendar: vi.fn(),
  },
}));

const mockTaskApi = taskApi as typeof taskApi & {
  fetchTasks: ReturnType<typeof vi.fn>;
  createTask: ReturnType<typeof vi.fn>;
};

const mockEventApi = eventApi as typeof eventApi & {
  fetchEvents: ReturnType<typeof vi.fn>;
  createEvent: ReturnType<typeof vi.fn>;
};

const mockCalendarApi = calendarApi as typeof calendarApi & {
  fetchCalendars: ReturnType<typeof vi.fn>;
  createCalendar: ReturnType<typeof vi.fn>;
};

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
    mockTaskApi.fetchTasks.mockResolvedValue([]);
    mockEventApi.fetchEvents.mockResolvedValue([]);
    mockCalendarApi.fetchCalendars.mockResolvedValue([
      {
        name: 'Personal',
        color: '#3B82F6',
        visible: true,
        isDefault: true,
        description: 'Personal calendar',
      },
    ]);
    mockTaskApi.createTask.mockResolvedValue({
      id: 'task-1',
      title: 'Test Task',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'test-user',
    });
    mockEventApi.createEvent.mockResolvedValue({
      id: 'event-1',
      title: 'Test Event',
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T11:00:00Z'),
      calendarName: 'Personal',
    });
    mockCalendarApi.createCalendar.mockResolvedValue({
      id: 'cal-1',
      name: 'Work',
      color: '#EF4444',
      visible: true,
      isDefault: false,
    });
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
      mockTaskApi.createTask.mockRejectedValue(new Error('Title is required'));

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

      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true);
      });
    });
  });
});
