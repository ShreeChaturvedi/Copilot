import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Folder, Plus } from 'lucide-react';
import { getIconByName } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TaskFolder, Task } from '@shared/types';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';
import '@/styles/new-folder.css';

export interface TaskFolderGridProps {
  className?: string;
}

/** How long the clicked card holds its 0.98 scale before the board takes over
 *  (design-brief §4.2 click->kanban moment; skipped under reduced motion). */
const OPEN_HOLD_MS = 120;

function createTaskFolders(
  tasks: Task[],
  taskGroups: Array<{
    id: string;
    name: string;
    emoji: string; // from useTaskManagement
    color: string;
    description?: string;
  }>,
  showCompleted: boolean,
  userId: string
): TaskFolder[] {
  return taskGroups.map((group) => {
    const groupTasks = tasks.filter(
      (task) =>
        task.taskListId === group.id ||
        (!task.taskListId && group.id === 'default')
    );
    const activeTasks = groupTasks.filter((task) => !task.completed);
    const completedTasks = groupTasks.filter((task) => task.completed);
    const previewTasks = [
      ...activeTasks.slice(0, 3),
      ...(showCompleted
        ? completedTasks.slice(0, Math.max(0, 3 - activeTasks.length))
        : []),
    ].slice(0, 3);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      iconId: group.emoji,
      // The card reads `N open` (§4.2): always the count of active tasks.
      taskCount: activeTasks.length,
      completedCount: completedTasks.length,
      tasks: previewTasks,
      description: group.description,
      userId,
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
    const [opening, setOpening] = useState(false);
    const openTimeout = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(openTimeout.current), []);

    const handleClick = () => {
      if (opening) return;
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      if (reduceMotion) {
        onClick(folder.id);
        return;
      }
      // The card scales to 0.98 and holds while the board fades in (§4.2).
      setOpening(true);
      openTimeout.current = window.setTimeout(
        () => onClick(folder.id),
        OPEN_HOLD_MS
      );
    };

    return (
      <button
        type="button"
        className={cn('folder-card', opening && 'is-opening')}
        onClick={handleClick}
        style={{ '--chip-c': folder.color } as React.CSSProperties}
      >
        <span className="folder-card-swap">
          {/* Rest state: the 28px icon tile. Fades out 120ms before previews
              fade in, so only one layer is ever exposed (closes #53). */}
          <span className="folder-card-default" aria-hidden="true">
            <span className="folder-card-icon">
              <IconComponent className="folder-card-glyph" />
            </span>
          </span>

          <span className="folder-card-preview" aria-hidden="true">
            {folder.tasks.length > 0 ? (
              folder.tasks.map((task) => (
                <span
                  key={task.id}
                  className={cn(
                    'folder-card-preview-row',
                    task.completed && 'is-done'
                  )}
                >
                  <span className="folder-card-preview-ring" />
                  <span className="folder-card-preview-title">
                    {task.title}
                  </span>
                </span>
              ))
            ) : (
              <>
                <span className="folder-card-etch-row" />
                <span className="folder-card-etch-row" />
                <span className="folder-card-preview-none">No tasks yet</span>
              </>
            )}
          </span>
        </span>

        {/* Pinned footer: the name never leaves (§4.2) */}
        <span className="folder-card-name">{folder.name}</span>
        <span className="folder-card-count">{folder.taskCount} open</span>
      </button>
    );
  }
);

export const TaskFolderGrid: React.FC<TaskFolderGridProps> = ({
  className,
}) => {
  const { globalShowCompleted, setTaskViewMode, setSelectedKanbanTaskListId } =
    useUIStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const {
    tasks,
    tasksLoading,
    taskGroups,
    handleSelectTaskGroup,
    handleCreateTaskGroup,
  } = useTaskManagement({ includeTaskOperations: true });
  const userId = useAuthStore((s) => s.user?.id ?? s.googleUser?.id ?? '');

  const folders = useMemo(
    () => createTaskFolders(tasks, taskGroups, globalShowCompleted, userId),
    [tasks, taskGroups, globalShowCompleted, userId]
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
    <div className={cn('px-4 pt-4 pb-6', className)}>
      {tasksLoading ? (
        <div
          aria-hidden="true"
          className={cn(
            'grid gap-6',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[132px] rounded-card border border-hairline bg-surface-1 p-4 flex flex-col justify-end gap-2"
            >
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-3.5 w-3/4 mt-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : folders.length > 0 ? (
        <div
          className={cn(
            'grid gap-6',
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

          {/* New-list tile: the etched drawing of a folder card (§2.5) */}
          <button
            type="button"
            className="folder-card folder-card--new"
            onClick={handleAddFolder}
          >
            <span className="folder-card-swap">
              <span className="folder-card-default">
                <span className="folder-card-icon" aria-hidden="true">
                  <Plus className="folder-card-glyph" />
                </span>
              </span>
            </span>
            <span className="folder-card-name">New list</span>
          </button>
        </div>
      ) : (
        // Data-empty state (§4.7): the etched drawing of the filled grid,
        // one serif line, one action line.
        <div className="folder-empty">
          <div className="folder-empty-etch" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="folder-empty-ghost">
                <span className="folder-empty-ghost-tile" />
                <span className="folder-empty-ghost-line" />
              </span>
            ))}
          </div>
          <p className="folder-empty-voice folder-empty-copy">
            Every task wants a list.
          </p>
          <p className="folder-empty-action folder-empty-copy">
            Create a list to start sorting your tasks.
          </p>
          <Button onClick={handleAddFolder} className="gap-2 folder-empty-copy">
            <Plus className="w-4 h-4" />
            Create list
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
