/**
 * TaskList - Modern professional design with React.memo optimization
 */

import React, { useState, useMemo, memo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Settings,
  Edit,
  Trash2,
  CheckSquare,
} from 'lucide-react';
// Emoji-based task group UI
import { TaskItem } from './TaskItem';
import type { Task } from "@shared/types";
import { CursorTooltip } from '@/components/ui/CursorTooltip';
import { groupItemsByDate, getDayKeyOrder } from '@/utils/dateGrouping';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';

import { ColorPicker } from '@/components/ui/color-picker';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { lazy, Suspense } from 'react';
const EmojiPicker = lazy(async () => ({ default: (await import('@/components/ui/emoji-picker')).EmojiPicker }));
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';
import { useUIStore } from '@/stores/uiStore';

// Task groups interface
export interface TaskGroup {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
}

export interface TaskListProps {
  tasks: Task[];
  taskGroups?: TaskGroup[];
  activeTaskGroupId?: string;
  onToggleTask: (id: string) => void;
  onEditTask: (id: string, newTitle: string) => void;
  onDeleteTask: (id: string) => void;
  onScheduleTask?: (id: string) => void;
  onRemoveTag?: (taskId: string, tagId: string) => void;
  onCreateTaskGroup?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  onEditTaskGroup?: (
    id: string,
    updates: { name: string; emoji: string; color: string; description?: string }
  ) => void;
  onSelectTaskGroup?: (groupId: string) => void;
  onUpdateTaskGroupIcon?: (groupId: string, iconId: string) => void;
  onUpdateTaskGroupColor?: (groupId: string, color: string) => void;
  onDeleteTaskGroup?: (groupId: string) => void;
  showCreateTaskDialog?: boolean;
  onShowCreateTaskDialog?: (show: boolean) => void;
  hideHeader?: boolean;
  calendarMode?: boolean; // New prop for calendar view mode
  maxTasks?: number; // New prop to limit tasks shown in calendar mode
  /** Controls whether task list labels should be shown inline with tasks */
  showTaskListLabels?: boolean;
}

const TASK_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

