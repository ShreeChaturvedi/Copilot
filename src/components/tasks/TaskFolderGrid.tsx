/**
 * TaskFolderGrid - Folder view for task lists with hover preview
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Folder, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TaskFolder, Task } from '@/types';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useUIStore } from '@/stores/uiStore';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';

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
      <div
        className={cn(
          'group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'aspect-[4/3]' // Horizontal 4:3 aspect ratio
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Open ${folder.name} task list (${folder.taskCount} tasks, ${folder.completedCount} completed)`}
      >
        {/* True Unified Container - Single element with tab and body integrated */}
        <div
          className={cn(
            'relative h-full transition-all duration-300 ease-out',
            'group-hover:-translate-y-1 group-hover:scale-105 group-hover:z-20'
          )}
        >
          {/* Integrated Folder with Tab */}
          <div className="relative h-full">
            {/* Folder Tab - Part of the main container */}
            <div
              className={cn(
                'absolute -top-2 left-4 right-1/3 h-6 rounded-t-lg z-10',
                'shadow-sm border border-b-0 transition-shadow duration-300'
              )}
              style={{
                background: `linear-gradient(to bottom, ${folder.color}15, ${folder.color}08)`,
                borderColor: `${folder.color}30`,
              }}
            >
              <div className="absolute inset-x-2 top-1">
                <div
                  className="w-full h-1 rounded-full opacity-60"
                  style={{ backgroundColor: folder.color }}
                />
              </div>
            </div>

            {/* Main Folder Body - Seamlessly connected */}
            <Card
              className={cn(
                'relative overflow-hidden border-2 transition-shadow duration-300 ease-out',
                'bg-card shadow-md group-hover:shadow-xl',
                'h-full'
              )}
              style={{ borderColor: `${folder.color}40` }}
            >
              <CardContent className="p-4 h-full flex flex-col relative">
                {/* Default Folder Content - Hidden on hover */}
                <div
                  className={cn(
                    'flex flex-col h-full transition-opacity duration-300',
                    'group-hover:opacity-0'
                  )}
                >
                  {/* Folder Icon with Semantic Container */}
                  <div className="flex items-center justify-center mb-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        'transition-all duration-300'
                      )}
                      style={{
                        backgroundColor: `${folder.color}15`,
                        borderColor: `${folder.color}30`,
                      }}
                    >
                      <IconComponent
                        className={cn(
                          'w-6 h-6 transition-all duration-300',
                          'group-hover:scale-110 drop-shadow-sm'
                        )}
                        color={folder.color}
                      />
                    </div>
                  </div>

                  {/* Folder Info with Enhanced Typography */}
                  <div className="text-center space-y-2 flex-1 flex flex-col justify-center">
                    <h3
                      className={cn(
                        'font-semibold text-sm truncate text-foreground',
                        'group-hover:text-primary transition-colors'
                      )}
                    >
                      {folder.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1 text-xs flex-wrap">
                      <Badge
                        variant="secondary"
                        className="h-4 px-2 text-xs font-medium"
                        style={{
                          backgroundColor: `${folder.color}15`,
                          color: folder.color,
                          borderColor: `${folder.color}30`,
                        }}
                      >
                        {folder.taskCount} tasks
                      </Badge>
                      {folder.completedCount > 0 && (
                        <Badge variant="outline" className="h-4 px-2 text-xs">
                          {folder.completedCount} done
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview Content - Shows on hover */}
                {hasPreviewTasks && (
                  <div
                    className={cn(
                      'absolute inset-4 flex flex-col justify-center',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                    )}
                  >
                    <div className="space-y-1.5">
                      <div
                        className="text-xs font-semibold text-center mb-2 truncate"
                        style={{ color: folder.color }}
                      >
                        {folder.name}
                      </div>
                      {folder.tasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full flex-shrink-0',
                              task.completed ? 'opacity-50' : ''
                            )}
                            style={{
                              backgroundColor: task.completed
                                ? folder.color
                                : 'currentColor',
                            }}
                          />
                          <span
                            className={cn(
                              'truncate flex-1',
                              task.completed &&
                                'line-through text-muted-foreground'
                            )}
                          >
                            {task.title}
                          </span>
                          {/* Show primary tag if available */}
                          {task.tags && task.tags.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0 h-3 text-[10px]"
                            >
                              {task.tags[0].displayText}
                            </Badge>
                          )}
                        </div>
                      ))}
                      {folder.taskCount > 3 && (
                        <div className="text-xs text-muted-foreground text-center pt-1 font-medium">
                          +{folder.taskCount - 3} more tasks
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state preview - Shows on hover for empty folders */}
                {!hasPreviewTasks && (
                  <div
                    className={cn(
                      'absolute inset-4 flex items-center justify-center',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                    )}
                  >
                    <div className="text-xs text-center">
                      <div className="mb-2 font-medium text-muted-foreground">
                        No tasks yet
                      </div>
                      <div className="text-xs" style={{ color: folder.color }}>
                        Click to add tasks
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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

  // Handle add new folder - opens dialog
  const handleAddFolder = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  // Handle create task list from dialog
  const handleCreateTaskList = useCallback(
    (data: {
      name: string;
      description: string;
      iconId: string;
      color: string;
    }) => {
      handleCreateTaskGroup(data);
      setShowCreateDialog(false);
    },
    [handleCreateTaskGroup]
  );

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
        <div
          className={cn(
            'group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'aspect-[4/3]' // Horizontal 4:3 aspect ratio
          )}
          onClick={handleAddFolder}
          tabIndex={0}
          role="button"
          aria-label="Create new task list"
        >
          {/* True Unified Container - Single element with tab and body integrated */}
          <div
            className={cn(
              'relative h-full transition-all duration-300 ease-out',
              'group-hover:-translate-y-1 group-hover:scale-105 group-hover:z-10'
            )}
          >
            {/* Integrated Folder with Tab */}
            <div className="relative h-full">
              {/* Folder Tab - Part of the main container */}
              <div
                className={cn(
                  'absolute -top-2 left-4 right-1/3 h-6 rounded-t-lg z-10',
                  'shadow-sm border border-b-0 bg-gradient-to-b from-muted/50 to-muted/30',
                  'border-dashed border-muted-foreground/30',
                  'transition-all duration-300 group-hover:shadow-md group-hover:border-primary/40'
                )}
              />

              {/* Main Folder Body - Seamlessly connected */}
              <Card
                className={cn(
                  'relative overflow-hidden border-2 border-dashed transition-shadow duration-300 ease-out',
                  'bg-gradient-to-br from-muted/20 via-muted/10 to-transparent',
                  'border-muted-foreground/30 group-hover:border-primary/50',
                  'shadow-sm group-hover:shadow-lg',
                  'h-full'
                )}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                  {/* Plus Icon with Semantic Container */}
                  <div className="flex items-center justify-center mb-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        'bg-primary opacity-5 group-hover:opacity-10 transition-opacity duration-300'
                      )}
                    >
                      <Plus
                        className={cn(
                          'w-6 h-6 transition-all duration-300',
                          'text-muted-foreground group-hover:text-primary group-hover:scale-110'
                        )}
                      />
                    </div>
                  </div>

                  {/* Add Folder Text */}
                  <div className="space-y-2">
                    <h3
                      className={cn(
                        'font-semibold text-sm transition-colors',
                        'text-muted-foreground group-hover:text-primary'
                      )}
                    >
                      New Task List
                    </h3>
                    <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to create
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
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

      {/* Create Task List Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateTask={handleCreateTaskList}
      />
    </div>
  );
};

export default TaskFolderGrid;
