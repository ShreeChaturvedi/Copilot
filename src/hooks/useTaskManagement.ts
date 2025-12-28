import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTasks } from './useTasks';
import { SmartTaskData } from '@/components/smart-input/SmartTaskInput';
import { Task, TaskTag } from '@shared/types';
import { UseMutationResult } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface CreateTaskData {
  title: string;
  taskListId?: string;
  priority?: 'low' | 'medium' | 'high';
  scheduledDate?: Date;
  tags?: TaskTag[];
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
}

export interface TaskGroup {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

export interface UseTaskManagementOptions {
  includeTaskOperations?: boolean; // For LeftPane and TaskFocusPane only
}

interface TaskManagementWithOperations {
  // Task operations
  tasks: Task[];
  tasksLoading: boolean;
  addTask: UseMutationResult<Task, Error, CreateTaskData>;
  handleAddTask: (
    title: string,
    _groupId?: string,
    smartData?: SmartTaskData
  ) => void;
  handleToggleTask: (id: string) => void;
  handleEditTask: (id: string, title: string) => void;
  handleDeleteTask: (id: string) => void;
  handleScheduleTask: (id: string) => void;
  handleRemoveTag: (taskId: string, tagId: string) => void;

  // Task group state and operations
  taskGroups: TaskGroup[];
  activeTaskGroupId: string;
  setActiveTaskGroupId: (id: string) => void;
  showCreateTaskDialog: boolean;
  setShowCreateTaskDialog: (show: boolean) => void;

  // Task group handlers
  handleAddTaskGroup: (data: Omit<TaskGroup, 'id'>) => void;
  handleEditTaskGroup: (groupId: string, updates: Partial<TaskGroup>) => void;
  handleDeleteTaskGroup: (groupId: string) => void;
  handleSelectTaskGroup: (groupId: string) => void;
  handleCreateTaskGroup: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  handleUpdateTaskGroupIcon: (groupId: string, iconId: string) => void;
  handleUpdateTaskGroupColor: (groupId: string, color: string) => void;
  handleOpenCreateTaskDialog: () => void;
}

interface TaskManagementWithoutOperations {
  // Task group state and operations only
  taskGroups: TaskGroup[];
  activeTaskGroupId: string;
  setActiveTaskGroupId: (id: string) => void;
  showCreateTaskDialog: boolean;
  setShowCreateTaskDialog: (show: boolean) => void;

  // Task group handlers
  handleAddTaskGroup: (data: Omit<TaskGroup, 'id'>) => void;
  handleEditTaskGroup: (groupId: string, updates: Partial<TaskGroup>) => void;
  handleDeleteTaskGroup: (groupId: string) => void;
  handleSelectTaskGroup: (groupId: string) => void;
  handleCreateTaskGroup: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  handleUpdateTaskGroupIcon: (groupId: string, iconId: string) => void;
  handleUpdateTaskGroupColor: (groupId: string, color: string) => void;
  handleOpenCreateTaskDialog: () => void;
}

// Function overloads
export function useTaskManagement(options: {
  includeTaskOperations: true;
}): TaskManagementWithOperations;
export function useTaskManagement(options?: {
  includeTaskOperations?: false;
}): TaskManagementWithoutOperations;
export function useTaskManagement(
  options: UseTaskManagementOptions = {}
): TaskManagementWithOperations | TaskManagementWithoutOperations {
  const { includeTaskOperations = false } = options;

  // Always call useTasks hook (Rules of Hooks requirement)
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    addTask,
    updateTask,
    deleteTask,
    scheduleTask,
  } = useTasks();

