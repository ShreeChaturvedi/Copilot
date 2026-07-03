/**
 * TaskItem — the single task row used in all three list surfaces
 * (sidebar calendarMode, main list panes, kanban cards).
 * Redesigned per design-brief §4.1 (SETTLE): status ring, meta second
 * line, quick-schedule hover action, and the completion settle-out.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MoreVertical,
  MapPin,
  User,
  Tag,
  Flag,
  X,
  File as FileIcon,
  Image as ImageIcon,
  Music as MusicIcon,
  Video as VideoIcon,
  CornerDownRight,
  CalendarPlus,
} from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';
import { DEFAULT_PRESET_COLOR } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Task } from '@shared/types';
import { useCalendars } from '@/hooks/useCalendars';
import { useTasks } from '@/hooks/useTasks';
import { taskQueryKeys } from '@/hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { DueDateBadge } from './DueDateBadge';
import { TaskActionMenuItems } from './TaskActionMenuItems';
import AttachmentPreviewDialog from './AttachmentPreviewDialog';
import { attachmentsApi } from '@/services/api';
import TaskDetailSheet from './TaskDetailSheet';
import StatusBadge from './StatusBadge';
import StatusRing from './StatusRing';
import { useSettingsStore } from '@/stores/settingsStore';
import './task-item.css';

export interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onSchedule?: (id: string) => void;
  onRemoveTag?: (taskId: string, tagId: string) => void;
  groupColor?: string;
  className?: string;
  calendarMode?: boolean; // Hide tags when in calendar view
  /** Whether to show the task list label (emoji + name) inline with the title */
  showTaskListLabel?: boolean;
  /** Whether to hide checkboxes (for kanban view) */
  hideCheckbox?: boolean;
  /** Selected row: aqua film + left bar (design-brief §4.1) */
  selected?: boolean;
}

// Constants
const CONTEXT_MENU_OFFSET = 8;

/**
 * Completion timeline (design-brief §4.1), all times from click:
 *   0ms      ring stroke draws (160) -> fill pops (120) -> check draws (120)
 *   400ms    title strikes, row to 55% opacity (real class)
 *   1200ms   grace over (second click before this reverses) -> settle out
 *   +240ms   inner wrapper translateY(6px) scale(.985) fade (cal: 160 fade)
 *   +200ms   gap closes (grid-rows) -> commit onToggle
 */
const STRIKE_AT_MS = 400;
const GRACE_MS = 800;
const SETTLE_MS = 240;
const SETTLE_CAL_MS = 160;
const CLOSE_MS = 200;

type CompletionPhase = 'idle' | 'completing' | 'struck' | 'settling';

// Helper function to get the appropriate icon for each tag type
const getTagIcon = (type: string) => {
  switch (type) {
    case 'date':
    case 'time':
      return null; // Date/time tags are handled by DueDateBadge
    case 'priority':
      return Flag;
    case 'location':
      return MapPin;
    case 'person':
      return User;
    case 'label':
    case 'project':
    default:
      return Tag;
  }
};

