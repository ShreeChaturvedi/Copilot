import { useState } from 'react';
import { useTasks } from './useTasks';
import { SmartTaskData } from '@/components/smart-input/SmartTaskInput';
import { Task, TaskTag } from '@shared/types';
import { UseMutationResult } from '@tanstack/react-query';

interface CreateTaskData {
  title: string;
  groupId?: string;
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
  iconId: string;
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
    iconId: string;
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
    iconId: string;
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
      iconId: 'CheckSquare',
      color: '#3b82f6',
      description: 'Default task group',
      isDefault: true,
    },
  ]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState('default');
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  // Task CRUD handlers (only when includeTaskOperations is true)
  const handleAddTask = includeTaskOperations
    ? (title: string, _groupId?: string, smartData?: SmartTaskData) => {
        addTask.mutate({
          title,
          priority: smartData?.priority,
          scheduledDate: smartData?.scheduledDate,
          tags: smartData?.tags?.map((tag) => ({
            id: tag.id,
            type: tag.type,
            value: tag.value,
            displayText: tag.displayText,
            iconName: tag.iconName,
            color: tag.color,
          })),
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
    const newTaskGroup: TaskGroup = {
      id: `group-${Date.now()}`,
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description,
    };
    setTaskGroups((prev) => [...prev, newTaskGroup]);
    setActiveTaskGroupId(newTaskGroup.id);
  };

  const handleEditTaskGroup = (
    groupId: string,
    updates: Partial<TaskGroup>
  ) => {
    setTaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
  };

  const handleDeleteTaskGroup = (groupId: string) => {
    if (groupId === 'default') return; // Don't delete default group
    setTaskGroups((prev) => prev.filter((group) => group.id !== groupId));
    if (groupId === activeTaskGroupId) {
      setActiveTaskGroupId('default');
    }
  };

  const handleSelectTaskGroup = (groupId: string) => {
    setActiveTaskGroupId(groupId);
  };

  const handleCreateTaskGroup = (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => {
    const newTaskGroup: TaskGroup = {
      id: `group-${Date.now()}`,
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description,
    };
    setTaskGroups((prev) => [...prev, newTaskGroup]);
    setActiveTaskGroupId(newTaskGroup.id);
    setShowCreateTaskDialog(false);
  };

  const handleUpdateTaskGroupIcon = (groupId: string, iconId: string) => {
    setTaskGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, iconId } : group))
    );
  };

  const handleUpdateTaskGroupColor = (groupId: string, color: string) => {
    setTaskGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, color } : group))
    );
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
