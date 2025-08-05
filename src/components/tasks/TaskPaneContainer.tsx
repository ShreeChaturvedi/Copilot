/**
 * TaskPaneContainer - Multi-pane resizable task display
 */

import React, { useMemo, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/Select';
import { TaskList } from './TaskList';
import { cn } from '@/lib/utils';
import { Task, TaskPaneData } from '@/types';
import { useUIStore, TaskPaneConfig, TaskGrouping } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';

export interface TaskPaneContainerProps {
  className?: string;
}

/**
 * Generate filtered tasks for a specific pane configuration
 */
function filterTasksForPane(
  tasks: Task[],
  paneConfig: TaskPaneConfig,
  taskGroups: Array<{ id: string; name: string }>,
  sortBy: string,
  sortOrder: string
): Task[] {
  let filteredTasks = [...tasks];

  // Apply grouping filter
  switch (paneConfig.grouping) {
    case 'taskList': {
      if (paneConfig.filterValue) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.groupId === paneConfig.filterValue ||
            (!task.groupId && paneConfig.filterValue === 'default')
        );
      }
      break;
    }
    case 'dueDate': {
      // Filter by due date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const thisWeekEnd = new Date(today);
      thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));
      const nextWeekEnd = new Date(thisWeekEnd);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

      if (paneConfig.filterValue) {
        filteredTasks = filteredTasks.filter((task) => {
          if (!task.scheduledDate) return paneConfig.filterValue === 'no-date';

          const taskDate = new Date(task.scheduledDate);
          switch (paneConfig.filterValue) {
            case 'today':
              return taskDate >= today && taskDate < tomorrow;
            case 'tomorrow':
              return (
                taskDate >= tomorrow &&
                taskDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
              );
            case 'this-week':
              return taskDate >= today && taskDate <= thisWeekEnd;
            case 'next-week':
              return taskDate > thisWeekEnd && taskDate <= nextWeekEnd;
            case 'later':
              return taskDate > nextWeekEnd;
            default:
              return true;
          }
        });
      }
      break;
    }
    case 'priority': {
      if (paneConfig.filterValue) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.priority === paneConfig.filterValue ||
            (!task.priority && paneConfig.filterValue === 'none')
        );
      }
      break;
    }
  }

  // Apply completion filter
  if (!paneConfig.showCompleted) {
    filteredTasks = filteredTasks.filter((task) => !task.completed);
  }

  // Apply sorting
  filteredTasks.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'title': {
        comparison = a.title.localeCompare(b.title);
        break;
      }
      case 'dueDate': {
        const aDate = a.scheduledDate?.getTime() || 0;
        const bDate = b.scheduledDate?.getTime() || 0;
        comparison = aDate - bDate;
        break;
      }
      case 'priority': {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority =
          priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        const bPriority =
          priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        comparison = bPriority - aPriority; // High to low
        break;
      }
      case 'createdAt':
      default: {
        comparison = b.createdAt.getTime() - a.createdAt.getTime(); // Newest first
        break;
      }
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filteredTasks;
}

/**
 * Generate pane title based on grouping and filter
 */
function getPaneTitle(
  grouping: TaskGrouping,
  filterValue: string | undefined,
  taskGroups: Array<{ id: string; name: string }>
): string {
  switch (grouping) {
    case 'taskList':
      if (filterValue) {
        const group = taskGroups.find((g) => g.id === filterValue);
        return group?.name || 'Tasks';
      }
      return 'All Tasks';
    case 'dueDate':
      switch (filterValue) {
        case 'today':
          return 'Due Today';
        case 'tomorrow':
          return 'Due Tomorrow';
        case 'this-week':
          return 'Due This Week';
        case 'next-week':
          return 'Due Next Week';
        case 'later':
          return 'Due Later';
        case 'no-date':
          return 'No Due Date';
        default:
          return 'All Due Dates';
      }
    case 'priority':
      switch (filterValue) {
        case 'high':
          return 'High Priority';
        case 'medium':
          return 'Medium Priority';
        case 'low':
          return 'Low Priority';
        case 'none':
          return 'No Priority';
        default:
          return 'All Priorities';
      }
    default:
      return 'Tasks';
  }
}

/**
 * Individual task pane component
 */
interface TaskPaneProps {
  paneConfig: TaskPaneConfig;
  paneData: TaskPaneData;
  canRemove: boolean;
  onRemove: (paneId: string) => void;
  onUpdateGrouping: (paneId: string, grouping: TaskGrouping) => void;
  onUpdateFilter: (paneId: string, filterValue: string) => void;
}