const TaskListComponent: React.FC<TaskListProps> = ({
  tasks,
  taskGroups = [],
  activeTaskGroupId,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onScheduleTask,
  onRemoveTag,
  onCreateTaskGroup,
  onEditTaskGroup,
  onUpdateTaskGroupIcon,
  onUpdateTaskGroupColor,
  onDeleteTaskGroup,
  showCreateTaskDialog = false,
  onShowCreateTaskDialog,
  hideHeader = false,
  calendarMode = false,
  maxTasks = 10,
  showTaskListLabels = false,
}) => {
  // Use global show completed state instead of local state
  const { globalShowCompleted } = useUIStore();
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    emoji: '📋',
    color: '#3b82f6',
    description: 'Default task group',
  };

  // Get current active task group
  const activeTaskGroup =
    taskGroups.find((group) => group.id === activeTaskGroupId) ||
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Filter tasks by active task group and separate active/completed with stable references
  const { activeTasks, completedTasks } = useMemo(() => {
    // Filter tasks by active task group
    const groupTasks = tasks.filter((task) => {
      // Treat 'default' as an alias for "All Tasks" so backend-linked tasks are visible
      if (activeTaskGroupId === 'all' || activeTaskGroupId === 'default') return true;
      return task.taskListId === activeTaskGroupId;
    });

    // Use partition to avoid creating new arrays unnecessarily
    const active = groupTasks.filter((task) => !task.completed);
    const completed = groupTasks.filter((task) => task.completed);

    return { activeTasks: active, completedTasks: completed };
  }, [tasks, activeTaskGroupId]);

  const displayedTasks = useMemo(() => {
    // Return stable reference when possible
    if (!globalShowCompleted) {
      return activeTasks;
    }
    // Only create new array when we actually need to combine them
    return [...activeTasks, ...completedTasks];
  }, [activeTasks, completedTasks, globalShowCompleted]);

  // Calendar mode: Group tasks by date and limit count
  const { groupedTasks, totalTaskCount, groupedAllTotals } = useMemo(() => {
    if (!calendarMode) {
      return { groupedTasks: null, totalTaskCount: 0, groupedAllTotals: {} as Record<string, number> };
    }

    // In calendar mode, filter to only show active tasks (no completed)
    const tasksForCalendar = activeTasks.slice(0, maxTasks);
    const totalCount = activeTasks.length;

    // Group tasks by scheduled date (canonical due date for tasks)
    const grouped = groupItemsByDate(tasksForCalendar, (task) => task.scheduledDate ?? null);

    // Compute totals across all active tasks (not truncated) for accurate badges
    const groupedAll = groupItemsByDate(activeTasks, (task) => task.scheduledDate ?? null);
    const totals = Object.keys(groupedAll).reduce<Record<string, number>>((acc, key) => {
      acc[key] = groupedAll[key].length;
      return acc;
    }, {});

    return { groupedTasks: grouped, totalTaskCount: totalCount, groupedAllTotals: totals };
  }, [calendarMode, activeTasks, maxTasks]);

  // Get the icon component for the active task group
  // Emoji replaces icon component

  const handleCreateTaskGroup = (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => {
    onCreateTaskGroup?.(data);
  };

  const handleUpdateEmoji = (emoji: string) => {
    onUpdateTaskGroupIcon?.(activeTaskGroup.id, emoji);
    setShowIconPicker(false);
  };

  const handleUpdateColor = (color: string) => {
    onUpdateTaskGroupColor?.(activeTaskGroup.id, color);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  const handleDeleteTaskGroup = () => {
    onDeleteTaskGroup?.(activeTaskGroup.id);
    setShowDeleteDialog(false);
  };

  const tooltipContent = (
    <div className="text-xs space-y-1">
      <div className="flex justify-between gap-4">
        <span>Active</span>
        <span className="font-mono font-medium">{activeTasks.length}</span>
      </div>
      {completedTasks.length > 0 && (
        <div className="flex justify-between gap-4">
          <span>Completed</span>
          <span className="font-mono font-medium">{completedTasks.length}</span>
        </div>
      )}
      <div className="flex justify-between gap-4 pt-1 border-t border-border/50">
        <span>Total</span>
        <span className="font-mono font-semibold">
          {activeTasks.length + completedTasks.length}
        </span>
      </div>
    </div>
  );

  const ColorMenuItem = () => (
    <DropdownMenuItem>
      <div
        className="mr-2 h-4 w-4 rounded-full flex-shrink-0 border-2 border-border"
        style={{ backgroundColor: activeTaskGroup.color }}
      />
      <span>Color</span>
      <DropdownMenuShortcut className="flex gap-1 ml-auto">
        {TASK_COLORS.slice(0, 4).map((color) => (
          <button
            key={color}
            onClick={(e) => {
              e.stopPropagation();
              handleUpdateColor(color);
            }}
            className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        ))}
        <ColorPicker
          value={activeTaskGroup.color}
          onChange={handleUpdateColor}
          recentColors={recentColors}
          onRecentColorAdd={handleRecentColorAdd}
          className="w-3 h-3 border-0"
        />
      </DropdownMenuShortcut>
    </DropdownMenuItem>
  );

  // Handle empty state - different for calendar mode
  if (activeTasks.length === 0 && completedTasks.length === 0) {
    if (calendarMode) {
      // Calendar mode empty state - similar to EventOverview
      return (
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-sidebar-foreground" />
            <h3 className="text-sm font-semibold text-sidebar-foreground">
              {activeTaskGroupId === 'all' ? 'All Tasks' : 'Upcoming Tasks'}
            </h3>
          </div>

          <div className="text-center py-4 text-muted-foreground">
            <CheckSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No upcoming tasks</p>
          </div>
        </div>
      );
    }

    // Default mode empty state (existing)
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Emoji Picker for Task Group */}
            <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                  aria-label={`Task group: ${activeTaskGroup.name}`}
                >
                  <span className="text-base">
                    {activeTaskGroup.emoji}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" align="start">
                <Suspense fallback={null}>
                  <EmojiPicker
                    selectedEmoji={activeTaskGroup.emoji}
                    onEmojiSelect={handleUpdateEmoji}
                  />
                </Suspense>
              </PopoverContent>
            </Popover>

            {/* Task Group Name with Tooltip */}
            <CursorTooltip content={tooltipContent} containerClassName="inline-block">
              <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
                {activeTaskGroupId === 'all' ? 'All Tasks' : activeTaskGroup.name}
              </div>
            </CursorTooltip>
          </div>

          <div className="flex items-center gap-2">
            {/* Task Group Management Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ml-auto"
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() =>
                    onEditTaskGroup?.(activeTaskGroup.id, {
                      name: activeTaskGroup.name,
                      emoji: activeTaskGroup.emoji,
                      color: activeTaskGroup.color,
                      description: activeTaskGroup.description,
                    })
                  }
                >
                  <span className="mr-2" style={{ color: activeTaskGroup.color }}>
                    <Settings className="h-4 w-4" />
                  </span>
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    onEditTaskGroup?.(activeTaskGroup.id, {
                      name: activeTaskGroup.name,
                      emoji: activeTaskGroup.emoji,
                      color: activeTaskGroup.color,
                      description: activeTaskGroup.description,
                    })
                  }
                >
                  <span className="mr-2" style={{ color: activeTaskGroup.color }}>
                    <Edit className="h-4 w-4" />
                  </span>
                  <span>Edit</span>
                </DropdownMenuItem>
                <ColorMenuItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">
            Your tasks will appear here <br />
            once you add them
          </p>
        </div>

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={showCreateTaskDialog}
          onOpenChange={(open) => onShowCreateTaskDialog?.(open)}
          onCreateTask={handleCreateTaskGroup}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task List</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{activeTaskGroup.name}"? All
                tasks within this list will be permanently deleted. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTaskGroup}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      <Collapsible open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        {/* Tasks Header with Icon and Tooltip - Hidden when hideHeader is true */}
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Emoji Picker for Task Group */}
              <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                    aria-label={`Task group: ${activeTaskGroup.name}`}
                  >
                    <span className="text-base">
                      {activeTaskGroup.emoji}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-fit p-0" align="start">
                  <Suspense fallback={null}>
                    <EmojiPicker
                      selectedEmoji={activeTaskGroup.emoji}
                      onEmojiSelect={handleUpdateEmoji}
                    />
                  </Suspense>
                </PopoverContent>
              </Popover>

              {/* Task Group Name with Tooltip */}
              <CursorTooltip
                content={tooltipContent}
                containerClassName="inline-block"
              >
                <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
                  {activeTaskGroupId === 'all' ? 'All Tasks' : activeTaskGroup.name}
                </div>
              </CursorTooltip>
            </div>

            <div className="flex items-center gap-1">
              {/* Task Group Management Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ml-auto"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <ColorMenuItem />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                  {isTasksOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        )}

        <CollapsibleContent className="space-y-2">
          {/* Tasks List - Calendar Mode or Default Mode */}
          {calendarMode && groupedTasks ? (
            /* Calendar Mode: Date-grouped display like EventOverview */
            <div className="space-y-4">
              {getDayKeyOrder(Object.keys(groupedTasks)).map((dayKey) => (
                <div key={dayKey} className="space-y-2">
                  {/* Day heading with improved styling */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${dayKey === 'Overdue' ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                      {dayKey}
                    </span>
                    <Badge variant="outline" className="text-xs h-5">
                      {groupedAllTotals[dayKey] ?? groupedTasks[dayKey].length}
                    </Badge>
                  </div>

                  {/* Tasks for this day */}
                  <div className="space-y-1">
                    {groupedTasks[dayKey].map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={onToggleTask}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onSchedule={onScheduleTask}
                        onRemoveTag={onRemoveTag}
                        groupColor={activeTaskGroup.color}
                        calendarMode={true}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Show count if there are more tasks */}
              {totalTaskCount > maxTasks && (
                <div className="text-center pt-3 mt-4 border-t border-sidebar-border/50">
                  <span className="text-xs font-medium text-muted-foreground/80 tracking-wide">
                    +{totalTaskCount - maxTasks} more upcoming tasks
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Default Mode: Standard task list */
            <div className="space-y-1">
              {displayedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggleTask}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onSchedule={onScheduleTask}
                  onRemoveTag={onRemoveTag}
                  groupColor={activeTaskGroup.color}
                  showTaskListLabel={showTaskListLabels}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={(open) => onShowCreateTaskDialog?.(open)}
        onCreateTask={handleCreateTaskGroup}
      />

      {/* Edit Task List Dialog */}
      <CreateTaskDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        initialName={activeTaskGroup.name}
        initialDescription={activeTaskGroup.description || ''}
        initialEmoji={activeTaskGroup.emoji}
        initialColor={activeTaskGroup.color}
        submitLabel="Save Changes"
        titleLabel="Edit Task List"
        onCreateTask={(data) => {
          onEditTaskGroup?.(activeTaskGroup.id, {
            name: data.name,
            emoji: data.emoji,
            color: data.color,
            description: data.description,
          });
          setShowEditDialog(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{activeTaskGroup.name}"? All
              tasks within this list will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTaskGroup}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Custom comparison function to prevent unnecessary re-renders
const TaskListMemoComparison = (
  prevProps: TaskListProps,
  nextProps: TaskListProps
) => {
  // Compare core data arrays by reference and length first (most common changes)
  if (prevProps.tasks !== nextProps.tasks) return false;
  if (prevProps.taskGroups !== nextProps.taskGroups) return false;

  // Compare primitive values
  if (prevProps.activeTaskGroupId !== nextProps.activeTaskGroupId) return false;
  if (prevProps.showCreateTaskDialog !== nextProps.showCreateTaskDialog)
    return false;
  if (prevProps.hideHeader !== nextProps.hideHeader) return false;
  // Props that impact rendering mode and label visibility
  if (prevProps.calendarMode !== nextProps.calendarMode) return false;
  if (prevProps.showTaskListLabels !== nextProps.showTaskListLabels) return false;
  if (prevProps.maxTasks !== nextProps.maxTasks) return false;

  // Function props are assumed to be stable (will be optimized in LeftPane with useCallback)
  // We don't compare function props as they should be memoized by the parent

  return true; // Props are equal, skip re-render
};

// Memoized TaskList component
export const TaskList = memo(TaskListComponent, TaskListMemoComparison);

export default TaskList;
