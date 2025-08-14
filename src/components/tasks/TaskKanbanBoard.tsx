import React, { useMemo, useCallback } from 'react';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useTasks } from '@/hooks/useTasks';
import { useUIStore } from '@/stores/uiStore';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types';
import { cn } from '@/lib/utils';
import TaskItem from './TaskItem';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';

type ColumnKey = 'not_started' | 'in_progress' | 'done';

function getTaskStatus(task: Task): ColumnKey {
  const status = (task as any).status as ColumnKey | undefined;
  if (status === 'in_progress' || status === 'not_started' || status === 'done') return status;
  return task.completed ? 'done' : 'not_started';
}

export const TaskKanbanBoard: React.FC = () => {
  const { tasks, activeTaskGroupId } = useTaskManagement({ includeTaskOperations: true }) as any;
  const { updateTask } = useTasks();
  const { setTaskViewMode } = useUIStore();

  const grouped = useMemo(() => {
    const result: Record<ColumnKey, Task[]> = { not_started: [], in_progress: [], done: [] };
    for (const t of tasks) {
      if (activeTaskGroupId && activeTaskGroupId !== 'default' && t.taskListId !== activeTaskGroupId) continue;
      result[getTaskStatus(t)].push(t);
    }
    // Sort for stable display
    (Object.keys(result) as ColumnKey[]).forEach((k) => {
      result[k].sort((a, b) => (a.completed === b.completed ? (b.createdAt as any) - (a.createdAt as any) : a.completed ? 1 : -1));
    });
    return result;
  }, [tasks, activeTaskGroupId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const commitMove = (taskId: string, to: ColumnKey) => {
    updateTask.mutate({ id: taskId, updates: { status: to === 'done' ? 'done' : to, completed: to === 'done' } as any });
  };

  const Column: React.FC<{ title: string; keyId: ColumnKey } & React.HTMLAttributes<HTMLDivElement>> = ({ title, keyId }) => {
    const { setNodeRef } = useDroppable({ id: `col-${keyId}`, data: { columnKey: keyId } });
    return (
      <div ref={setNodeRef} className="flex flex-col rounded-lg border border-border bg-muted/30 min-h-[60vh]" data-column-key={keyId}>
        <div className="px-3 py-2 border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="flex-1 p-2 space-y-1 overflow-auto">
          {grouped[keyId].map((task) => (
            <DraggableCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    );
  };

  const DraggableCard: React.FC<{ task: Task }> = ({ task }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { taskId: task.id } });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    return (
      <div ref={setNodeRef} style={style} className={cn('bg-background rounded-md border border-border/60 shadow-sm', isDragging && 'opacity-80 ring-2 ring-primary/40')} {...listeners} {...attributes}>
        <TaskItem
          task={task}
          onToggle={() => updateTask.mutate({ id: task.id, updates: { completed: !task.completed } })}
          onEdit={(id, title) => updateTask.mutate({ id, updates: { title } })}
          onDelete={() => { /* hidden in kanban */ }}
          onSchedule={() => void 0}
          className="px-2 py-2"
          calendarMode={false}
          showTaskListLabel={false}
        />
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={(event: DragEndEvent) => {
        const activeId = String(event.active?.data?.current?.taskId || event.active?.id || '');
        const overKey = (event.over?.data?.current as any)?.columnKey as ColumnKey | undefined;
        if (activeId && overKey) commitMove(activeId, overKey);
      }}
      onDragStart={(event: DragStartEvent) => {
        // Reserved for overlay previews later
      }}
      onDragOver={(event: DragOverEvent) => {
        // Reserved for hover effects later
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-full p-4">
        <Column title="Not Started" keyId="not_started" />
        <Column title="In Progress" keyId="in_progress" />
        <Column title="Done" keyId="done" />
      </div>
    </DndContext>
  );
};

export default TaskKanbanBoard;