const TaskPane: React.FC<TaskPaneProps> = ({
  paneConfig,
  paneData,
  canRemove,
  onRemove,
  onUpdateGrouping,
  onUpdateFilter,
}) => {
  // Get task management operations
  const taskManagement = useTaskManagement({ includeTaskOperations: true });

  const handleGroupingChange = (value: string) => {
    onUpdateGrouping(paneConfig.id, value as TaskGrouping);
  };

  const handleFilterChange = (value: string) => {
    onUpdateFilter(paneConfig.id, value);
  };

  // Generate filter options based on grouping
  const filterOptions = useMemo(() => {
    switch (paneConfig.grouping) {
      case 'taskList':
        return [
          { value: '', label: 'All Task Lists' },
          ...taskManagement.taskGroups.map((group) => ({
            value: group.id,
            label: group.name,
          })),
        ];
      case 'dueDate':
        return [
          { value: '', label: 'All Due Dates' },
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
          { value: 'this-week', label: 'This Week' },
          { value: 'next-week', label: 'Next Week' },
          { value: 'later', label: 'Later' },
          { value: 'no-date', label: 'No Due Date' },
        ];
      case 'priority':
        return [
          { value: '', label: 'All Priorities' },
          { value: 'high', label: 'High Priority' },
          { value: 'medium', label: 'Medium Priority' },
          { value: 'low', label: 'Low Priority' },
          { value: 'none', label: 'No Priority' },
        ];
      default:
        return [];
    }
  }, [paneConfig.grouping, taskManagement.taskGroups]);

  return (
    <div className="h-full flex flex-col">
      {/* Pane Header */}
      <div className="border-b border-border p-4 bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{paneData.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {paneData.tasks.length}
            </Badge>
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onRemove(paneConfig.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Grouping and Filter Controls */}
        <div className="space-y-2">
          {/* Grouping Selector */}
          <Select
            value={paneConfig.grouping}
            onChange={(e) => handleGroupingChange(e.target.value)}
            className="h-8 text-xs"
            options={[
              { value: 'taskList', label: 'By Task List' },
              { value: 'dueDate', label: 'By Due Date' },
              { value: 'priority', label: 'By Priority' },
            ]}
          />

          {/* Filter Selector */}
          <Select
            value={paneConfig.filterValue || ''}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="h-8 text-xs"
            placeholder="Filter..."
            options={filterOptions}
          />
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-auto">
        {paneData.isEmpty ? (
          <div className="flex items-center justify-center h-32 text-center">
            <div className="text-sm text-muted-foreground">
              No tasks match the current filters
            </div>
          </div>
        ) : (
          <TaskList
            tasks={paneData.tasks}
            taskGroups={taskManagement.taskGroups}
            activeTaskGroupId={taskManagement.activeTaskGroupId}
            onToggleTask={taskManagement.handleToggleTask}
            onEditTask={taskManagement.handleEditTask}
            onDeleteTask={taskManagement.handleDeleteTask}
            onScheduleTask={taskManagement.handleScheduleTask}
            onRemoveTag={taskManagement.handleRemoveTag}
            onCreateTaskGroup={taskManagement.handleCreateTaskGroup}
            onSelectTaskGroup={taskManagement.handleSelectTaskGroup}
            onUpdateTaskGroupIcon={taskManagement.handleUpdateTaskGroupIcon}
            onUpdateTaskGroupColor={taskManagement.handleUpdateTaskGroupColor}
            onDeleteTaskGroup={taskManagement.handleDeleteTaskGroup}
            showCreateTaskDialog={taskManagement.showCreateTaskDialog}
            onShowCreateTaskDialog={taskManagement.setShowCreateTaskDialog}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Main TaskPaneContainer component
 */
export const TaskPaneContainer: React.FC<TaskPaneContainerProps> = ({
  className,
}) => {
  const {
    taskPanes,
    maxTaskPanes,
    sortBy,
    sortOrder,
    addTaskPane,
    removeTaskPane,
    updateTaskPane,
  } = useUIStore();

  const taskManagement = useTaskManagement({ includeTaskOperations: true });

  // Generate pane data
  const paneData = useMemo(() => {
    return taskPanes.map((pane) => {
      const filteredTasks = filterTasksForPane(
        taskManagement.tasks,
        pane,
        taskManagement.taskGroups,
        sortBy,
        sortOrder
      );

      return {
        id: pane.id,
        title: getPaneTitle(
          pane.grouping,
          pane.filterValue,
          taskManagement.taskGroups
        ),
        tasks: filteredTasks,
        grouping: pane.grouping,
        filterValue: pane.filterValue,
        isEmpty: filteredTasks.length === 0,
        showCompleted: pane.showCompleted,
      } as TaskPaneData;
    });
  }, [
    taskPanes,
    taskManagement.tasks,
    taskManagement.taskGroups,
    sortBy,
    sortOrder,
  ]);

  // Handle pane management
  const handleAddPane = useCallback(() => {
    if (taskPanes.length < maxTaskPanes) {
      addTaskPane();
    }
  }, [taskPanes.length, maxTaskPanes, addTaskPane]);

  const handleRemovePane = useCallback(
    (paneId: string) => {
      removeTaskPane(paneId);
    },
    [removeTaskPane]
  );

  const handleUpdateGrouping = useCallback(
    (paneId: string, grouping: TaskGrouping) => {
      updateTaskPane(paneId, { grouping, filterValue: undefined }); // Reset filter when changing grouping
    },
    [updateTaskPane]
  );

  const handleUpdateFilter = useCallback(
    (paneId: string, filterValue: string) => {
      updateTaskPane(paneId, { filterValue: filterValue || undefined });
    },
    [updateTaskPane]
  );

  const canAddPane = taskPanes.length < maxTaskPanes;
  const canRemovePane = taskPanes.length > 1;

  return (
    <div className={cn('h-full relative', className)}>
      {/* Add Pane Button - Fixed position on left */}
      {canAddPane && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 z-10',
            'h-12 w-8 p-0 rounded-full',
            'bg-background/80 backdrop-blur-sm hover:bg-background',
            'border-border shadow-md'
          )}
          onClick={handleAddPane}
        >
          <Plus className="w-4 h-4" />
        </Button>
      )}

      {/* Resizable Panes */}
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {paneData.map((pane, index) => (
          <React.Fragment key={pane.id}>
            <ResizablePanel
              defaultSize={100 / paneData.length}
              minSize={25}
              className="min-w-0"
            >
              <TaskPane
                paneConfig={taskPanes[index]}
                paneData={pane}
                canRemove={canRemovePane}
                onRemove={handleRemovePane}
                onUpdateGrouping={handleUpdateGrouping}
                onUpdateFilter={handleUpdateFilter}
              />
            </ResizablePanel>

            {/* Resize Handle - Only between panes */}
            {index < paneData.length - 1 && (
              <ResizableHandle withHandle className="w-2" />
            )}
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
};

export default TaskPaneContainer;
