import React, { useMemo, useState } from 'react';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useTasks } from '@/hooks/useTasks';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types';
import { cn } from '@/lib/utils';
import TaskItem from './TaskItem';
import { Badge } from '@/components/ui/badge';
import { Circle, PlayCircle, Flag } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';

type ColumnKey = 'not_started' | 'in_progress' | 'done';

function getTaskStatus(task: Task): ColumnKey {
  const status = (task as any).status as ColumnKey | undefined;
  if (status === 'in_progress' || status === 'not_started' || status === 'done') return status;
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
        darkBorderColor: 'dark:border-gray-400'
      };
    case 'in_progress':
      return {
        label: 'In Progress', 
        icon: PlayCircle,
        iconColor: 'text-amber-500',
        backgroundColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500',
        darkBackgroundColor: 'dark:bg-amber-400/10',
        darkBorderColor: 'dark:border-amber-400'
      };
    case 'done':
      return {
        label: 'Done',
        icon: Flag,
        iconColor: 'text-emerald-600',
        backgroundColor: 'bg-emerald-600/10',
        borderColor: 'border-emerald-600',
        darkBackgroundColor: 'dark:bg-emerald-500/10',
        darkBorderColor: 'dark:border-emerald-500'
      };
    default:
      return {
        label: 'Unknown',
        icon: Circle,
        iconColor: 'text-muted-foreground',
        backgroundColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500',
        darkBackgroundColor: 'dark:bg-gray-400/10',
        darkBorderColor: 'dark:border-gray-400'
      };
  }
}

export const TaskKanbanBoard: React.FC = () => {
  const { tasks, activeTaskGroupId } = useTaskManagement({ includeTaskOperations: true }) as any;
  const { updateTask } = useTasks();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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

  const activeTask = activeTaskId ? tasks.find((t: Task) => t.id === activeTaskId) : null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  
  const commitMove = (taskId: string, to: ColumnKey) => {
    updateTask.mutate({ id: taskId, updates: { status: to === 'done' ? 'done' : to, completed: to === 'done' } as any });
  };

  const Column: React.FC<{ keyId: ColumnKey }> = ({ keyId }) => {
    const { setNodeRef } = useDroppable({ id: `col-${keyId}`, data: { columnKey: keyId } });
    const taskCount = grouped[keyId].length;
    const statusConfig = getStatusConfig(keyId);
    const Icon = statusConfig.icon;
    
    return (
      <div className="h-full flex flex-col border-r border-border last:border-r-0">
        {/* Color-coded Header with Icon */}
        <div className="border-b border-border px-4 py-2 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Status icon with color */}
              <Icon className={cn("w-4 h-4", statusConfig.iconColor)} />
              {/* Status label */}
              <h3 className={cn("font-medium text-sm truncate", statusConfig.iconColor)}>
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
          <div className="space-y-1 min-h-[60vh]">
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

  const DraggableCard: React.FC<{ task: Task; keyId: ColumnKey }> = ({ task, keyId }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ 
      id: task.id, 
      data: { taskId: task.id } 
    });
    const statusConfig = getStatusConfig(keyId);
    
    return (
      <div 
        ref={setNodeRef} 
        className={cn(
          'rounded-md shadow-sm border cursor-grab transition-all duration-200',
          statusConfig.backgroundColor,
          statusConfig.borderColor,
          statusConfig.darkBackgroundColor,
          statusConfig.darkBorderColor,
          // Remove transform and z-index here since DragOverlay handles it
          isDragging && 'opacity-50'
        )} 
        {...listeners} 
        {...attributes}
      >
        <TaskItem
          task={task}
          onToggle={() => updateTask.mutate({ id: task.id, updates: { completed: !task.completed } })}
          onEdit={(id, title) => updateTask.mutate({ id, updates: { title } })}
          onDelete={() => { /* hidden in kanban */ }}
          onSchedule={() => void 0}
          className="px-2 py-2"
          calendarMode={false} // Show tags and attachments
          showTaskListLabel={false}
          hideStatusBadge={true} // Hide status badges in kanban
        />
      </div>
    );
  };

  const TaskCardOverlay: React.FC<{ task: Task }> = ({ task }) => {
    const taskStatus = getTaskStatus(task);
    const statusConfig = getStatusConfig(taskStatus);
    
    return (
      <div 
        className={cn(
          'rounded-md shadow-lg border-2 transform rotate-3 cursor-grabbing z-[9999]',
          statusConfig.backgroundColor,
          statusConfig.borderColor,
          statusConfig.darkBackgroundColor,
          statusConfig.darkBorderColor,
        )}
      >
        <TaskItem
          task={task}
          onToggle={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onSchedule={() => void 0}
          className="px-2 py-2"
          calendarMode={false}
          showTaskListLabel={false}
          hideStatusBadge={true} // Hide status badges in drag overlay
        />
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event: DragStartEvent) => {
        const taskId = String(event.active?.data?.current?.taskId || event.active?.id || '');
        setActiveTaskId(taskId);
      }}
      onDragEnd={(event: DragEndEvent) => {
        const activeId = String(event.active?.data?.current?.taskId || event.active?.id || '');
        const overKey = (event.over?.data?.current as any)?.columnKey as ColumnKey | undefined;
        if (activeId && overKey) commitMove(activeId, overKey);
        setActiveTaskId(null);
      }}
    >
      {/* Remove gap and use border-r on columns for proper separation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 h-full">
        <Column keyId="not_started" />
        <Column keyId="in_progress" />
        <Column keyId="done" />
      </div>
      
      {/* DragOverlay for smooth drag experience */}
      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskKanbanBoard;

