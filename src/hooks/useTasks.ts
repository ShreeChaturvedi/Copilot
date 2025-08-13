/**
 * Custom hooks for task management with React Query integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@shared/types';
import { taskApi, type UpdateTaskData, type CreateTaskData } from '../services/api';

/**
 * Query keys for task-related queries
 */
export const taskQueryKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskQueryKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskQueryKeys.lists(), filters] as const,
  details: () => [...taskQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskQueryKeys.details(), id] as const,
};

/**
 * Task filtering options
 */
export interface TaskFilters {
  showCompleted?: boolean;
  scheduledOnly?: boolean;
  search?: string;
}

/**
 * Filter tasks based on criteria
 */
const filterTasks = (tasks: Task[], filters: TaskFilters): Task[] => {
  let filtered = [...tasks];

  // Filter by completion status
  if (filters.showCompleted === false) {
    filtered = filtered.filter((task) => !task.completed);
  }

  // Filter by scheduled status
  if (filters.scheduledOnly) {
    filtered = filtered.filter((task) => task.scheduledDate !== undefined);
  }

  // Filter by search term
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.toLowerCase().trim();
    filtered = filtered.filter((task) =>
      task.title.toLowerCase().includes(searchTerm)
    );
  }

  // Sort by creation date (newest first), then by completion status
  filtered.sort((a, b) => {
    // Completed tasks go to bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // Then by creation date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return filtered;
};

/**
 * Comprehensive hook for task management - matches LeftPane expectations
 */
export const useTasks = (filters: TaskFilters = {}) => {
  // Note: filters functionality not yet implemented
  void filters;
  const queryClient = useQueryClient();

  // Main query for tasks data
  const tasksQuery = useQuery({
    queryKey: taskQueryKeys.all,
    queryFn: taskApi.fetchTasks,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Create task mutation
  const addTask = useMutation<Task, Error, CreateTaskData>({
    mutationFn: taskApi.createTask,
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [newTask];
          return [newTask, ...oldData];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      taskApi.updateTask(id, updates),
    onSuccess: (updatedTask) => {
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [updatedTask];
          return oldData.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: taskApi.deleteTask,
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((task) => task.id !== deletedId);
        }
      );
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
    },
  });

  // Schedule task mutation
  const scheduleTask = useMutation({
    mutationFn: (variables: { id: string; scheduledDate: Date }) =>
      taskApi.scheduleTask(variables.id, variables.scheduledDate),
    onSuccess: (updatedTask) => {
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [updatedTask];
          return oldData.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to schedule task:', error);
    },
  });

  // Helper to update attachments for a task in cache
  const updateTaskAttachmentsInCache = (taskId: string, updater: (attachments: Task['attachments'] | undefined) => Task['attachments'] | undefined) => {
    queryClient.setQueriesData(
      { queryKey: taskQueryKeys.all },
      (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((t) =>
          t.id === taskId ? { ...t, attachments: updater(t.attachments) } : t
        );
      }
    );
  };

  // Return data and mutations in the format LeftPane expects
  return {
    data: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    isSuccess: tasksQuery.isSuccess,
    isPending: tasksQuery.isPending,
    error: tasksQuery.error,
    addTask,
    updateTask,
    deleteTask,
    scheduleTask,
    updateTaskAttachmentsInCache,
    refetch: tasksQuery.refetch,
  };
};

/**
 * Hook to fetch and filter tasks (original version)
 */
export const useFilteredTasks = (filters: TaskFilters = {}) => {
  return useQuery({
    queryKey: taskQueryKeys.list(filters),
    queryFn: async () => {
      const tasks = await taskApi.fetchTasks();
      return filterTasks(tasks, filters);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};

/**
 * Hook to fetch all tasks without filtering
 */
export const useAllTasks = () => {
  return useQuery({
    queryKey: taskQueryKeys.all,
    queryFn: taskApi.fetchTasks,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to fetch a single task by ID
 */
export const useTask = (id: string) => {
  return useQuery({
    queryKey: taskQueryKeys.detail(id),
    queryFn: async () => {
      const tasks = await taskApi.fetchTasks();
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        throw new Error('Task not found');
      }
      return task;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to create a new task
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskApi.createTask,
    onSuccess: (newTask) => {
      // Invalidate and refetch task queries
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });

      // Optimistically add the task to existing queries
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.lists() },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [newTask];
          return [newTask, ...oldData];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
    },
  });
};

/**
 * Hook to update a task
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskData }) =>
      taskApi.updateTask(id, data),
    onSuccess: (updatedTask) => {
      // Update the task in all relevant queries
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [updatedTask];
          return oldData.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          );
        }
      );

      // Invalidate filtered queries to ensure they re-filter
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
    },
  });
};

/**
 * Hook to delete a task
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskApi.deleteTask,
    onSuccess: (_, deletedId) => {
      // Remove the task from all queries
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((task) => task.id !== deletedId);
        }
      );

      // Invalidate filtered queries
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
    },
  });
};

/**
 * Hook to toggle task completion
 */
export const useToggleTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskApi.toggleTask,
    onMutate: async (taskId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);

      // Optimistically update the task
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((task) =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          );
        }
      );

      return { previousTasks };
    },
    onError: (error, _taskId, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
      console.error('Failed to toggle task:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
};

/**
 * Hook to schedule a task
 */
export const useScheduleTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scheduledDate }: { id: string; scheduledDate: Date }) =>
      taskApi.scheduleTask(id, scheduledDate),
    onSuccess: (updatedTask) => {
      // Update the task in all queries
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [updatedTask];
          return oldData.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          );
        }
      );

      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to schedule task:', error);
    },
  });
};
