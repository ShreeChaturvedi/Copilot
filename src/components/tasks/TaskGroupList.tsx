import React, { useState } from 'react';
import { Plus, ChevronUp, MoreVertical, List, Settings, Edit, Trash2 } from 'lucide-react';
import '../calendar/calendar.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ColorPicker } from '@/components/ui/color-picker';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';
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
import { cn } from '@/lib/utils';

export interface TaskGroup {
  id: string;
  name: string;
  iconId: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

export interface TaskGroupListProps {
  taskGroups: TaskGroup[];
  activeTaskGroupId?: string;
  onSelectTaskGroup: (id: string) => void;
  onAddTaskGroup: (data: { name: string; iconId: string; color: string; description?: string }) => void;
  onEditTaskGroup: (id: string, updates: { name: string; iconId: string; color: string; description?: string }) => void;
  onDeleteTaskGroup?: (id: string) => void;
}

const TASKGROUP_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export const TaskGroupList: React.FC<TaskGroupListProps> = ({
  taskGroups,
  activeTaskGroupId,
  onSelectTaskGroup,
  onAddTaskGroup,
  onEditTaskGroup,
  onDeleteTaskGroup
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isAddingTaskGroup, setIsAddingTaskGroup] = useState(false);
  const [newTaskGroupName, setNewTaskGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TASKGROUP_COLORS[0]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleAddTaskGroup = () => {
    const trimmedName = newTaskGroupName.trim();
    if (trimmedName) {
      onAddTaskGroup({
        name: trimmedName,
        iconId: 'CheckSquare',
        color: selectedColor,
        description: ''
      });
      setNewTaskGroupName('');
      setSelectedColor(TASKGROUP_COLORS[0]);
      setIsAddingTaskGroup(false);
    }
  };

  const handleCancelAdd = () => {
    setNewTaskGroupName('');
    setSelectedColor(TASKGROUP_COLORS[0]);
    setIsAddingTaskGroup(false);
  };

  const handleCreateTaskGroup = (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => {
    onAddTaskGroup({
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description
    });
    setShowCreateDialog(false);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className="space-y-3">
        {/* Task Groups Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-sidebar-foreground" />
            <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
              Task Lists
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreateDialog(true)}
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

        {/* Task Groups List */}
        <CollapsibleContent className="space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
          {taskGroups.map((taskGroup, index) => (
            <div
              key={taskGroup.id}
              className="calendar-item"
              style={{ '--animation-delay': `${index * 50}ms` } as React.CSSProperties}
            >
              <TaskGroupItem
                taskGroup={taskGroup}
                isActive={activeTaskGroupId === taskGroup.id}
                onSelect={() => onSelectTaskGroup(taskGroup.id)}
                onEdit={(name, iconId, color, description) => onEditTaskGroup(taskGroup.id, { name, iconId, color, description })}
                onDelete={onDeleteTaskGroup ? () => onDeleteTaskGroup(taskGroup.id) : undefined}
                recentColors={recentColors}
                onRecentColorAdd={handleRecentColorAdd}
              />
            </div>
          ))}

          {/* Add Task Group Form */}
          {isAddingTaskGroup && (
            <div className="p-3 border rounded-md space-y-3 calendar-item" style={{ '--animation-delay': `${taskGroups.length * 50}ms` } as React.CSSProperties}>
              <Input
                type="text"
                placeholder="Task list name"
                value={newTaskGroupName}
                onChange={(e) => setNewTaskGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTaskGroup();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                autoFocus
                className="text-sm"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {TASKGROUP_COLORS.map(color => (
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
                  onClick={handleAddTaskGroup}
                  disabled={!newTaskGroupName.trim()}
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

          {taskGroups.length === 0 && !isAddingTaskGroup && (
            <div className="text-center py-3 text-muted-foreground calendar-item" style={{ '--animation-delay': '0ms' } as React.CSSProperties}>
              <p className="text-xs">No task lists yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingTaskGroup(true)}
                className="mt-1 text-xs h-7"
              >
                Create your first task list
              </Button>
            </div>
          )}
        </CollapsibleContent>

        {/* Create Task Group Dialog */}
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateTask={handleCreateTaskGroup}
        />
      </div>
    </Collapsible>
  );
};

interface TaskGroupItemProps {
  taskGroup: TaskGroup;
  isActive: boolean;
  onSelect: () => void;
  onEdit: (name: string, iconId: string, color: string, description?: string) => void;
  onDelete?: () => void;
  recentColors?: string[];
  onRecentColorAdd?: (color: string) => void;
}

const TaskGroupItem: React.FC<TaskGroupItemProps> = ({
  taskGroup,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  recentColors = [],
  onRecentColorAdd
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(taskGroup.name);
  const [editColor, setEditColor] = useState(taskGroup.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveEdit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && (trimmedName !== taskGroup.name || editColor !== taskGroup.color)) {
      onEdit(trimmedName, taskGroup.iconId, editColor, taskGroup.description);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(taskGroup.name);
    setEditColor(taskGroup.color);
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
            {TASKGROUP_COLORS.map(color => (
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
      <div className="group/calendar flex items-center gap-3 py-2 px-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
        {/* Selection Dot instead of Checkbox */}
        <button
          onClick={onSelect}
          className={cn(
            'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
            isActive
              ? 'bg-current border-current'
              : 'border-current hover:bg-current/20'
          )}
          style={{
            borderColor: taskGroup.color,
            '--tw-border-opacity': '1',
            color: taskGroup.color
          } as React.CSSProperties}
          aria-label={`Select ${taskGroup.name}`}
        >
          {isActive && (
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
            </div>
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          <div className="text-sm font-medium truncate">
            {taskGroup.name}
            {taskGroup.isDefault && (
              <span className="ml-1 text-xs text-muted-foreground">(default)</span>
            )}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover/calendar:opacity-100 transition-opacity">
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
                  className="mr-2 h-4 w-4 rounded-full flex-shrink-0 border-2 border-border"
                  style={{ backgroundColor: taskGroup.color }}
                />
                <span>Color</span>
                <DropdownMenuShortcut className="flex gap-1 ml-auto">
                  {TASKGROUP_COLORS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(taskGroup.name, taskGroup.iconId, color, taskGroup.description);
                        onRecentColorAdd?.(color);
                      }}
                      className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <ColorPicker
                    value={taskGroup.color}
                    onChange={(color) => {
                      onEdit(taskGroup.name, taskGroup.iconId, color, taskGroup.description);
                      onRecentColorAdd?.(color);
                    }}
                    recentColors={recentColors}
                    onRecentColorAdd={onRecentColorAdd}
                    className="w-3 h-3 border-0"
                  />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              {onDelete && !taskGroup.isDefault && (
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
              Are you sure you want to delete "{taskGroup.name}"? All tasks in this list will be permanently deleted. This action cannot be undone.
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

export default TaskGroupList;