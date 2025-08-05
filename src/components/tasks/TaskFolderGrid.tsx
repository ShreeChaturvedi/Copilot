/**
 * TaskFolderGrid - Folder view for task lists with hover preview
 */

import React, { useMemo, useCallback } from 'react';
import { Folder, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TaskFolder, Task } from '@/types';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useUIStore } from '@/stores/uiStore';

export interface TaskFolderGridProps {
  className?: string;
}

/**
 * Convert task groups to folder representation
 */
function createTaskFolders(
  tasks: Task[],
  taskGroups: Array<{
    id: string;
    name: string;
    iconId: string;
    color: string;
    description?: string;
  }>,
  showCompleted: boolean
): TaskFolder[] {
  return taskGroups.map((group) => {
    const groupTasks = tasks.filter(
      (task) =>
        task.groupId === group.id || (!task.groupId && group.id === 'default')
    );

    const activeTasks = groupTasks.filter((task) => !task.completed);
    const completedTasks = groupTasks.filter((task) => task.completed);

    // Get preview tasks - prioritize incomplete tasks, then recently completed
    const previewTasks = [
      ...activeTasks.slice(0, 3),
      ...completedTasks.slice(0, Math.max(0, 4 - activeTasks.length)),
    ].slice(0, 4);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      iconId: group.iconId,
      taskCount: showCompleted ? groupTasks.length : activeTasks.length,
      completedCount: completedTasks.length,
      tasks: previewTasks,
      description: group.description,
    };
  });
}

/**
 * Individual folder item component
 */
interface FolderItemProps {
  folder: TaskFolder;
  onClick: (folderId: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = React.memo(
  ({ folder, onClick }) => {
    // Get the icon component
    const IconComponent =
      (LucideIcons[
        folder.iconId as keyof typeof LucideIcons
      ] as React.ComponentType<{ className?: string }>) || Folder;

    const handleClick = () => {
      onClick(folder.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(folder.id);
      }
    };

    const hasPreviewTasks = folder.tasks.length > 0;

    return (
      <Card
        className={cn(
          'group relative cursor-pointer transition-all duration-200 ease-out',
          'hover:shadow-lg hover:scale-105 hover:z-10',
          'bg-card border-border',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Open ${folder.name} task list (${folder.taskCount} tasks, ${folder.completedCount} completed)`}
      >
        <CardContent className="p-6">
          {/* Folder Icon */}
          <div className="flex items-center justify-center h-16 mb-4">
            <IconComponent
              className="w-12 h-12 transition-colors"
              style={{ color: folder.color }}
            />
          </div>

          {/* Folder Info */}
          <div className="text-center space-y-2">
            <h3 className="font-medium text-sm truncate">{folder.name}</h3>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>{folder.taskCount} tasks</span>
              {folder.completedCount > 0 && (
                <>
                  <span>•</span>
                  <span>{folder.completedCount} completed</span>
                </>
              )}
            </div>
          </div>

          {/* Hover Preview Overlay */}
          {hasPreviewTasks && (
            <div
              className={cn(
                'absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg p-4',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                'flex flex-col justify-center'
              )}
            >
              <div className="space-y-2">
                <div className="text-xs font-medium text-center mb-3 truncate">
                  {folder.name}
                </div>
                {folder.tasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={task.completed}
                      className="w-3 h-3 pointer-events-none"
                      style={
                        task.completed
                          ? { accentColor: folder.color }
                          : undefined
                      }
                    />
                    <span
                      className={cn(
                        'truncate flex-1',
                        task.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {task.title}
                    </span>
                    {/* Show primary tag if available */}
                    {task.tags && task.tags.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs px-1 py-0 h-4"
                      >
                        {task.tags[0].displayText}
                      </Badge>
                    )}
                  </div>
                ))}
                {folder.taskCount > 4 && (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    +{folder.taskCount - 4} more tasks
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state for folders with no tasks */}
          {!hasPreviewTasks && (
            <div
              className={cn(
                'absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg p-4',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                'flex items-center justify-center'
              )}
            >
              <div className="text-xs text-muted-foreground text-center">
                <div className="mb-2">No tasks yet</div>
                <div>Click to add tasks</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

/**
 * Main TaskFolderGrid component
 */
export const TaskFolderGrid: React.FC<TaskFolderGridProps> = ({
  className,
}) => {
  const { globalShowCompleted, setTaskViewMode } = useUIStore();

  // Get task management data
  const { tasks, taskGroups, handleSelectTaskGroup, handleCreateTaskGroup } =
    useTaskManagement({ includeTaskOperations: true });

  // Create folder representation
  const folders = useMemo(
    () => createTaskFolders(tasks, taskGroups, globalShowCompleted),
    [tasks, taskGroups, globalShowCompleted]
  );

  // Handle folder click - switch to list view and select the task group
  const handleFolderClick = useCallback(
    (folderId: string) => {
      handleSelectTaskGroup(folderId);
      setTaskViewMode('list');
    },
    [handleSelectTaskGroup, setTaskViewMode]
  );

  // Handle add new folder
  const handleAddFolder = useCallback(() => {
    // This would typically open a create task group dialog
    // For now, we'll create a default one
    handleCreateTaskGroup({
      name: `Task List ${taskGroups.length + 1}`,
      description: '',
      iconId: 'Folder',
      color: '#3b82f6',
    });
  }, [handleCreateTaskGroup, taskGroups.length]);

  return (
    <div className={cn('p-6', className)}>
      {/* Grid Container */}
      <div
        className={cn(
          'grid gap-6',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
          'auto-rows-fr' // Equal height rows
        )}
      >
        {/* Existing Folders */}
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onClick={handleFolderClick}
          />
        ))}

        {/* Add New Folder Button */}
        <Card
          className={cn(
            'group cursor-pointer transition-all duration-200 ease-out',
            'hover:shadow-lg hover:scale-105',
            'bg-card border-border border-dashed',
            'flex items-center justify-center min-h-[180px]'
          )}
          onClick={handleAddFolder}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            {/* Plus Icon */}
            <div className="flex items-center justify-center h-16 mb-4">
              <Plus className="w-12 h-12 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>

            {/* Add Folder Text */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                New Task List
              </h3>
              <p className="text-xs text-muted-foreground">Click to create</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {folders.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Folder className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Task Lists Yet</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Create your first task list to start organizing your tasks into
            folders.
          </p>
          <Button onClick={handleAddFolder} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Task List
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskFolderGrid;
