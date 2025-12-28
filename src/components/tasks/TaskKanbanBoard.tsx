import React, { useMemo, useState } from 'react';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useTasks } from '@/hooks/useTasks';
import { useUIStore } from '@/stores/uiStore';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TaskItem from './TaskItem';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Circle, PlayCircle, Flag } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type ColumnKey = 'not_started' | 'in_progress' | 'done';

function getTaskStatus(task: Task): ColumnKey {
  const status = task.status;
  if (status === 'in_progress' || status === 'not_started' || status === 'done')
    return status;
  return task.completed ? 'done' : 'not_started';
}

// Status configuration with icons, colors, and styling
function getStatusConfig(status: ColumnKey) {
  switch (status) {
    case 'not_started':
      return {
        label: 'Not Started',
        icon: Circle,
        iconColor: 'text-muted-foreground',
        backgroundColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500',
        darkBackgroundColor: 'dark:bg-gray-400/10',
        darkBorderColor: 'dark:border-gray-400',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        icon: PlayCircle,
        iconColor: 'text-amber-500',
        backgroundColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500',
        darkBackgroundColor: 'dark:bg-amber-400/10',
        darkBorderColor: 'dark:border-amber-400',
      };
    case 'done':
      return {
        label: 'Done',
        icon: Flag,
        iconColor: 'text-emerald-600',
        backgroundColor: 'bg-emerald-600/10',
        borderColor: 'border-emerald-600',
        darkBackgroundColor: 'dark:bg-emerald-500/10',
        darkBorderColor: 'dark:border-emerald-500',
      };
    default:
      return {
        label: 'Unknown',
        icon: Circle,
        iconColor: 'text-muted-foreground',
        backgroundColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500',
        darkBackgroundColor: 'dark:bg-gray-400/10',
        darkBorderColor: 'dark:border-gray-400',
      };
  }
}

