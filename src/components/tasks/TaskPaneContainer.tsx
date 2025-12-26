/**
 * TaskPaneContainer - Multi-pane resizable task display
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TaskGroupCombobox } from '@/components/smart-input/components/TaskGroupCombobox';
import { TaskList } from './TaskList';
import { cn } from '@/lib/utils';
import { Task, TaskPaneData } from "@shared/types";
import { useUIStore, TaskPaneConfig, TaskGrouping } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';

export interface TaskPaneContainerProps {
  className?: string;
  searchValue?: string;
}

/**
 * Generate filtered tasks for a specific pane configuration
 */
function filterTasksForPane(
  tasks: Task[],
  paneConfig: TaskPaneConfig,
  // taskGroups: Array<{ id: string; name: string }>,
  sortBy: string,
  sortOrder: string,
  searchValue?: string
): Task[] {
  let filteredTasks = [...tasks];

  // Apply grouping filter
  switch (paneConfig.grouping) {
    case 'taskList': {
      // Use selectedTaskListId if available, otherwise fall back to filterValue
      const targetTaskListId =
        paneConfig.selectedTaskListId || paneConfig.filterValue;
      if (targetTaskListId) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.taskListId === targetTaskListId ||
            (!task.taskListId && targetTaskListId === 'default')
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

  // Apply search filter
  if (searchValue && searchValue.trim()) {
    const searchTerm = searchValue.toLowerCase().trim();
    filteredTasks = filteredTasks.filter((task) =>
      task.title.toLowerCase().includes(searchTerm)
    );
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
  selectedTaskListId: string | null,
  taskGroups: Array<{ id: string; name: string }>
): string {
  switch (grouping) {
    case 'taskList': {
      const targetTaskListId = selectedTaskListId || filterValue;
      if (targetTaskListId) {
        const group = taskGroups.find((g) => g.id === targetTaskListId);
        return group?.name || 'Tasks';
      }
      return 'All Tasks';
    }
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
  taskGroups: Array<{ id: string; name: string; emoji: string; color: string; description?: string }>;
  onUpdateTaskList: (paneId: string, taskListId: string | null) => void;
}

const TaskPane: React.FC<TaskPaneProps> = ({
  paneConfig,
  paneData,
  canRemove,
  onRemove,
  taskGroups,
  onUpdateTaskList,
}) => {
  // Get task management operations and UI state
  const taskManagement = useTaskManagement({ includeTaskOperations: true });
  const { showTaskListContextInAll, setShowTaskListContextInAll } = useUIStore();

  return (
    <div className="h-full flex flex-col">
      {/* Clean Pane Header */}
      <div className="border-b border-border px-4 py-2 bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Task list selector for taskList grouping, plain title for others */}
            {paneConfig.grouping === 'taskList' ? (
              <TaskGroupCombobox
                taskGroups={taskGroups}
                activeTaskGroupId={paneConfig.selectedTaskListId || 'all'}
                onSelectTaskGroup={(groupId) =>
                  onUpdateTaskList(
                    paneConfig.id,
                    groupId === 'all' ? null : groupId
                  )
                }
                className="h-auto p-0"
              />
            ) : (
              <h3 className="font-medium text-sm truncate text-muted-foreground">
                {paneData.title}
              </h3>
            )}
            <Badge variant="outline" className="text-xs h-5">
              {paneData.tasks.length}
            </Badge>

            {/* Eye toggle - only show when "All Tasks" is selected (not a specific task list) */}
            {paneConfig.selectedTaskListId === null && paneConfig.grouping === 'taskList' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTaskListContextInAll(!showTaskListContextInAll)}
                    className={cn(
                      'h-6 w-6 p-0 ml-1',
                      showTaskListContextInAll
                        ? 'bg-muted text-foreground border border-border'
                        : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50'
                    )}
                    aria-label={`${showTaskListContextInAll ? 'Hide' : 'Show'} list context`}
                  >
                    {showTaskListContextInAll ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showTaskListContextInAll ? 'Hide' : 'Show'} list context</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              onClick={() => onRemove(paneConfig.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-auto px-4">
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
            activeTaskGroupId={'all'}
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
            hideHeader={true}
            showTaskListLabels={paneConfig.selectedTaskListId === null && showTaskListContextInAll}
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
  searchValue,
}) => {
  const { taskPanes, sortBy, sortOrder, removeTaskPane, updateTaskPane, addTaskPane } =
    useUIStore();
  const { taskPaneSetup, setTaskPaneSetup } = useSettingsStore();

  // Robust hydration loop: keep adjusting until UI matches saved config
  const hydrationDoneRef = useRef(false);
  useEffect(() => {
    if (hydrationDoneRef.current) return;
    if (!Array.isArray(taskPaneSetup) || taskPaneSetup.length === 0) {
      hydrationDoneRef.current = true;
      return;
    }
    const currentCount = taskPanes.length;
    const savedCount = taskPaneSetup.length;
    if (savedCount !== currentCount) {
      if (savedCount > currentCount) {
        // Add panes until counts match
        const nextIndex = currentCount;
        const saved = taskPaneSetup[nextIndex];
        addTaskPane({
          grouping: saved.grouping as TaskGrouping,
          filterValue: saved.filterValue,
          selectedTaskListId: saved.selectedTaskListId,
          showCompleted: saved.showCompleted,
        });
      } else {
        // Remove extra panes from end
        const paneId = taskPanes[currentCount - 1]?.id;
        if (paneId) removeTaskPane(paneId);
      }
      return; // wait for next render to continue
    }
    // Counts match: apply configs
    let needsAnotherPass = false;
    for (let i = 0; i < savedCount; i++) {
      const pane = taskPanes[i];
      const saved = taskPaneSetup[i];
      if (
        pane && (
          pane.grouping !== saved.grouping ||
          pane.selectedTaskListId !== saved.selectedTaskListId ||
          pane.showCompleted !== saved.showCompleted ||
          pane.filterValue !== saved.filterValue
        )
      ) {
        needsAnotherPass = true;
        updateTaskPane(pane.id, {
          grouping: saved.grouping as TaskGrouping,
          selectedTaskListId: saved.selectedTaskListId,
          showCompleted: saved.showCompleted,
          filterValue: saved.filterValue,
        });
      }
    }
    if (!needsAnotherPass) {
      hydrationDoneRef.current = true;
    }
  }, [taskPaneSetup, taskPanes, addTaskPane, removeTaskPane, updateTaskPane]);

  const taskManagement = useTaskManagement({ includeTaskOperations: true });

  // Generate pane data
  const paneData = useMemo(() => {
    return taskPanes.map((pane) => {
      const filteredTasks = filterTasksForPane(
        taskManagement.tasks,
        pane,
        // Note: filterTasksForPane signature does not accept taskGroups; they are used in title only
        sortBy,
        sortOrder,
        searchValue
      );

      return {
        id: pane.id,
        title: getPaneTitle(
          pane.grouping,
          pane.filterValue,
          pane.selectedTaskListId,
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
    searchValue,
  ]);

  // Handle pane management

  const handleRemovePane = useCallback(
    (paneId: string) => {
      removeTaskPane(paneId);
    },
    [removeTaskPane]
  );

  const handleUpdateTaskList = useCallback(
    (paneId: string, taskListId: string | null) => {
      updateTaskPane(paneId, { selectedTaskListId: taskListId });
    },
    [updateTaskPane]
  );

  const canRemovePane = taskPanes.length > 1;

  // Persist pane configurations when taskPanes change
  useEffect(() => {
    if (!hydrationDoneRef.current) return;
    const saved = taskPanes.map((p) => ({
      id: p.id,
      grouping: p.grouping as 'taskList' | 'dueDate' | 'priority',
      filterValue: p.filterValue,
      selectedTaskListId: p.selectedTaskListId ?? null,
      showCompleted: p.showCompleted,
    }));
    setTaskPaneSetup(saved);
  }, [taskPanes, setTaskPaneSetup]);

  // Sizes are intentionally not persisted per user instruction; default evenly

  return (
    <div className={cn('h-full', className)}>
      {/* Resizable Panes */}
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full"
      >
        {paneData.map((pane, index) => (
          <React.Fragment key={pane.id}>
            <ResizablePanel
              id={pane.id}
              order={index}
              defaultSize={(100 / paneData.length)}
              minSize={25}
              className="min-w-0"
            >
              <TaskPane
                paneConfig={taskPanes[index]}
                paneData={pane}
                canRemove={canRemovePane}
                onRemove={handleRemovePane}
                taskGroups={taskManagement.taskGroups}
                onUpdateTaskList={handleUpdateTaskList}
              />
            </ResizablePanel>

            {/* Resize Handle - Only between panes */}
            {index < paneData.length - 1 && (
              <ResizableHandle className="w-1 bg-border hover:bg-border-hover transition-colors" />
            )}
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
};

export default TaskPaneContainer;
