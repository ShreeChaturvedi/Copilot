import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useTasks } from '@/hooks/useTasks';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isSameDay, differenceInCalendarDays } from 'date-fns';
import { MoreHorizontal, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskActionMenuItems } from './TaskActionMenuItems';
import { ScheduleTaskDialog } from './ScheduleTaskDialog';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import './kanban.css';

type ColumnKey = 'not_started' | 'in_progress' | 'done';

const COLUMN_ORDER: ColumnKey[] = ['not_started', 'in_progress', 'done'];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

/** Drop-settle travel duration (§5 --dur-4) and rim-flash length. */
const LAND_MS = 320;
const FLASH_MS = 300;

function getTaskStatus(task: Task): ColumnKey {
  const status = task.status;
  if (status === 'in_progress' || status === 'not_started' || status === 'done')
    return status;
  return task.completed ? 'done' : 'not_started';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* ------------------------------------------------------------------ */
/* Status glyphs: the §4.1 ring language at column-header size.        */
/* Rest = hairline ring; in-progress = amber 270° arc; done = filled   */
/* with the LIST color + white check (never the accent).               */
/* ------------------------------------------------------------------ */

const StatusGlyph: React.FC<{ column: ColumnKey; listColor?: string }> = ({
  column,
  listColor,
}) => {
  if (column === 'done') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill={listColor || 'var(--ink-muted)'} />
        <path
          d="M4.4 7.2 L6.2 9 L9.6 5.2"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="5.25"
        fill="none"
        stroke="var(--faint)"
        strokeWidth="1.5"
      />
      {column === 'in_progress' && (
        <path
          d="M 7 1.75 A 5.25 5.25 0 1 1 1.75 7"
          fill="none"
          stroke="var(--warning)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

/* Colorless priority glyph: three bars, level carried by fill count. */
const PriorityGlyph: React.FC<{ priority: NonNullable<Task['priority']> }> = ({
  priority,
}) => {
  const filled = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
  const bars = [
    { x: 1, y: 7, h: 4 },
    { x: 5, y: 4.5, h: 6.5 },
    { x: 9, y: 2, h: 9 },
  ];
  return (
    <span
      className="kanban-priority"
      role="img"
      aria-label={`${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width="2"
            height={b.h}
            rx="1"
            fill="currentColor"
            opacity={i < filled ? 1 : 0.25}
          />
        ))}
      </svg>
    </span>
  );
};

/* Due chip copy: mono, caps, proximity ink (§4.1). */
function dueChip(date: Date): {
  label: string;
  tone: 'overdue' | 'today' | 'later';
} {
  const now = new Date();
  const hasTime = !(date.getHours() === 0 && date.getMinutes() === 0);
  const overdue = hasTime
    ? date.getTime() < now.getTime()
    : differenceInCalendarDays(date, now) < 0;
  const today = isSameDay(date, now);
  const dayPart = today
    ? 'Today'
    : Math.abs(differenceInCalendarDays(date, now)) <= 6
      ? format(date, 'EEE')
      : format(date, 'MMM d');
  const label = hasTime ? `${dayPart} ${format(date, 'HH:mm')}` : dayPart;
  return { label, tone: overdue ? 'overdue' : today ? 'today' : 'later' };
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

interface CardBodyProps {
  task: Task;
  menu?: React.ReactNode;
}

/** Shared card anatomy: title 13/500 clamp-2 + footer (due chip, priority). */
const CardBody: React.FC<CardBodyProps> = ({ task, menu }) => {
  const due = task.scheduledDate ? dueChip(task.scheduledDate) : null;
  return (
    <>
      <div className="kanban-card-title">{task.title}</div>
      {(due || task.priority) && (
        <div className="kanban-card-footer">
          {due && (
            <span
              className={cn('kanban-due uppercase', {
                'kanban-due--today': due.tone === 'today',
                'kanban-due--overdue': due.tone === 'overdue',
              })}
            >
              {due.label}
            </span>
          )}
          {task.priority && <PriorityGlyph priority={task.priority} />}
        </div>
      )}
      {menu}
    </>
  );
};

export const TaskKanbanBoard: React.FC = () => {
  const { tasks, tasksLoading, activeTaskGroupId, taskGroups } =
    useTaskManagement({
      includeTaskOperations: true,
    });
  const { updateTask, deleteTask, scheduleTask } = useTasks();
  const { selectedKanbanTaskListId } = useUIStore();
  const setEnhancedInputVisible = useSettingsStore(
    (s) => s.setEnhancedInputVisible
  );

  // Optimistic column placements, cleared when the server settles
  const [moves, setMoves] = useState<Record<string, ColumnKey>>({});
  // Live drag lifecycle
  const [drag, setDrag] = useState<{
    task: Task;
    from: ColumnKey;
    over: ColumnKey | null;
    height: number;
  } | null>(null);
  // Card kept invisible while the DragOverlay travels onto it (320ms)
  const [landing, setLanding] = useState<{ id: string; flash: boolean } | null>(
    null
  );
  const [flashId, setFlashId] = useState<string | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const selectedListId = selectedKanbanTaskListId ?? activeTaskGroupId;
  const listColorById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of taskGroups) map[g.id] = g.color;
    return map;
  }, [taskGroups]);
  const boardListColor =
    listColorById[selectedListId ?? 'default'] ?? listColorById['default'];

  const grouped = useMemo(() => {
    const result: Record<ColumnKey, Task[]> = {
      not_started: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) {
      if (selectedListId) {
        if (selectedListId === 'default') {
          if (t.taskListId) continue;
        } else if (t.taskListId !== selectedListId) {
          continue;
        }
      }
      result[moves[t.id] ?? getTaskStatus(t)].push(t);
    }
    (Object.keys(result) as ColumnKey[]).forEach((k) => {
      result[k].sort((a, b) => {
        if (a.completed === b.completed) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.completed ? 1 : -1;
      });
    });
    return result;
  }, [tasks, selectedListId, moves]);

  /* All 3 columns empty at once (e.g. a freshly created list): the whole-
     board Scene message takes over from the 3x redundant per-column
     ghost (§2.3.6, desktop only — see kanban.css). */
  const isBoardEmpty = COLUMN_ORDER.every((k) => grouped[k].length === 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const commitMove = useCallback(
    (taskId: string, from: ColumnKey, to: ColumnKey) => {
      setMoves((m) => ({ ...m, [taskId]: to }));
      const updates: Partial<Task> = { status: to };
      if (to === 'done') updates.completed = true;
      else if (from === 'done') updates.completed = false;
      updateTask.mutate(
        { id: taskId, updates },
        {
          onSettled: () =>
            setMoves((m) => {
              const next = { ...m };
              delete next[taskId];
              return next;
            }),
          onError: () => toast.error("Couldn't move the task. Try again."),
        }
      );
    },
    [updateTask]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active?.id ?? '');
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setDrag({
      task,
      from: moves[taskId] ?? getTaskStatus(task),
      over: null,
      height: event.active.rect.current.initial?.height ?? 56,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overKey =
      (event.over?.data?.current as { columnKey?: ColumnKey } | undefined)
        ?.columnKey ?? null;
    setDrag((d) => (d ? { ...d, over: overKey } : d));
  };

  /** Overlay children clear at drag end; dnd-kit plays the 320ms drop travel
      on the captured node while the real card stays hidden, then the rim
      flash fires on the landed card. */
  const settleOverlay = useCallback(
    (taskId: string, flash: boolean) => {
      const travel = prefersReducedMotion() ? 120 : LAND_MS;
      setDrag(null);
      setLanding({ id: taskId, flash });
      later(() => {
        setLanding((l) => (l?.id === taskId ? null : l));
        if (flash) {
          setFlashId(taskId);
          later(() => setFlashId((f) => (f === taskId ? null : f)), FLASH_MS);
        }
      }, travel);
    },
    [later]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!drag) return;
    const overKey = (
      event.over?.data?.current as { columnKey?: ColumnKey } | undefined
    )?.columnKey;
    if (overKey && overKey !== drag.from) {
      commitMove(drag.task.id, drag.from, overKey);
      settleOverlay(drag.task.id, true);
    } else {
      settleOverlay(drag.task.id, false);
    }
  };

  const handleDragCancel = () => {
    if (drag) settleOverlay(drag.task.id, false);
  };

  /* Keyboard moves: focus a card, Arrow Left/Right. NOT animated (§5). */
  const handleCardKeyDown = (task: Task, e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const from = moves[task.id] ?? getTaskStatus(task);
    const idx = COLUMN_ORDER.indexOf(from) + (e.key === 'ArrowRight' ? 1 : -1);
    const to = COLUMN_ORDER[idx];
    if (!to) return;
    e.preventDefault();
    e.stopPropagation();
    commitMove(task.id, from, to);
    // The card remounts in its new column; keep keyboard focus on it
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)
        ?.focus();
    });
  };

  const handleSchedule = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) setSchedulingTask(task);
  };

  const handlePlace = (taskId: string, scheduledDate: Date) => {
    scheduleTask.mutate(
      { id: taskId, scheduledDate },
      {
        onSuccess: () =>
          toast.success(`Placed on ${format(scheduledDate, 'EEE, MMM d')}`),
        onError: () => toast.error("Couldn't place the task. Try again."),
      }
    );
  };

  const handleDelete = (taskId: string) => deleteTask.mutate(taskId);

  const handleNewTask = () => setEnhancedInputVisible(true);

  /* ---------------- Card ---------------- */

  const DraggableCard: React.FC<{ task: Task; column: ColumnKey }> = ({
    task,
    column,
  }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: task.id,
      data: { taskId: task.id },
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const isVacated = drag?.task.id === task.id && isDragging;
    const isLanding = landing?.id === task.id;
    const listColor = task.taskListId
      ? listColorById[task.taskListId]
      : listColorById['default'];

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onKeyDown={(e) => handleCardKeyDown(task, e)}
        data-task-id={task.id}
        aria-label={`${task.title}, ${COLUMN_LABELS[column]}`}
        className={cn('kanban-card', {
          'kanban-card--done': column === 'done',
          'kanban-card--vacated': isVacated,
          'kanban-card--landing': isLanding,
          'kanban-card--flash': flashId === task.id,
        })}
        style={{ '--chip-c': listColor } as React.CSSProperties}
      >
        <CardBody
          task={task}
          menu={
            <div className="kanban-card-menu" data-open={menuOpen || undefined}>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground"
                    aria-label={`Task actions for ${task.title}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <TaskActionMenuItems
                    taskId={task.id}
                    taskCompleted={task.completed}
                    onSchedule={handleSchedule}
                    onDelete={handleDelete}
                    showScheduleTooltip={false}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      </div>
    );
  };

  /* ---------------- Column ---------------- */

  const Column: React.FC<{ keyId: ColumnKey }> = ({ keyId }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `col-${keyId}`,
      data: { columnKey: keyId },
    });
    const columnTasks = grouped[keyId];
    const isEmpty = columnTasks.length === 0;
    const dragging = drag !== null;
    const showGap = drag !== null && !isEmpty && isOver && drag.from !== keyId;
    // Whole-column drag-over wash (§2.4): faint aqua across the entire
    // target column, not just the insertion point.
    const isTarget = drag !== null && drag.from !== keyId;

    return (
      <section
        className={cn(
          'kanban-column h-full flex flex-col min-w-[calc(100vw-56px)] md:min-w-0',
          'snap-start md:snap-align-none',
          isTarget && 'kanban-column--target',
          isTarget && isOver && 'kanban-column--target-over'
        )}
        aria-label={COLUMN_LABELS[keyId]}
      >
        <header className="kanban-col-header">
          <StatusGlyph column={keyId} listColor={boardListColor} />
          <h3 className="kanban-col-label">{COLUMN_LABELS[keyId]}</h3>
          <span className="kanban-col-count">{columnTasks.length}</span>
          <Button
            variant="ghost"
            size="sm"
            className="kanban-col-add h-6 w-6 p-0 text-muted-foreground"
            aria-label={`New task in ${COLUMN_LABELS[keyId]}`}
            onClick={handleNewTask}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </header>

        <div
          ref={setNodeRef}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pt-1 pb-3 px-0.5"
          data-column-key={keyId}
        >
          {columnTasks.map((task) => (
            <DraggableCard key={task.id} task={task} column={keyId} />
          ))}

          {/* Gap opens in the target column (200ms, grid-rows only) */}
          {drag && !isEmpty && drag.from !== keyId && (
            <div className={cn('kanban-gap', showGap && 'kanban-gap--open')}>
              <div className="kanban-gap-inner">
                <div
                  className="kanban-gap-slot"
                  style={{ height: drag.height }}
                />
              </div>
            </div>
          )}

          {/* Empty column: ghost row at rest, etched target during drag */}
          {isEmpty &&
            (dragging ? (
              <div
                className={cn(
                  'kanban-drop-target',
                  isOver && 'kanban-drop-target--over'
                )}
              >
                <span className="kanban-drop-target-label" aria-hidden="true">
                  Drop a task here
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="kanban-ghost-new"
                onClick={handleNewTask}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New task
              </button>
            ))}
        </div>
      </section>
    );
  };

  /* ---------------- Mobile pager ---------------- */

  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    setPage(Math.min(2, Math.max(0, Math.round((el.scrollLeft / max) * 2))));
  }, []);

  const scrollToPage = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({
      left: (max / 2) * index,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full flex flex-col">
        {/* Columns as gutters: 16px gaps, transparent backgrounds, no rules */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-board-empty={(!tasksLoading && isBoardEmpty) || undefined}
          className={cn(
            'flex-1 min-h-0 flex overflow-x-auto gap-4 px-4 pt-4',
            'snap-x snap-mandatory',
            'md:grid md:grid-cols-3 md:overflow-x-visible md:snap-none'
          )}
        >
          {tasksLoading ? (
            COLUMN_ORDER.map((key) => (
              <div
                key={key}
                aria-hidden="true"
                className="flex-1 flex flex-col gap-2 min-w-0"
              >
                <div className="kanban-col-header">
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <Skeleton className="h-14 rounded-card" />
                <Skeleton className="h-14 rounded-card" />
              </div>
            ))
          ) : (
            <>
              <Column keyId="not_started" />
              <Column keyId="in_progress" />
              <Column keyId="done" />

              {isBoardEmpty && (
                <div className="kanban-board-empty">
                  <div
                    className="flex items-center gap-2 mb-3"
                    aria-hidden="true"
                  >
                    <span className="h-14 w-10 rounded-md border border-dashed border-etch-strong" />
                    <span className="h-14 w-10 rounded-md border border-dashed border-etch-strong" />
                    <span className="h-14 w-10 rounded-md border border-dashed border-etch-strong" />
                  </div>
                  <p className="font-serif text-lg leading-[1.3] text-ink">
                    Nothing on the board yet.
                  </p>
                  <p className="text-sm text-ink-muted mt-1">
                    Add a task to get moving.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={handleNewTask}
                  >
                    <Plus className="h-3.5 w-3.5" /> New task
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3 pager dots, mobile only */}
        <div className="kanban-pager flex md:hidden">
          {COLUMN_ORDER.map((key, i) => (
            <button
              key={key}
              type="button"
              className={cn(
                'kanban-pager-dot',
                page === i && 'kanban-pager-dot--active'
              )}
              aria-label={`Go to ${COLUMN_LABELS[key]}`}
              aria-current={page === i || undefined}
              onClick={() => scrollToPage(i)}
            />
          ))}
        </div>
      </div>

      {/* Pick-up: 160ms scale 1.03 rotate 1.5deg, shadow-3; the drop travels
          320ms on --ease-settle and lands with the aqua rim flash */}
      <DragOverlay
        dropAnimation={
          prefersReducedMotion()
            ? {
                duration: 120,
                easing: 'ease-out',
                keyframes: () => [{ opacity: 1 }, { opacity: 0 }],
              }
            : { duration: LAND_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        }
      >
        {drag ? (
          <div
            className={cn('kanban-card kanban-card--lifted', {
              'kanban-card--done':
                (moves[drag.task.id] ?? getTaskStatus(drag.task)) === 'done',
            })}
            style={
              {
                '--chip-c': drag.task.taskListId
                  ? listColorById[drag.task.taskListId]
                  : listColorById['default'],
              } as React.CSSProperties
            }
          >
            <CardBody task={drag.task} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Schedule dialog (fixes #44): Place -> Placed */}
      <ScheduleTaskDialog
        task={schedulingTask}
        open={schedulingTask !== null}
        onOpenChange={(open) => {
          if (!open) setSchedulingTask(null);
        }}
        onPlace={handlePlace}
      />
    </DndContext>
  );
};

export default TaskKanbanBoard;
