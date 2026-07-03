/**
 * TaskList - Modern professional design with React.memo optimization
 */

import { COLOR_PRESETS, DEFAULT_PRESET_COLOR } from '@/constants/colors';
import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
} from 'lucide-react';
// Emoji-based task group UI
import { TaskItem } from './TaskItem';
import { UpcomingEmptyState } from './UpcomingTasksEmpty';
import type { Task } from '@shared/types';
import { CursorTooltip } from '@/components/ui/CursorTooltip';
import { groupItemsByDate, getDayKeyOrder } from '@/utils/dateGrouping';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { ColorPicker } from '@/components/ui/color-picker';
import '@/styles/new-folder.css';
import './task-item.css';
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
const EmojiPicker = lazy(async () => ({
  default: (await import('@/components/ui/emoji-picker')).EmojiPicker,
}));
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
    updates: {
      name: string;
      emoji: string;
      color: string;
      description?: string;
    }
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

// Curated swatch palette shared app-wide (design-brief §2.4)
const TASK_COLORS = [...COLOR_PRESETS];

interface TaskGroupHeaderProps {
  activeTaskGroup: TaskGroup;
  displayName: string;
  tooltipContent: React.ReactNode;
  showIconPicker: boolean;
  onShowIconPickerChange: (open: boolean) => void;
  onUpdateEmoji: (emoji: string) => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  colorMenuItem: React.ReactNode;
  /** Omit for the empty-state branch (nothing to collapse); pass the
   *  Collapsible's open state in the populated branch for a real toggle. */
  collapsibleOpen?: boolean;
}

/**
 * Shared task-group identity header: icon picker, name + tooltip,
 * management menu (Edit / Color / Delete), collapse control. One
 * implementation for both the empty-state and populated branches so they
 * can't drift into two different menus again — the previous per-branch
 * copies had a dead "Settings" item in one and a Settings/Edit handler
 * collision in the other; this keeps a single working "Edit" entry.
 */