  // Task groups state (shared across all components)
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([
    {
      id: 'default',
      name: 'Tasks',
      emoji: '📋',
      color: '#3b82f6',
      description: 'Default task group',
      isDefault: true,
    },
  ]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState('default');
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  const queryClient = useQueryClient();

  const authHeaders = (): Record<string, string> => {
    try {
      const token = useAuthStore.getState().getValidAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  // Consolidated task lists fetch with React Query to dedupe network calls across components
  const taskListsQuery = useQuery({
    queryKey: ['task-lists', { withTaskCount: false }],
    queryFn: async () => {
      const res = await fetch('/api/task-lists', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const isJson = (r: Response) =>
        (r.headers.get('content-type') || '').includes('application/json');
      if (!isJson(res)) return [] as TaskGroup[];
      const body = await res.json();
      if (!res.ok || !body.success) return [] as TaskGroup[];
      const items = Array.isArray(body.data?.data)
        ? body.data.data
        : Array.isArray(body.data)
          ? body.data
          : [];
      const mapped: TaskGroup[] = items.map(
        (item: Record<string, unknown>) => ({
          id: String(item.id),
          name: String(item.name ?? 'Tasks'),
          emoji: String(item.icon ?? '📁'),
          color: String(item.color ?? '#3b82f6'),
          description: String(item.description ?? ''),
        })
      );
      return mapped;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Hydrate local state from shared query to maintain current component behaviors
  useEffect(() => {
    if (taskListsQuery.data && taskListsQuery.data.length > 0) {
      setTaskGroups(taskListsQuery.data);
      setActiveTaskGroupId((prev) =>
        prev === 'default' ? taskListsQuery.data![0].id : prev
      );
    }
  }, [taskListsQuery.data]);

  // Task CRUD handlers (only when includeTaskOperations is true)
  const handleAddTask = includeTaskOperations
    ? (title: string, _groupId?: string, smartData?: SmartTaskData) => {
        // Extract scheduled date from smart data (already provided by parser)
        const scheduledDate = smartData?.scheduledDate;

        // Convert auto-created natural language date/time tags into the canonical due date
        // representation by removing them from the tags array. We will surface the due date via
        // the task's scheduledDate property and a unified editable badge in the UI.
        const nonDateTimeTags = smartData?.tags
          ?.filter((tag) => {
            const type = String(
              (tag as unknown as { type?: string }).type || ''
            ).toLowerCase();
            return type !== 'date' && type !== 'time';
          })
          .map((tag) => ({
            id: tag.id,
            type: tag.type,
            value: tag.value,
            displayText: tag.displayText,
            iconName: tag.iconName,
            color: tag.color,
          }));

        // Normalize special group ids
        const taskListId =
          _groupId && _groupId !== 'default' && _groupId !== 'all'
            ? _groupId
            : undefined;

        addTask.mutate({
          title,
          taskListId,
          priority: smartData?.priority,
          scheduledDate,
          tags: nonDateTimeTags,
          parsedMetadata: smartData
            ? {
                originalInput: smartData.originalInput,
                cleanTitle: smartData.title,
              }
            : undefined,
        });
      }
    : undefined;

  const handleToggleTask = includeTaskOperations
    ? (id: string) => {
        const task = tasks.find((t) => t.id === id);
        if (task) {
          updateTask.mutate({
            id,
            updates: { completed: !task.completed },
          });
        }
      }
    : undefined;

  const handleEditTask = includeTaskOperations
    ? (id: string, title: string) => {
        updateTask.mutate({
          id,
          updates: { title },
        });
      }
    : undefined;

  const handleDeleteTask = includeTaskOperations
    ? (id: string) => {
        deleteTask.mutate(id);
      }
    : undefined;

  const handleScheduleTask = includeTaskOperations
    ? (id: string, scheduledDate: Date) => {
        scheduleTask.mutate({ id, scheduledDate });
      }
    : undefined;

  const handleRemoveTag = includeTaskOperations
    ? (taskId: string, tagId: string) => {
        updateTask.mutate({
          id: taskId,
          updates: {
            tags:
              tasks
                .find((t) => t.id === taskId)
                ?.tags?.filter((tag) => tag.id !== tagId) || [],
          },
        });
      }
    : undefined;

  // Task group handlers (shared across all components)
  const handleAddTaskGroup = (data: Omit<TaskGroup, 'id'>) => {
    // Persist to backend, then update local state
    (async () => {
      try {
        const res = await fetch('/api/task-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            name: data.name,
            color: data.color,
            icon: data.emoji,
            description: data.description,
          }),
        });
        const isJson = (r: Response) =>
          (r.headers.get('content-type') || '').includes('application/json');
        if (!isJson(res)) {
          // Optimistic local-only path already applied by UI add below
        }
        const body = await res.json();
        if (!res.ok || !body.success)
          throw new Error(body.error?.message || 'Failed to create list');
        const created = body.data as {
          id: string;
          name: string;
          color: string;
          description?: string;
        };
        setTaskGroups((prev) =>
          prev.map((g) =>
            g.id.startsWith('group-temp-') && g.name === data.name
              ? {
                  ...g,
                  id: String(created.id),
                  color: created.color,
                  description: created.description,
                }
              : g
          )
        );
        void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      } catch (err) {
        toast.error((err as Error).message || 'Failed to create task list');
        // Rollback optimistic add
        setTaskGroups((prev) =>
          prev.filter(
            (g) => !g.id.startsWith('group-temp-') || g.name !== data.name
          )
        );
      }
    })();
    // Optimistic add
    const tempId = `group-temp-${Date.now()}`;
    const fallback: TaskGroup = {
      id: tempId,
      name: data.name,
      emoji: data.emoji,
      color: data.color,
      description: data.description,
    };
    setTaskGroups((prev) => [...prev, fallback]);
    setActiveTaskGroupId(tempId);
  };

  const handleEditTaskGroup = (
    groupId: string,
    updates: Partial<TaskGroup>
  ) => {
    // Persist to backend, then update local state
    (async () => {
      try {
        const payload: Record<string, unknown> = {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.color ? { color: updates.color } : {}),
          ...(updates.emoji ? { icon: updates.emoji } : {}),
          ...(updates.description ? { description: updates.description } : {}),
        };

        const res = await fetch(
          `/api/task-lists/${encodeURIComponent(groupId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
          }
        );
        // Ignore non-json responses silently in dev
        const isJson = (r: Response) =>
          (r.headers.get('content-type') || '').includes('application/json');
        if (isJson(res)) {
          const body = await res.json();
          if (!res.ok || !body.success)
            throw new Error(
              body.error?.message || 'Failed to update task list'
            );
        }
      } catch (err) {
        toast.error((err as Error).message || 'Failed to update task list');
        // No rollback snapshot in this simplified path; refetch list
        void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
        return;
      }
      // Optimistic apply already done now
      setTaskGroups((prev) =>
        prev.map((group) =>
          group.id === groupId ? { ...group, ...updates } : group
        )
      );
      void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
    })();
  };

  const handleDeleteTaskGroup = (groupId: string) => {
    if (groupId === 'default') return; // Don't delete default group
    const previous = taskGroups;
    setTaskGroups((prev) => prev.filter((group) => group.id !== groupId));
    if (groupId === activeTaskGroupId) {
      setActiveTaskGroupId('default');
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/task-lists/${encodeURIComponent(groupId)}`,
          {
            method: 'DELETE',
            headers: { ...authHeaders() },
          }
        );
        const isJson = (r: Response) =>
          (r.headers.get('content-type') || '').includes('application/json');
        if (isJson(res) && !res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.message || 'Failed to delete task list');
        }
        void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      } catch (err) {
        toast.error((err as Error).message || 'Failed to delete task list');
        // Rollback
        setTaskGroups(previous);
      }
    })();
  };

  const handleSelectTaskGroup = (groupId: string) => {
    setActiveTaskGroupId(groupId);
  };

  const handleCreateTaskGroup = (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => {
    const newTaskGroup: TaskGroup = {
      id: `group-${Date.now()}`,
      name: data.name,
      emoji: data.emoji,
      color: data.color,
      description: data.description,
    };
    setTaskGroups((prev) => [...prev, newTaskGroup]);
    setActiveTaskGroupId(newTaskGroup.id);
    setShowCreateTaskDialog(false);
  };

  const handleUpdateTaskGroupIcon = (groupId: string, emoji: string) => {
    // Optimistic update with rollback
    const previous = taskGroups;
    setTaskGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, emoji } : g))
    );
    (async () => {
      try {
        const res = await fetch(
          `/api/task-lists/${encodeURIComponent(groupId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ icon: emoji }),
          }
        );
        const isJson = (r: Response) =>
          (r.headers.get('content-type') || '').includes('application/json');
        if (isJson(res)) {
          const body = await res.json();
          if (!res.ok || !body.success)
            throw new Error(
              body.error?.message || 'Failed to update task list icon'
            );
        }
        void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      } catch (err) {
        setTaskGroups(previous);
        toast.error(
          (err as Error).message || 'Failed to update task list icon'
        );
      }
    })();
  };

  const handleUpdateTaskGroupColor = (groupId: string, color: string) => {
    // Optimistic update with rollback
    const previous = taskGroups;
    setTaskGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, color } : g))
    );
    (async () => {
      try {
        const res = await fetch(
          `/api/task-lists/${encodeURIComponent(groupId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ color }),
          }
        );
        const isJson = (r: Response) =>
          (r.headers.get('content-type') || '').includes('application/json');
        if (isJson(res)) {
          const body = await res.json();
          if (!res.ok || !body.success)
            throw new Error(
              body.error?.message || 'Failed to update task list color'
            );
        }
        void queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      } catch (err) {
        setTaskGroups(previous);
        toast.error(
          (err as Error).message || 'Failed to update task list color'
        );
      }
    })();
  };

  const handleOpenCreateTaskDialog = () => {
    setShowCreateTaskDialog(true);
  };

  const baseReturn = {
    // Task group state and operations (always included)
    taskGroups,
    activeTaskGroupId,
    setActiveTaskGroupId,
    showCreateTaskDialog,
    setShowCreateTaskDialog,

    // Task group handlers
    handleAddTaskGroup,
    handleEditTaskGroup,
    handleDeleteTaskGroup,
    handleSelectTaskGroup,
    handleCreateTaskGroup,
    handleUpdateTaskGroupIcon,
    handleUpdateTaskGroupColor,
    handleOpenCreateTaskDialog,
  };

  if (includeTaskOperations) {
    return {
      ...baseReturn,
      // Task operations
      tasks,
      tasksLoading,
      addTask,
      handleAddTask: handleAddTask!,
      handleToggleTask: handleToggleTask!,
      handleEditTask: handleEditTask!,
      handleDeleteTask: handleDeleteTask!,
      handleScheduleTask: handleScheduleTask!,
      handleRemoveTag: handleRemoveTag!,
    } as TaskManagementWithOperations;
  }

  return baseReturn as TaskManagementWithoutOperations;
}
