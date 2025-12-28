/**
 * Custom hooks for task management with React Query integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@shared/types';
import {
  taskApi,
  type UpdateTaskData,
  type CreateTaskData,
} from '../services/api';
import { toast } from 'sonner';

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

  // Create task mutation (optimistic)
  const addTask = useMutation<
    Task,
    Error,
    CreateTaskData,
    { previousTasks?: Task[]; tempId?: string }
  >({
    mutationFn: taskApi.createTask,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      const tempId = `temp-${Date.now()}`;
      const tempTask: Task = {
        id: tempId,
        title: variables.title.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledDate: variables.scheduledDate,
        priority: variables.priority || 'medium',
        taskListId: variables.taskListId,
        tags: variables.tags,
        parsedMetadata: variables.parsedMetadata,
        attachments: variables.attachments?.map((f, idx) => ({
          id: `temp-att-${idx}-${Date.now()}`,
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url,
          uploadedAt: new Date(),
          taskId: tempId,
        })),
      };
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => [tempTask, ...(oldData || [])]
      );
      return { previousTasks, tempId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
      toast.error(error.message || 'Failed to create task');
    },
    onSuccess: (newTask, _variables, context) => {
      // Replace temp with real task if present
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          const list = oldData || [];
          if (!context?.tempId) return [newTask, ...list];
          const idx = list.findIndex((t) => t.id === context.tempId);
          if (idx === -1) return [newTask, ...list];
          const copy = [...list];
          copy[idx] = newTask;
          return copy;
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });

  // Update task mutation (optimistic)
  const updateTask = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      taskApi.updateTask(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((task) => {
            if (task.id !== id) return task;
            const merged: Task = { ...task, ...updates };
            // Keep checkbox <-> status linkage optimistic in cache
            const status = updates.status;
            const hasCompletedUpdate = Object.prototype.hasOwnProperty.call(
              updates,
              'completed'
            );
            if (status) {
              if (status === 'done') {
                merged.completed = true;
                merged.completedAt = new Date();
              } else if (!hasCompletedUpdate) {
                merged.completed = false;
                merged.completedAt = undefined;
              }
            }
            return merged;
          });
        }
      );
      return { previousTasks };
    },
    onError: (error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
      toast.error(error.message || 'Failed to update task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });

  // Delete task mutation (optimistic)
  const deleteTask = useMutation({
    mutationFn: taskApi.deleteTask,
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) =>
          (oldData || []).filter((task) => task.id !== deletedId)
      );
      return { previousTasks };
    },
    onError: (error, _deletedId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
      toast.error(error.message || 'Failed to delete task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });

  // Schedule task mutation (optimistic)
  const scheduleTask = useMutation({
    mutationFn: (variables: { id: string; scheduledDate: Date }) =>
      taskApi.scheduleTask(variables.id, variables.scheduledDate),
    onMutate: async ({ id, scheduledDate }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((task) =>
            task.id === id ? { ...task, scheduledDate } : task
          );
        }
      );
      return { previousTasks };
    },
    onError: (error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
      toast.error(error.message || 'Failed to schedule task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });

  // Return data and mutations in the format LeftPane expects
  return {
    data: filterTasks(tasksQuery.data || [], filters),
    isLoading: tasksQuery.isLoading,
    isSuccess: tasksQuery.isSuccess,
    isPending: tasksQuery.isPending,
    error: tasksQuery.error,
    addTask,
    updateTask,
    deleteTask,
    scheduleTask,
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

  return useMutation<
    Task,
    Error,
    CreateTaskData,
    { previousTasks?: Task[]; tempId?: string }
  >({
    mutationFn: taskApi.createTask,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      const tempId = `temp-${Date.now()}`;
      const tempTask: Task = {
        id: tempId,
        title: variables.title.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledDate: variables.scheduledDate,
        priority: variables.priority || 'medium',
        taskListId: variables.taskListId,
        tags: variables.tags,
        parsedMetadata: variables.parsedMetadata,
      };
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => [tempTask, ...(oldData || [])]
      );
      return { previousTasks, tempId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
    },
    onSuccess: (newTask, _variables, context) => {
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          const list = oldData || [];
          if (!context?.tempId) return [newTask, ...list];
          const idx = list.findIndex((t) => t.id === context.tempId);
          if (idx === -1) return [newTask, ...list];
          const copy = [...list];
          copy[idx] = newTask;
          return copy;
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((task) => {
            if (task.id !== id) return task;
            const merged = { ...task, ...data };
            // Handle completedAt when completed flag changes
            if ('completed' in data) {
              if (data.completed) {
                merged.completedAt = merged.completedAt || new Date();
              } else {
                merged.completedAt = undefined;
              }
            }
            return merged;
          });
        }
      );
      return { previousTasks };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
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
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) =>
          (oldData || []).filter((task) => task.id !== deletedId)
      );
      return { previousTasks };
    },
    onError: (_error, _deletedId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
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
          return oldData.map((task) => {
            if (task.id !== taskId) return task;
            const willBeCompleted = !task.completed;
            return {
              ...task,
              completed: willBeCompleted,
              completedAt: willBeCompleted ? new Date() : undefined,
            };
          });
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
    onMutate: async ({ id, scheduledDate }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.all });
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.all);
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.all },
        (oldData: Task[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((task) =>
            task.id === id ? { ...task, scheduledDate } : task
          );
        }
      );
      return { previousTasks };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.all, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() });
    },
  });
};