const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({
  activeTaskGroup,
  displayName,
  tooltipContent,
  showIconPicker,
  onShowIconPickerChange,
  onUpdateEmoji,
  onEditClick,
  onDeleteClick,
  colorMenuItem,
  collapsibleOpen,
}) => (
  <div className="flex items-center justify-between pb-2 border-b border-hairline">
    <div className="flex items-center gap-2">
      {/* Emoji Picker for Task Group */}
      <Popover open={showIconPicker} onOpenChange={onShowIconPickerChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-surface-hover rounded-btn"
            aria-label={`Task group: ${activeTaskGroup.name}`}
          >
            <span className="text-base">{activeTaskGroup.emoji}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-fit p-0" align="start">
          <Suspense fallback={null}>
            <EmojiPicker
              selectedEmoji={activeTaskGroup.emoji}
              onEmojiSelect={onUpdateEmoji}
            />
          </Suspense>
        </PopoverContent>
      </Popover>

      {/* Task Group Name with Tooltip */}
      <CursorTooltip content={tooltipContent} containerClassName="inline-block">
        <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
          {displayName}
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
            className="h-6 w-6 p-0 hover:bg-surface-hover ml-auto"
          >
            <MoreVertical className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={onEditClick}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit</span>
          </DropdownMenuItem>
          {colorMenuItem}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDeleteClick}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {collapsibleOpen === undefined ? (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled>
          <ChevronDown className="w-3 h-3" />
        </Button>
      ) : (
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-surface-hover"
          >
            {collapsibleOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        </CollapsibleTrigger>
      )}
    </div>
  </div>
);

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
    color: DEFAULT_PRESET_COLOR,
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
      if (activeTaskGroupId === 'all' || activeTaskGroupId === 'default')
        return true;
      return task.taskListId === activeTaskGroupId;
    });

    // Use partition to avoid creating new arrays unnecessarily
    const active = groupTasks.filter((task) => !task.completed);
    const completed = groupTasks.filter((task) => task.completed);

    return { activeTasks: active, completedTasks: completed };
  }, [tasks, activeTaskGroupId]);

  // "List cleared" celebration (§1.6 rule 5, the one reserved loud-aqua
  // moment; director-approved, non-blocking): detect the exact
  // 1-active-task->0 transition within the SAME task group (not just "list
  // is empty", which would also fire on switching into an already-empty
  // list). Read against the previous render's committed values, updated
  // only after commit, so this never triggers a state-during-render loop.
  const prevActiveRef = useRef({
    groupId: activeTaskGroupId,
    count: activeTasks.length,
  });
  const justClearedLastActive =
    prevActiveRef.current.groupId === activeTaskGroupId &&
    prevActiveRef.current.count === 1 &&
    activeTasks.length === 0;
  useEffect(() => {
    prevActiveRef.current = {
      groupId: activeTaskGroupId,
      count: activeTasks.length,
    };
  }, [activeTaskGroupId, activeTasks.length]);

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
      return {
        groupedTasks: null,
        totalTaskCount: 0,
        groupedAllTotals: {} as Record<string, number>,
      };
    }

    // In calendar mode, filter to only show active tasks (no completed)
    const tasksForCalendar = activeTasks.slice(0, maxTasks);
    const totalCount = activeTasks.length;

    // Group tasks by scheduled date (canonical due date for tasks)
    const grouped = groupItemsByDate(
      tasksForCalendar,
      (task) => task.scheduledDate ?? null
    );

    // Compute totals across all active tasks (not truncated) for accurate badges
    const groupedAll = groupItemsByDate(
      activeTasks,
      (task) => task.scheduledDate ?? null
    );
    const totals = Object.keys(groupedAll).reduce<Record<string, number>>(
      (acc, key) => {
        acc[key] = groupedAll[key].length;
        return acc;
      },
      {}
    );

    return {
      groupedTasks: grouped,
      totalTaskCount: totalCount,
      groupedAllTotals: totals,
    };
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
        <span className="font-mono font-medium tabular-nums">
          {activeTasks.length}
        </span>
      </div>
      {completedTasks.length > 0 && (
        <div className="flex justify-between gap-4">
          <span>Completed</span>
          <span className="font-mono font-medium tabular-nums">
            {completedTasks.length}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-4 pt-1 border-t border-hairline">
        <span>Total</span>
        <span className="font-mono font-semibold tabular-nums">
          {activeTasks.length + completedTasks.length}
        </span>
      </div>
    </div>
  );

  const ColorMenuItem = () => (
    <DropdownMenuItem>
      <div
        className="mr-2 h-3.5 w-3.5 rounded-full flex-shrink-0 border-[1.5px] border-border"
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
            className="w-3.5 h-3.5 rounded-full border-[1.5px] border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        ))}
        <ColorPicker
          value={activeTaskGroup.color}
          onChange={handleUpdateColor}
          recentColors={recentColors}
          onRecentColorAdd={handleRecentColorAdd}
          className="w-3.5 h-3.5 border-0"
        />
      </DropdownMenuShortcut>
    </DropdownMenuItem>
  );

  // Handle empty state - different for calendar mode
  if (activeTasks.length === 0 && completedTasks.length === 0) {
    if (calendarMode) {
      // Calendar mode empty state - the §4.7 schedule etch, shared with the
      // upcoming events list so tasks and events read as one system.
      return (
        <div
          className={cn(
            'mt-4',
            justClearedLastActive && 'ti-cleared-celebrate'
          )}
        >
          <UpcomingEmptyState
            voice="You're all caught up."
            note="Upcoming tasks appear here as their dates approach."
          />
        </div>
      );
    }

    // Default mode empty state (existing)
    return (
      <div className="space-y-3 mt-4">
        <TaskGroupHeader
          activeTaskGroup={activeTaskGroup}
          displayName={
            activeTaskGroupId === 'all' ? 'All Tasks' : activeTaskGroup.name
          }
          tooltipContent={tooltipContent}
          showIconPicker={showIconPicker}
          onShowIconPickerChange={setShowIconPicker}
          onUpdateEmoji={handleUpdateEmoji}
          onEditClick={() => setShowEditDialog(true)}
          onDeleteClick={() => setShowDeleteDialog(true)}
          colorMenuItem={<ColorMenuItem />}
        />

        {/* Etched placeholder (§4.7) — a "never had tasks" state, not a
            "cleared" one, so it stays neutral: no aqua badge (that's
            reserved for the caught-up case above). Three ghost rows echo
            .ti-ring + .ti-title's own silhouette. */}
        <div className="ti-empty">
          <div className="ti-empty-ghost">
            {[0.9, 0.7, 0.5].map((w) => (
              <div className="ti-empty-ghost-row" key={w}>
                <span className="ti-empty-ghost-ring" />
                <span
                  className="ti-empty-ghost-line"
                  style={{ maxWidth: `${w * 100}%` }}
                />
              </div>
            ))}
          </div>
          <p className="folder-empty-voice">Nothing on the list yet.</p>
          <p className="folder-empty-action">
            Add a task above to get started.
          </p>
        </div>

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
          submitLabel="Save changes"
          titleLabel="Edit list"
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
  }

  return (
    <div className="space-y-3 mt-4">
      <Collapsible open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        {/* Tasks Header with Icon and Tooltip - Hidden when hideHeader is true */}
        {!hideHeader && (
          <TaskGroupHeader
            activeTaskGroup={activeTaskGroup}
            displayName={
              activeTaskGroupId === 'all' ? 'All Tasks' : activeTaskGroup.name
            }
            tooltipContent={tooltipContent}
            showIconPicker={showIconPicker}
            onShowIconPickerChange={setShowIconPicker}
            onUpdateEmoji={handleUpdateEmoji}
            onEditClick={() => setShowEditDialog(true)}
            onDeleteClick={() => setShowDeleteDialog(true)}
            colorMenuItem={<ColorMenuItem />}
            collapsibleOpen={isTasksOpen}
          />
        )}

        <CollapsibleContent
          className={cn(
            'pt-2',
            'data-[state=open]:animate-[settle-fade-in_var(--dur-3)_var(--ease-settle)]',
            'data-[state=closed]:animate-[settle-fade-out_var(--dur-2)_var(--ease-out)]'
          )}
        >
          {/* Tasks List - Calendar Mode or Default Mode */}
          {calendarMode && groupedTasks ? (
            /* Calendar Mode: Date-grouped display like EventOverview */
            <div className="space-y-4">
              {getDayKeyOrder(Object.keys(groupedTasks)).map((dayKey) => (
                <div key={dayKey} className="space-y-2">
                  {/* Day heading — micro role (§2.1): 12px/500/+0.04em uppercase */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs font-medium uppercase tracking-[0.04em] ${
                        dayKey === 'Overdue'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {dayKey}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs h-5 tabular-nums"
                    >
                      {groupedAllTotals[dayKey] ?? groupedTasks[dayKey].length}
                    </Badge>
                  </div>

                  {/* Tasks for this day */}
                  <div>
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
                <div className="text-center pt-3 mt-4 border-t border-hairline">
                  <span className="text-xs font-medium text-ink-muted tracking-wide tabular-nums">
                    +{totalTaskCount - maxTasks} more upcoming tasks
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Default Mode: Standard task list */
            <div>
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
        submitLabel="Save changes"
        titleLabel="Edit list"
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
  if (prevProps.showTaskListLabels !== nextProps.showTaskListLabels)
    return false;
  if (prevProps.maxTasks !== nextProps.maxTasks) return false;

  // Function props are assumed to be stable (will be optimized in LeftPane with useCallback)
  // We don't compare function props as they should be memoized by the parent

  return true; // Props are equal, skip re-render
};

// Memoized TaskList component
export const TaskList = memo(TaskListComponent, TaskListMemoComparison);

export default TaskList;
