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
import { taskStorage } from '../../utils/storage';
import type { Task } from '../../types';

// Mock the storage utility
vi.mock('../../utils/storage', () => ({
  taskStorage: {
    getTasks: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

const mockTaskStorage = taskStorage as typeof taskStorage & {
  addTask: ReturnType<typeof vi.fn>;
  getTasks: ReturnType<typeof vi.fn>;
  saveTasks: ReturnType<typeof vi.fn>;
  updateTask: ReturnType<typeof vi.fn>;
  deleteTask: ReturnType<typeof vi.fn>;
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
    priority: 'medium',
  },
  {
    id: '2',
    title: 'Test Task 2',
    completed: true,
    createdAt: new Date('2024-01-02'),
    scheduledDate: new Date('2024-01-15'),
    priority: 'high',
  },
  {
    id: '3',
    title: 'Test Task 3',
    completed: false,
    createdAt: new Date('2024-01-03'),
    priority: 'low',
  },
];

describe('useTasks Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskStorage.getTasks.mockResolvedValue([...mockTasks]);
  });

  describe('useTasks', () => {
    it('should fetch and return tasks', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(mockTaskStorage.getTasks).toHaveBeenCalledTimes(1);
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
      mockTaskStorage.addTask.mockResolvedValue(true);

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

      expect(mockTaskStorage.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-123',
          title: 'New Test Task',
          completed: false,
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
      mockTaskStorage.updateTask.mockResolvedValue(true);
      mockTaskStorage.getTasks.mockResolvedValue([
        { ...mockTasks[0], title: 'Updated Task' },
        ...mockTasks.slice(1),
      ]);

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

      expect(mockTaskStorage.updateTask).toHaveBeenCalledWith('1', {
        title: 'Updated Task',
      });
    });
  });

  describe('useDeleteTask', () => {
    it('should delete a task successfully', async () => {
      mockTaskStorage.deleteTask.mockResolvedValue(true);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate('1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskStorage.deleteTask).toHaveBeenCalledWith('1');
    });
  });

  describe('useToggleTask', () => {
    it('should toggle task completion status', async () => {
      mockTaskStorage.updateTask.mockResolvedValue(true);
      mockTaskStorage.getTasks.mockResolvedValue([
        { ...mockTasks[0], completed: true },
        ...mockTasks.slice(1),
      ]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useToggleTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate('1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskStorage.updateTask).toHaveBeenCalledWith('1', {
        completed: true,
      });
    });
  });

  describe('useScheduleTask', () => {
    it('should schedule a task for a specific date', async () => {
      const scheduledDate = new Date('2024-02-01');
      mockTaskStorage.updateTask.mockResolvedValue(true);
      mockTaskStorage.getTasks.mockResolvedValue([
        { ...mockTasks[0], scheduledDate },
        ...mockTasks.slice(1),
      ]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useScheduleTask(), { wrapper });

      await waitFor(() => {
        result.current.mutate({ id: '1', scheduledDate });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockTaskStorage.updateTask).toHaveBeenCalledWith('1', {
        scheduledDate,
      });
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
      priority: 'high',
    },
    {
      id: '2',
      title: 'Buy groceries',
      completed: true,
      createdAt: new Date('2024-01-02'),
      priority: 'low',
    },
    {
      id: '3',
      title: 'Meeting preparation',
      completed: false,
      createdAt: new Date('2024-01-03'),
      scheduledDate: new Date('2024-01-15'),
      priority: 'medium',
    },
  ];

  beforeEach(() => {
    mockTaskStorage.getTasks.mockResolvedValue([...testTasks]);
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
