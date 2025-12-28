/**
 * Tests for useTasks hook and related functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
  useScheduleTask,
} from '../useTasks';
import { taskApi } from '../../services/api';
import type { Task } from '@shared/types';

vi.mock('../../services/api', () => ({
  taskApi: {
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleTask: vi.fn(),
    scheduleTask: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

const mockTaskApi = taskApi as typeof taskApi & {
  fetchTasks: ReturnType<typeof vi.fn>;
  createTask: ReturnType<typeof vi.fn>;
  updateTask: ReturnType<typeof vi.fn>;
  deleteTask: ReturnType<typeof vi.fn>;
  toggleTask: ReturnType<typeof vi.fn>;
  scheduleTask: ReturnType<typeof vi.fn>;
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

// Sample test data
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Test Task 1',
    completed: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userId: 'test-user',
    priority: 'medium',
  },
  {
    id: '2',
    title: 'Test Task 2',
    completed: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    userId: 'test-user',
    scheduledDate: new Date('2024-01-15'),
    priority: 'high',
  },
  {
    id: '3',
    title: 'Test Task 3',
    completed: false,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    userId: 'test-user',
    priority: 'low',
  },
];

describe('useTasks Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskApi.fetchTasks.mockResolvedValue([...mockTasks]);
  });

  describe('useTasks', () => {
    it('should fetch and return tasks', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(mockTaskApi.fetchTasks).toHaveBeenCalledTimes(1);
    });

    it('should filter out completed tasks when showCompleted is false', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTasks({ showCompleted: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const incompleteTasks = result.current.data?.filter(
        (task) => !task.completed
      );
      expect(incompleteTasks).toHaveLength(2);
    });

    it('should filter tasks by search term', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTasks({ search: 'Task 1' }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].title).toBe('Test Task 1');
    });

    it('should filter scheduled tasks only', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTasks({ scheduledOnly: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const scheduledTasks = result.current.data?.filter(
        (task) => task.scheduledDate
      );
      expect(scheduledTasks).toHaveLength(1);
    });
  });

  describe('useCreateTask', () => {
    it('should create a new task successfully', async () => {
      const createdTask: Task = {
        id: 'test-uuid-123',
        title: 'New Test Task',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'test-user',
        priority: 'high',
      };
      mockTaskApi.createTask.mockResolvedValue(createdTask);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper });

      const newTaskData = {
        title: 'New Test Task',
        priority: 'high' as const,
      };

      await waitFor(() => {
        result.current.mutate(newTaskData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Test Task',
          priority: 'high',
        })
      );
    });

    it('should handle validation errors', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper });

      const invalidTaskData = {
        title: '', // Empty title should fail validation
      };

      mockTaskApi.createTask.mockRejectedValue(new Error('Title is required'));

      await waitFor(() => {
        result.current.mutate(invalidTaskData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('required');
    });
  });

  describe('useUpdateTask', () => {
    it('should update a task successfully', async () => {
      mockTaskApi.updateTask.mockResolvedValue({
        ...mockTasks[0],
        title: 'Updated Task',
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateTask(), { wrapper });

      const updateData = {
        id: '1',
        data: { title: 'Updated Task' },
      };

      await waitFor(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskApi.updateTask).toHaveBeenCalledWith('1', {
        title: 'Updated Task',
      });
    });
  });

  describe('useDeleteTask', () => {
    it('should delete a task successfully', async () => {
      mockTaskApi.deleteTask.mockResolvedValue(undefined);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate('1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskApi.deleteTask).toHaveBeenCalledWith('1');
    });
  });

  describe('useToggleTask', () => {
    it('should toggle task completion status', async () => {
      mockTaskApi.toggleTask.mockResolvedValue({
        ...mockTasks[0],
        completed: true,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useToggleTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate('1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskApi.toggleTask).toHaveBeenCalledWith('1');
    });
  });

  describe('useScheduleTask', () => {
    it('should schedule a task for a specific date', async () => {
      const scheduledDate = new Date('2024-02-01');
      mockTaskApi.scheduleTask.mockResolvedValue({
        ...mockTasks[0],
        scheduledDate,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useScheduleTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate({ id: '1', scheduledDate });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskApi.scheduleTask).toHaveBeenCalledWith('1', scheduledDate);
    });
  });
});

describe('Task Filtering Logic', () => {
  const testTasks: Task[] = [
    {
      id: '1',
      title: 'Important Meeting',
      completed: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      userId: 'test-user',
      priority: 'high',
    },
    {
      id: '2',
      title: 'Buy groceries',
      completed: true,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      userId: 'test-user',
      priority: 'low',
    },
    {
      id: '3',
      title: 'Meeting preparation',
      completed: false,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
      userId: 'test-user',
      scheduledDate: new Date('2024-01-15'),
      priority: 'medium',
    },
  ];

  beforeEach(() => {
    mockTaskApi.fetchTasks.mockResolvedValue([...testTasks]);
  });

  it('should filter by multiple criteria', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useTasks({
          showCompleted: false,
          search: 'meeting',
          scheduledOnly: false,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should find both "Important Meeting" and "Meeting preparation"
    // but exclude completed tasks
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.every((task) => !task.completed)).toBe(true);
    expect(
      result.current.data?.every((task) =>
        task.title.toLowerCase().includes('meeting')
      )
    ).toBe(true);
  });

  it('should sort tasks correctly', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const tasks = result.current.data || [];

    // Completed tasks should be at the end
    const completedIndex = tasks.findIndex((task) => task.completed);
    const incompleteAfterCompleted = tasks
      .slice(completedIndex + 1)
      .some((task) => !task.completed);
    expect(incompleteAfterCompleted).toBe(false);

    // Among incomplete tasks, newer should come first
    const incompleteTasks = tasks.filter((task) => !task.completed);
    for (let i = 0; i < incompleteTasks.length - 1; i++) {
      expect(incompleteTasks[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        incompleteTasks[i + 1].createdAt.getTime()
      );
    }
  });
});
