/**
 * TaskList - Modern professional design
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, Settings, Edit, Trash2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { Task } from '@/types';
import { CursorTooltip } from '@/components/ui/CursorTooltip';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { IconPicker } from '@/components/ui/icon-picker';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';

// Task groups interface
export interface TaskGroup {
  id: string;
  name: string;
  iconId: string;
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
  onCreateTaskGroup?: (data: { name: string; description: string; iconId: string; color: string }) => void;
  onSelectTaskGroup?: (groupId: string) => void;
  onUpdateTaskGroupIcon?: (groupId: string, iconId: string) => void;
  onUpdateTaskGroupColor?: (groupId: string, color: string) => void;
  onDeleteTaskGroup?: (groupId: string) => void;
  showCreateTaskDialog?: boolean;
  onShowCreateTaskDialog?: (show: boolean) => void;
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

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  taskGroups = [],
  activeTaskGroupId,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onScheduleTask,
  onRemoveTag,
  onCreateTaskGroup,
  onUpdateTaskGroupIcon,
  onUpdateTaskGroupColor,
  onDeleteTaskGroup,
  showCreateTaskDialog = false,
  onShowCreateTaskDialog
}) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    iconId: 'CheckSquare',
    color: '#3b82f6',
    description: 'Default task group'
  };

  // Get current active task group
  const activeTaskGroup = taskGroups.find(group => group.id === activeTaskGroupId) ||
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Filter tasks by active task group and separate active/completed with stable references
  const { activeTasks, completedTasks } = useMemo(() => {
    // Filter tasks by active task group
    const groupTasks = tasks.filter(task =>
      task.groupId === activeTaskGroupId ||
      (!task.groupId && activeTaskGroupId === 'default')
    );

    // Use partition to avoid creating new arrays unnecessarily
    const active = groupTasks.filter(task => !task.completed);
    const completed = groupTasks.filter(task => task.completed);

    return { activeTasks: active, completedTasks: completed };
  }, [tasks, activeTaskGroupId]);

  const displayedTasks = useMemo(() => {
    // Return stable reference when possible
    if (!showCompleted) {
      return activeTasks;
    }
    // Only create new array when we actually need to combine them
    return [...activeTasks, ...completedTasks];
  }, [activeTasks, completedTasks, showCompleted]);

  // Get the icon component for the active task group
  const ActiveGroupIcon = LucideIcons[activeTaskGroup.iconId as keyof typeof LucideIcons] as React.ComponentType<{ className?: string; size?: number }> || LucideIcons.CheckSquare;

  const handleCreateTaskGroup = (data: { name: string; description: string; iconId: string; color: string }) => {
    onCreateTaskGroup?.(data);
  };

  const handleUpdateIcon = (iconId: string) => {
    onUpdateTaskGroupIcon?.(activeTaskGroup.id, iconId);
    setShowIconPicker(false);
  };

  const handleUpdateColor = (color: string) => {
    onUpdateTaskGroupColor?.(activeTaskGroup.id, color);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
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
        <span className="font-mono font-semibold">{activeTasks.length + completedTasks.length}</span>
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
        {TASK_COLORS.slice(0, 4).map(color => (
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

  if (activeTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Icon Picker for Task Group */}
            <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                  aria-label={`Task group icon: ${activeTaskGroup.name}`}
                >
                  <ActiveGroupIcon
                    className="w-4 h-4"
                    style={{ color: activeTaskGroup.color }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <IconPicker
                  selectedIcon={activeTaskGroup.iconId}
                  onIconSelect={handleUpdateIcon}
                />
              </PopoverContent>
            </Popover>

            {/* Task Group Name with Tooltip */}
            <CursorTooltip
              content={tooltipContent}
              containerClassName="inline-block"
            >
              <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
                {activeTaskGroup.name}
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
                <DropdownMenuItem>
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

            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              disabled
            >
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
                Are you sure you want to delete "{activeTaskGroup.name}"? All tasks within this list will be permanently deleted. This action cannot be undone.
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
        {/* Tasks Header with Icon and Tooltip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Icon Picker for Task Group */}
            <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                  aria-label={`Task group icon: ${activeTaskGroup.name}`}
                >
                  <ActiveGroupIcon
                    className="w-4 h-4"
                    style={{ color: activeTaskGroup.color }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <IconPicker
                  selectedIcon={activeTaskGroup.iconId}
                  onIconSelect={handleUpdateIcon}
                />
              </PopoverContent>
            </Popover>

            {/* Task Group Name with Tooltip */}
            <CursorTooltip
              content={tooltipContent}
              containerClassName="inline-block"
            >
              <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
                {activeTaskGroup.name}
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
                <DropdownMenuItem>
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
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
              >
                {isTasksOpen ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="space-y-2">
          {/* Show/Hide Completed Tasks Switch */}
          {completedTasks.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <Label
                htmlFor="show-completed"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Show completed tasks ({completedTasks.length})
              </Label>
              <Switch
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
                className="scale-75"
              />
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-1">
            {displayedTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggleTask}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onSchedule={onScheduleTask}
                onRemoveTag={onRemoveTag}
                groupColor={activeTaskGroup.color}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

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
              Are you sure you want to delete "{activeTaskGroup.name}"? All tasks within this list will be permanently deleted. This action cannot be undone.
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

export default TaskList;