export const TaskKanbanBoard: React.FC = () => {
  const { tasks, activeTaskGroupId } = useTaskManagement({
    includeTaskOperations: true,
  });
  const { updateTask } = useTasks();
  const { selectedKanbanTaskListId } = useUIStore();
  const [dragState, setDragState] = useState<{
    activeId: string | null;
    originalColumn: ColumnKey | null;
    activeTask: Task | null;
    targetColumn: ColumnKey | null; // For optimistic updates
  }>({
    activeId: null,
    originalColumn: null,
    activeTask: null,
    targetColumn: null,
  });

  const selectedListId = selectedKanbanTaskListId ?? activeTaskGroupId;

  const grouped = useMemo(() => {
    const result: Record<ColumnKey, Task[]> = {
      not_started: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) {
      if (selectedListId) {
        if (selectedListId === 'default') {
          // Only include tasks not assigned to a specific list
          if (t.taskListId) continue;
        } else if (t.taskListId !== selectedListId) {
          continue;
        }
      }

      // OPTIMISTIC UPDATE: Use target column if this task is being moved
      let targetColumn = getTaskStatus(t);
      if (dragState.targetColumn && dragState.activeId === t.id) {
        targetColumn = dragState.targetColumn;
      }

      result[targetColumn].push(t);
    }
    // Sort for stable display
    (Object.keys(result) as ColumnKey[]).forEach((k) => {
      result[k].sort((a, b) => {
        if (a.completed === b.completed) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.completed ? 1 : -1;
      });
    });
    return result;
  }, [tasks, selectedListId, dragState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(
      event.active?.data?.current?.taskId || event.active?.id || ''
    );
    const task = tasks.find((t: Task) => t.id === taskId);
    if (task) {
      const originalColumn = getTaskStatus(task);
      setDragState({
        activeId: taskId,
        originalColumn,
        activeTask: task,
        targetColumn: null,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { activeId, originalColumn } = dragState;
    const overData = event.over?.data?.current as
      | { columnKey?: ColumnKey }
      | undefined;
    const overKey = overData?.columnKey;

    // Validate move
    if (!activeId || !overKey || !originalColumn) {
      // Clear drag state for invalid moves
      setDragState({
        activeId: null,
        originalColumn: null,
        activeTask: null,
        targetColumn: null,
      });
      return;
    }

    // Prevent unnecessary API calls for same-column drops
    if (originalColumn === overKey) {
      // Clear drag state for same-column drops
      setDragState({
        activeId: null,
        originalColumn: null,
        activeTask: null,
        targetColumn: null,
      });
      return;
    }

    // OPTIMISTIC UPDATE: Set target column immediately for smooth transition
    setDragState((prev) => ({ ...prev, targetColumn: overKey }));

    // Prepare status updates
    const updates: Partial<Task> = { status: overKey };
    if (overKey === 'done') {
      updates.completed = true;
    } else if (originalColumn === 'done') {
      updates.completed = false;
    }

    // Make API call - clear drag state when complete
    updateTask.mutate(
      { id: activeId, updates },
      {
        onSettled: () => {
          // Clear all drag state after API call completes (success or failure)
          setDragState({
            activeId: null,
            originalColumn: null,
            activeTask: null,
            targetColumn: null,
          });
        },
        onError: () => {
          toast.error('Failed to move task. Please try again.');
        },
      }
    );
  };

  const Column: React.FC<{ keyId: ColumnKey }> = ({ keyId }) => {
    const { setNodeRef } = useDroppable({
      id: `col-${keyId}`,
      data: { columnKey: keyId },
    });
    const taskCount = grouped[keyId].length;
    const statusConfig = getStatusConfig(keyId);
    const Icon = statusConfig.icon;

    return (
      <div
        className={cn(
          'h-full flex flex-col border-r border-border last:border-r-0',
          // Mobile: make columns horizontally scrollable with snap
          'snap-start md:snap-none min-w-[min(85vw,24rem)] md:min-w-0'
        )}
      >
        {/* Color-coded Header with Icon */}
        <div className="border-b border-border px-4 py-2 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Status icon with color */}
              <Icon className={cn('w-4 h-4', statusConfig.iconColor)} />
              {/* Status label */}
              <h3
                className={cn(
                  'font-medium text-sm truncate',
                  statusConfig.iconColor
                )}
              >
                {statusConfig.label}
              </h3>
              {/* Task count badge matching TaskPaneContainer */}
              <Badge variant="outline" className="text-xs h-5">
                {taskCount}
              </Badge>
            </div>
          </div>
        </div>

        {/* Column Content - Droppable Area */}
        <div
          ref={setNodeRef}
          className="flex-1 overflow-auto px-4 py-2"
          data-column-key={keyId}
        >
          <div className="space-y-2 md:space-y-3 min-h-[60vh]">
            {grouped[keyId].map((task) => (
              <DraggableCard key={task.id} task={task} keyId={keyId} />
            ))}
            {/* Empty state for columns with no tasks */}
            {taskCount === 0 && (
              <div className="flex items-center justify-center h-32 text-center">
                <div className="text-sm text-muted-foreground">
                  Drop tasks here
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const DraggableCard: React.FC<{ task: Task; keyId: ColumnKey }> = ({
    task,
    keyId,
  }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id: task.id,
        data: { taskId: task.id },
      });
    const statusConfig = getStatusConfig(keyId);

    // DragOverlay pattern: hide original during drag, overlay handles the visual
    const style = {
      transform: CSS.Translate.toString(transform),
      // Hide original element during drag - overlay takes over
      opacity: isDragging ? 0 : 1,
    };

    return (
      <Card
        ref={setNodeRef as React.RefCallback<HTMLDivElement>}
        style={style}
        className={cn(
          // Base card visual consistent with app
          'shadow-sm border rounded-md py-2 px-2 sm:px-3',
          // Status accents
          statusConfig.backgroundColor,
          statusConfig.borderColor,
          statusConfig.darkBackgroundColor,
          statusConfig.darkBorderColor,
          // Cursor states
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        {...listeners}
        {...attributes}
      >
        <TaskItem
          task={task}
          onToggle={() =>
            updateTask.mutate({
              id: task.id,
              updates: { completed: !task.completed },
            })
          }
          onEdit={(id, title) => updateTask.mutate({ id, updates: { title } })}
          onDelete={() => {
            /* hidden in kanban */
          }}
          onSchedule={() => void 0}
          className="p-0"
          calendarMode={false}
          showTaskListLabel={false}
          hideCheckbox={true}
        />
      </Card>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Responsive columns: flex horizontal scroll on mobile, 3 fixed grid columns on md+ */}
      <div
        className={cn(
          // Mobile-first: flex row + horizontal scroll + snap
          'flex overflow-x-auto gap-4 px-2 sm:px-4 snap-x snap-mandatory h-full',
          // Desktop: switch to grid with fixed 3 columns, no horizontal scroll
          'md:grid md:grid-cols-3 md:gap-0 md:overflow-x-visible'
        )}
      >
        <Column keyId="not_started" />
        <Column keyId="in_progress" />
        <Column keyId="done" />
      </div>

      {/* DragOverlay - portals the dragged item to document body level */}
      <DragOverlay>
        {dragState.activeTask
          ? (() => {
              // Apply same status styling as DraggableCard
              const taskStatus = getTaskStatus(dragState.activeTask);
              const statusConfig = getStatusConfig(taskStatus);

              return (
                <Card
                  className={cn(
                    'shadow-lg border rounded-md py-2 px-2 sm:px-3',
                    'transform-gpu scale-105',
                    'shadow-2xl ring-1 ring-black/5',
                    // Apply status-specific styling
                    statusConfig.backgroundColor,
                    statusConfig.borderColor,
                    statusConfig.darkBackgroundColor,
                    statusConfig.darkBorderColor
                  )}
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <TaskItem
                    task={dragState.activeTask}
                    onToggle={() => {}} // Disabled in overlay
                    onEdit={() => {}} // Disabled in overlay
                    onDelete={() => {}} // Disabled in overlay
                    onSchedule={() => void 0}
                    className="p-0 cursor-grabbing"
                    calendarMode={false}
                    showTaskListLabel={false}
                    hideCheckbox={true}
                  />
                </Card>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskKanbanBoard;
