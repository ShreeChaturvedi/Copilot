import React, { useMemo, useCallback, useState } from 'react';
import { Folder, Plus } from 'lucide-react';
import { getIconByName } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TaskFolder, Task } from "@shared/types";
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useUIStore } from '@/stores/uiStore';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';
import '@/styles/new-folder.css';

export interface TaskFolderGridProps {
  className?: string;
}

function createTaskFolders(
  tasks: Task[],
  taskGroups: Array<{
    id: string;
    name: string;
    emoji: string; // from useTaskManagement
    color: string;
    description?: string;
  }>,
  showCompleted: boolean
): TaskFolder[] {
  return taskGroups.map((group) => {
    const groupTasks = tasks.filter(
      (task) =>
        task.taskListId === group.id || (!task.taskListId && group.id === 'default')
    );
    const activeTasks = groupTasks.filter((task) => !task.completed);
    const completedTasks = groupTasks.filter((task) => task.completed);
    const previewTasks = [
      ...activeTasks.slice(0, 3),
      ...completedTasks.slice(0, Math.max(0, 4 - activeTasks.length)),
    ].slice(0, 4);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      iconId: group.emoji,
      taskCount: showCompleted ? groupTasks.length : activeTasks.length,
      completedCount: completedTasks.length,
      tasks: previewTasks,
      description: group.description,
      userId: 'default-user', // TODO: Get actual user ID from context
    };
  });
}

interface FolderItemProps {
  folder: TaskFolder;
  onClick: (folderId: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = React.memo(
  ({ folder, onClick }) => {
    const IconComponent = getIconByName(folder.iconId, Folder);
    const hasPreviewTasks = folder.tasks.length > 0;

    const handleClick = () => onClick(folder.id);
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(folder.id);
      }
    };

    return (
      <div
        className="folder-wrapper group"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Open ${folder.name} task list`}
        style={{ '--folder-color': folder.color } as React.CSSProperties}
      >
        <div className="folder-body">
          <div className="folder-content">
            {/* Default View */}
            <div className="default-view">
              <div className="flex items-start justify-between">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${folder.color}15` }}
                >
                  <span style={{ color: folder.color }}>
                    <IconComponent className="w-6 h-6" />
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground truncate">
                  {folder.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {folder.taskCount} tasks
                </p>
              </div>
            </div>

            {/* Hover Preview View */}
            <div className="preview-view">
              {hasPreviewTasks ? (
                <div className="space-y-1.5 text-left w-full">
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
                          task.completed && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))}
                  {folder.taskCount > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-1 font-medium">
                      +{folder.taskCount - 3} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center">
                  No tasks yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export const TaskFolderGrid: React.FC<TaskFolderGridProps> = ({
  className,
}) => {
  const { globalShowCompleted, setTaskViewMode, setSelectedKanbanTaskListId } = useUIStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { tasks, taskGroups, handleSelectTaskGroup, handleCreateTaskGroup } =
    useTaskManagement({ includeTaskOperations: true });

  const folders = useMemo(
    () => createTaskFolders(tasks, taskGroups, globalShowCompleted),
    [tasks, taskGroups, globalShowCompleted]
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      handleSelectTaskGroup(folderId);
      // Navigate to kanban view for the selected task list
      setTaskViewMode('kanban');
      // Persist which list Kanban should display
      setSelectedKanbanTaskListId(folderId);
    },
    [handleSelectTaskGroup, setTaskViewMode, setSelectedKanbanTaskListId]
  );

  const handleAddFolder = useCallback(() => setShowCreateDialog(true), []);

  const handleCreateTaskList = useCallback(
    (data: {
      name: string;
      description: string;
      emoji: string;
      color: string;
    }) => {
      // useTaskManagement expects an object with emoji for creation
      handleCreateTaskGroup({
        name: data.name,
        description: data.description,
        emoji: data.emoji,
        color: data.color,
      });
      setShowCreateDialog(false);
    },
    [handleCreateTaskGroup]
  );

  return (
    <div className={cn('p-6', className)}>
      <div
        className={cn(
          'grid gap-x-6 gap-y-8',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
        )}
      >
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onClick={handleFolderClick}
          />
        ))}

        {/* Add New Folder Button */}
        <div
          className="folder-wrapper group"
          onClick={handleAddFolder}
          tabIndex={0}
          role="button"
          aria-label="Create new task list"
        >
          <div className="folder-body add-new-folder">
            <div className="folder-content flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors duration-200">
                  <Plus className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                </div>
                <h3 className="font-semibold text-md mt-3 text-muted-foreground group-hover:text-primary transition-colors duration-200">
                  New List
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {folders.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Folder className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Task Lists Yet</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Create your first task list to start organizing your tasks.
          </p>
          <Button onClick={handleAddFolder} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Task List
          </Button>
        </div>
      )}

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateTask={handleCreateTaskList}
      />
    </div>
  );
};

export default TaskFolderGrid;