// Type guard for calendar with default property
function hasDefaultProperty(
  calendar: unknown
): calendar is { isDefault?: boolean } {
  return typeof calendar === 'object' && calendar !== null;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onEdit,
  onDelete,
  onSchedule,
  onRemoveTag,
  groupColor,
  className,
  calendarMode = false,
  showTaskListLabel = false,
  hideCheckbox = false,
  selected = false,
}) => {
  // Consolidated UI state for better performance
  const [uiState, setUiState] = useState({
    isEditing: false,
    editTitle: task.title,
    dropdownOpen: false,
    contextMenuPosition: null as { x: number; y: number } | null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  // Calendars must be read via hook at top-level (Rules of Hooks)
  const { data: calendars = [] } = useCalendars();
  const { updateTask } = useTasks();
  const { taskGroups } = useTaskManagement({ includeTaskOperations: false });
  const taskCompletionControl = useSettingsStore(
    (s) => s.taskCompletionControl
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState<
    NonNullable<Task['attachments']>[number] | null
  >(null);
  const queryClient = useQueryClient();

  // Completion-moment state machine
  const [phase, setPhase] = useState<CompletionPhase>('idle');
  const [collapsed, setCollapsed] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const openAttachment = useCallback(
    (att: NonNullable<Task['attachments']>[number]) => {
      setActiveAttachment(att);
      setPreviewOpen(true);
    },
    []
  );

  const handleDownload = useCallback(
    async (att: NonNullable<Task['attachments']>[number]) => {
      try {
        const a = document.createElement('a');
        a.href = att.url; // Use stored URL directly; backend can later provide signed URLs if needed
        a.download = att.name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error('Download failed', e);
      }
    },
    []
  );

  const handleDeleteAttachment = useCallback(
    async (att: NonNullable<Task['attachments']>[number]) => {
      try {
        // Optimistically update cache
        queryClient.setQueriesData(
          { queryKey: taskQueryKeys.all },
          (oldData: Task[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    attachments: (t.attachments || []).filter(
                      (a) => a.id !== att.id
                    ),
                  }
                : t
            );
          }
        );

        await attachmentsApi.delete(att.id);

        setPreviewOpen(false);
        setActiveAttachment(null);
        // Optionally refetch tasks to ensure consistency
        queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      } catch (e) {
        console.error('Delete attachment failed', e);
      }
    },
    [task.id, queryClient]
  );

  /**
   * Ring click. Completing runs the §4.1 timeline with an 800ms grace
   * during which a second click reverses. Un-completing and
   * keyboard-initiated toggles commit immediately (§5: never animate
   * keyboard-initiated actions).
   */
  const handleToggle = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (task.completed) {
      onToggle(task.id);
      return;
    }
    if (phase === 'settling') return; // past the grace; committing
    if (phase !== 'idle') {
      // Second click during the grace window: reverse
      clearTimers();
      setPhase('idle');
      return;
    }
    if (e && e.detail === 0) {
      // Keyboard-initiated: commit without the theater
      onToggle(task.id);
      return;
    }
    const settleMs = calendarMode ? SETTLE_CAL_MS : SETTLE_MS;
    const settleAt = STRIKE_AT_MS + GRACE_MS;
    setPhase('completing');
    timersRef.current = [
      setTimeout(() => setPhase('struck'), STRIKE_AT_MS),
      setTimeout(() => setPhase('settling'), settleAt),
      setTimeout(() => setCollapsed(true), settleAt + settleMs),
      setTimeout(
        () => {
          onToggle(task.id);
          setPhase('idle');
          setCollapsed(false);
        },
        settleAt + settleMs + CLOSE_MS
      ),
    ];
  };

  const handleDelete = useCallback(() => {
    onDelete(task.id);
  }, [task.id, onDelete]);

  const [detailOpen, setDetailOpen] = useState(false);
  const handleEditStart = useCallback(() => {
    if (calendarMode) {
      setUiState((prev) => ({
        ...prev,
        isEditing: true,
        editTitle: task.title,
      }));
      return;
    }
    // In task view (right pane), clicking title opens Task Detail Sheet
    setDetailOpen(true);
  }, [task.title, calendarMode]);

  const handleEditSave = useCallback(() => {
    const trimmedTitle = uiState.editTitle.trim();
    if (trimmedTitle && trimmedTitle !== task.title) {
      onEdit(task.id, trimmedTitle);
    }
    setUiState((prev) => ({ ...prev, isEditing: false }));
  }, [uiState.editTitle, task.title, task.id, onEdit]);

  const handleEditCancel = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      editTitle: task.title,
      isEditing: false,
    }));
  }, [task.title]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (calendarMode && !uiState.isEditing) {
        e.preventDefault();
        setUiState((prev) => ({
          ...prev,
          contextMenuPosition: {
            x: e.clientX + CONTEXT_MENU_OFFSET,
            y: e.clientY + CONTEXT_MENU_OFFSET,
          },
          dropdownOpen: true,
        }));
      }
    },
    [calendarMode, uiState.isEditing]
  );

  // Clean up context menu position when dropdown closes
  useEffect(() => {
    if (!uiState.dropdownOpen) {
      setUiState((prev) => ({ ...prev, contextMenuPosition: null }));
    }
  }, [uiState.dropdownOpen]);

  useEffect(() => {
    if (uiState.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [uiState.isEditing]);

  // Pure FullCalendar drag setup - no conflicts
  const dragElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      calendarMode &&
      dragElementRef.current &&
      !task.completed &&
      !uiState.isEditing
    ) {
      const element = dragElementRef.current;
      // Prefer current default calendar color; fall back to group color and a safe default
      const defaultCal =
        calendars.find((c) => hasDefaultProperty(c) && c.isDefault) ||
        calendars[0];
      const defaultCalendarColor = defaultCal?.color;
      const dragColor =
        defaultCalendarColor || groupColor || DEFAULT_PRESET_COLOR;

      const draggable = new Draggable(element, {
        eventData: {
          title: task.title,
          duration: '01:00',
          backgroundColor: dragColor,
          borderColor: dragColor,
          textColor: '#ffffff',
          extendedProps: {
            taskId: task.id,
            isFromTask: true,
            originalTask: task,
          },
        },
      });

      // Scope the transition-kill (index.css) to an active drag only. Adding
      // `is-dragging` on dragstart (before FullCalendar lazily clones the row
      // into its drag mirror) means the mirror clone inherits the class, so
      // the mirror doesn't ghost, while at-rest rows keep their transitions.
      const handleDragStart = () => element.classList.add('is-dragging');
      const handleDragEnd = () => element.classList.remove('is-dragging');
      draggable.dragging.emitter.on('dragstart', handleDragStart);
      draggable.dragging.emitter.on('dragend', handleDragEnd);

      return () => {
        draggable.dragging.emitter.off('dragstart', handleDragStart);
        draggable.dragging.emitter.off('dragend', handleDragEnd);
        element.classList.remove('is-dragging');
        draggable.destroy();
      };
    }
  }, [
    calendarMode,
    task.id,
    task.completed,
    task.title,
    uiState.isEditing,
    groupColor,
    task,
    calendars,
  ]);

  // Derived render state
  // THE row's list color (brief §4.1: ring hover/fill use the row's list
  // color) — resolve from the task's own list first; the groupColor prop is
  // the surrounding pane's group and can be a different list in "All Tasks".
  const rowListColor =
    taskGroups.find((group) => group.id === (task.taskListId ?? 'default'))
      ?.color ?? groupColor;
  const struck = task.completed || phase === 'struck' || phase === 'settling';
  const ringStatus: 'rest' | 'in-progress' | 'done' =
    task.completed || phase !== 'idle'
      ? 'done'
      : task.status === 'in_progress'
        ? 'in-progress'
        : 'rest';

  const visibleTags = (task.tags ?? []).filter(
    (tag) => tag.type !== 'date' && tag.type !== 'time'
  );
  const shownTags = visibleTags.slice(0, 2);
  const extraTagCount = visibleTags.length - shownTags.length;
  const attachments = task.attachments ?? [];
  const shownAttachments = attachments.slice(0, 2);
  const extraAttachmentCount = attachments.length - shownAttachments.length;
  const hasMeta =
    !calendarMode &&
    (Boolean(task.scheduledDate) ||
      visibleTags.length > 0 ||
      attachments.length > 0);

  const showQuickSchedule = Boolean(onSchedule) && !task.completed;

  return (
    <div className="ti-shell" data-collapsed={collapsed || undefined}>
      <div className="ti-clip">
        <div
          ref={dragElementRef}
          className={cn(
            'group/task ti-row',
            calendarMode &&
              !task.completed &&
              !uiState.isEditing &&
              'cursor-grab',
            className
          )}
          data-in-card={hideCheckbox || undefined}
          data-selected={selected || undefined}
          tabIndex={hideCheckbox ? undefined : 0}
          style={
            calendarMode
              ? {
                  // FullCalendar Draggable rows must never carry a transform
                  transform: 'none',
                }
              : undefined
          }
          onContextMenu={handleContextMenu}
        >
          {/* Inner wrapper: the ONLY element the completion keyframes touch
              (never the Draggable row root) */}
          <div
            className="ti-inner"
            data-phase={phase}
            data-struck={struck || undefined}
            data-cal={calendarMode || undefined}
          >
            <div className="ti-grid" data-no-ring={hideCheckbox || undefined}>
              {/* Completion control: status ring (default) or status tag,
                  honoring the settings toggle */}
              {!hideCheckbox &&
                (taskCompletionControl === 'checkbox' ? (
                  <StatusRing
                    status={ringStatus}
                    animating={phase === 'completing'}
                    checked={task.completed || phase !== 'idle'}
                    listColor={rowListColor}
                    aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
                    onClick={handleToggle}
                  />
                ) : (
                  <StatusBadge
                    task={task}
                    iconOnly
                    className="flex-shrink-0"
                    onChange={(status) =>
                      updateTask.mutate({ id: task.id, updates: { status } })
                    }
                  />
                ))}

              {/* Title cell */}
              <div className="min-w-0 flex items-center gap-2">
                {uiState.isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    id={`task-edit-${task.id}`}
                    name={`task-edit-${task.id}`}
                    value={uiState.editTitle}
                    onChange={(e) =>
                      setUiState((prev) => ({
                        ...prev,
                        editTitle: e.target.value,
                      }))
                    }
                    onBlur={handleEditSave}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      'w-full bg-transparent border border-transparent outline-none text-foreground',
                      'text-[13px] font-medium leading-5 focus:border-primary/30 rounded px-0 py-0'
                    )}
                    aria-label="Edit task title"
                  />
                ) : (
                  <div
                    onClick={handleEditStart}
                    className="cursor-pointer flex items-center w-full min-w-0"
                  >
                    <span
                      className={cn(
                        'ti-title truncate min-w-0',
                        struck && 'line-through'
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                    {/* Task list context - inline label with icon */}
                    {showTaskListLabel &&
                      !calendarMode &&
                      (() => {
                        const resolvedGroupId = task.taskListId ?? 'default';
                        const taskList =
                          taskGroups.find(
                            (group) => group.id === resolvedGroupId
                          ) ||
                          (!task.taskListId
                            ? {
                                id: 'default',
                                name: 'Tasks',
                                emoji: '📋',
                                color: DEFAULT_PRESET_COLOR,
                              }
                            : undefined);
                        return taskList ? (
                          <span
                            className={cn(
                              'group/label relative inline-flex items-center gap-1.5 ml-2 flex-shrink-0',
                              'cursor-pointer text-xs text-muted-foreground',
                              'transition-opacity duration-150 ease-out opacity-70 hover:opacity-100'
                            )}
                          >
                            <CornerDownRight className="w-3 h-3 opacity-70" />
                            <span className="text-sm leading-none">
                              {taskList.emoji}
                            </span>
                            <span className="inline-block whitespace-nowrap">
                              {taskList.name}
                            </span>
                          </span>
                        ) : null;
                      })()}
                  </div>
                )}
              </div>

              {/* Hover actions: quick-schedule (visible path to a date, #45)
                  + 3-dot menu. Opacity-only reveal, hover-gated in CSS. */}
              <div className="ti-actions">
                {showQuickSchedule && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label={`Schedule "${task.title}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSchedule?.(task.id);
                    }}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                  </Button>
                )}
                {!calendarMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Task options for "${task.title}"`}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      side="right"
                      className="w-48"
                    >
                      <TaskActionMenuItems
                        taskId={task.id}
                        taskCompleted={task.completed}
                        onSchedule={onSchedule}
                        onDelete={handleDelete}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Meta second line: only when data exists (§4.1). Due chip,
                  tags max 2 + `+N` mono, compact attachment chips. */}
              {hasMeta && (
                <div className="ti-cell-meta">
                  {task.scheduledDate && (
                    <DueDateBadge
                      taskId={task.id}
                      date={task.scheduledDate}
                      onChange={(newDate) =>
                        updateTask.mutate({
                          id: task.id,
                          updates: { scheduledDate: newDate },
                        })
                      }
                    />
                  )}

                  {shownTags.map((tag) => {
                    const IconComponent = getTagIcon(
                      tag.type
                    ) as React.ComponentType<{
                      className?: string;
                    }> | null;
                    return (
                      <span
                        key={`${tag.id}_${String(tag.value)}`}
                        className={cn(
                          'ti-tag group/tag',
                          onRemoveTag && 'cursor-pointer'
                        )}
                        style={
                          tag.color
                            ? ({
                                '--tag-c': tag.color,
                              } as React.CSSProperties)
                            : undefined
                        }
                        onClick={
                          onRemoveTag
                            ? (e) => {
                                e.stopPropagation();
                                onRemoveTag(task.id, tag.id);
                              }
                            : undefined
                        }
                      >
                        {/* Icon that becomes X on hover - same size, no layout shift */}
                        <span className="w-3 h-3 relative inline-block">
                          {IconComponent && (
                            <IconComponent className="w-3 h-3 absolute inset-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-0" />
                          )}
                          {onRemoveTag && (
                            <X className="w-3 h-3 absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-100" />
                          )}
                        </span>
                        <span className="truncate">{tag.displayText}</span>
                      </span>
                    );
                  })}
                  {extraTagCount > 0 && (
                    <span
                      className="ti-more"
                      title={visibleTags
                        .slice(2)
                        .map((t) => t.displayText)
                        .join(', ')}
                    >
                      +{extraTagCount}
                    </span>
                  )}

                  {shownAttachments.map((att) => {
                    const isImage = att.type?.startsWith('image/');
                    const isAudio = att.type?.startsWith('audio/');
                    const isVideo = att.type?.startsWith('video/');
                    const Icon = isImage
                      ? ImageIcon
                      : isAudio
                        ? MusicIcon
                        : isVideo
                          ? VideoIcon
                          : FileIcon;

                    return (
                      <button
                        key={att.id}
                        type="button"
                        className="ti-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttachment(att);
                        }}
                        title={`Preview ${att.name}`}
                      >
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        <span className="max-w-[96px] truncate inline-block">
                          {att.name}
                        </span>
                      </button>
                    );
                  })}
                  {extraAttachmentCount > 0 && (
                    <span className="ti-more">+{extraAttachmentCount}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar mode: cursor-positioned context menu */}
      {calendarMode && uiState.contextMenuPosition && (
        <div
          className="fixed z-50"
          style={{
            left: uiState.contextMenuPosition.x,
            top: uiState.contextMenuPosition.y,
          }}
        >
          <DropdownMenu
            open={uiState.dropdownOpen}
            onOpenChange={(open) =>
              setUiState((prev) => ({ ...prev, dropdownOpen: open }))
            }
          >
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-48">
              <TaskActionMenuItems
                taskId={task.id}
                taskCompleted={task.completed}
                onSchedule={onSchedule}
                onDelete={handleDelete}
                showScheduleTooltip={false}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Attachment Preview Dialog */}
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        attachment={activeAttachment}
        onDelete={(att) => handleDeleteAttachment(att)}
        onDownload={(att) => handleDownload(att)}
      />

      {/* Task Detail Sheet for right pane task view */}
      {!calendarMode && (
        <TaskDetailSheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={task}
          onEdit={() => {
            setDetailOpen(false);
            setUiState((prev) => ({
              ...prev,
              isEditing: true,
              editTitle: task.title,
            }));
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default TaskItem;
