import React, { useState } from 'react';
import { Plus, ChevronUp, MoreVertical, FolderOpen, Settings, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker } from '@/components/ui/color-picker';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
// Local type until shared exports are aligned for TaskList
type TaskList = {
  id: string;
  name: string;
  color: string;
  icon: string;
  taskCount: number;
  isVisible: boolean;
};
import { cn } from '@/lib/utils';

export interface TaskListSelectorProps {
  taskLists: TaskList[];
  onToggleVisibility: (taskListId: string) => void;
  onCreateTaskList: (name: string, color: string, icon: string) => void;
  onEditTaskList: (taskListId: string, name: string, color: string, icon: string) => void;
  onDeleteTaskList?: (taskListId: string) => void;
  className?: string;
}

const TASK_LIST_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

const TASK_LIST_ICONS = [
  'folder',
  'briefcase',
  'home',
  'heart',
  'star',
  'target',
  'bookmark',
  'flag',
];

export const TaskListSelector: React.FC<TaskListSelectorProps> = ({
  taskLists,
  onToggleVisibility,
  onCreateTaskList,
  onEditTaskList,
  onDeleteTaskList,
  className
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddingTaskList, setIsAddingTaskList] = useState(false);
  const [newTaskListName, setNewTaskListName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TASK_LIST_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(TASK_LIST_ICONS[0]);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleAddTaskList = () => {
    const trimmedName = newTaskListName.trim();
    if (trimmedName) {
      onCreateTaskList(trimmedName, selectedColor, selectedIcon);
      setNewTaskListName('');
      setSelectedColor(TASK_LIST_COLORS[0]);
      setSelectedIcon(TASK_LIST_ICONS[0]);
      setIsAddingTaskList(false);
    }
  };

  const handleCancelAdd = () => {
    setNewTaskListName('');
    setSelectedColor(TASK_LIST_COLORS[0]);
    setSelectedIcon(TASK_LIST_ICONS[0]);
    setIsAddingTaskList(false);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className={cn('space-y-3', className)}>
        {/* Task Lists Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sidebar-foreground" />
            <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
              Task Lists
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddingTaskList(true)}
              className="h-6 w-6"
              aria-label="Add task list"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-5 w-5 p-0"
              >
                <div className={`transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                  <ChevronUp className="w-3 h-3" />
                </div>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Task Lists List */}
        <CollapsibleContent className="space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
          {taskLists.map((taskList, index) => (
            <div
              key={taskList.id}
              className="task-list-item"
              style={{ '--animation-delay': `${index * 50}ms` } as React.CSSProperties}
            >
              <TaskListItem
                taskList={taskList}
                onToggleVisibility={() => onToggleVisibility(taskList.id)}
                onEdit={(name, color, icon) => onEditTaskList(taskList.id, name, color, icon)}
                onDelete={onDeleteTaskList ? () => onDeleteTaskList(taskList.id) : undefined}
                recentColors={recentColors}
                onRecentColorAdd={handleRecentColorAdd}
              />
            </div>
          ))}

          {/* Add Task List Form */}
          {isAddingTaskList && (
            <div className="p-3 border rounded-md space-y-3 task-list-item" style={{ '--animation-delay': `${taskLists.length * 50}ms` } as React.CSSProperties}>
              <Input
                type="text"
                placeholder="Task list name"
                value={newTaskListName}
                onChange={(e) => setNewTaskListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTaskList();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                autoFocus
                className="text-sm"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {TASK_LIST_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all',
                        selectedColor === color
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:border-border'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddTaskList}
                  disabled={!newTaskListName.trim()}
                  className="flex-1"
                >
                  Add Task List
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {taskLists.length === 0 && !isAddingTaskList && (
            <div className="text-center py-3 text-muted-foreground task-list-item" style={{ '--animation-delay': '0ms' } as React.CSSProperties}>
              <p className="text-xs">No task lists yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingTaskList(true)}
                className="mt-1 text-xs h-7"
              >
                Create your first task list
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

interface TaskListItemProps {
  taskList: TaskList;
  onToggleVisibility: () => void;
  onEdit: (name: string, color: string, icon: string) => void;
  onDelete?: () => void;
  recentColors?: string[];
  onRecentColorAdd?: (color: string) => void;
}

const TaskListItem: React.FC<TaskListItemProps> = ({
  taskList,
  onToggleVisibility,
  onEdit,
  onDelete,
  recentColors = [],
  onRecentColorAdd
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(taskList.name);
  const [editColor, setEditColor] = useState(taskList.color);
  const [editIcon, setEditIcon] = useState(taskList.icon);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveEdit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && (trimmedName !== taskList.name || editColor !== taskList.color || editIcon !== taskList.icon)) {
      onEdit(trimmedName, editColor, editIcon);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(taskList.name);
    setEditColor(taskList.color);
    setEditIcon(taskList.icon);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteDialog(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 border rounded-md space-y-3">
        <Input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveEdit();
            if (e.key === 'Escape') handleCancelEdit();
          }}
          autoFocus
          className="text-sm"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Color:</span>
          <div className="flex gap-1">
            {TASK_LIST_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setEditColor(color)}
                className={cn(
                  'w-4 h-4 rounded-full border transition-all',
                  editColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:border-border'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveEdit} className="flex-1">
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="group/task-list flex items-center gap-3 py-2 px-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
        <Checkbox
          checked={taskList.isVisible}
          onCheckedChange={onToggleVisibility}
          className={cn(
            'data-[state=checked]:bg-current data-[state=checked]:border-current',
            'border-2 rounded-sm flex-shrink-0'
          )}
          style={{
            borderColor: taskList.color,
            '--tw-border-opacity': '1',
            color: taskList.color
          } as React.CSSProperties}
          aria-label={`Toggle ${taskList.name} visibility`}
        />

        {/* Task list color indicator */}
        <div
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: taskList.color }}
        />

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          <div className="text-sm font-medium truncate">
            {taskList.name}
          </div>
        </div>

        {/* Task count */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          ({taskList.taskCount})
        </span>

        <div className="flex items-center opacity-0 group-hover/task-list:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto"
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div
                  className="mr-2 h-4 w-4 rounded-sm flex-shrink-0 border-2 border-border"
                  style={{ backgroundColor: taskList.color }}
                />
                <span>Color</span>
                <DropdownMenuShortcut className="flex gap-1 ml-auto">
                  {TASK_LIST_COLORS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(taskList.name, color, taskList.icon);
                        onRecentColorAdd?.(color);
                      }}
                      className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <ColorPicker
                    value={taskList.color}
                    onChange={(color) => {
                      onEdit(taskList.name, color, taskList.icon);
                      onRecentColorAdd?.(color);
                    }}
                    recentColors={recentColors}
                    onRecentColorAdd={onRecentColorAdd}
                    className="w-3 h-3 border-0"
                  />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskList.name}"? All tasks in this list will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaskListSelector;