/**
 * TaskItem - Professional design matching screenshot
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
} from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useSettingsStore } from '@/stores/settingsStore';

// StatusBadge now a separate component

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
}

// Constants
const CONTEXT_MENU_OFFSET = 8;
const COMPLETED_TASK_OPACITY = 0.6;

// (file type color helpers removed; handled elsewhere)

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

  const handleToggle = () => {
    onToggle(task.id);
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
      const dragColor = defaultCalendarColor || groupColor || '#3788d8';

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

      return () => {
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

  return (
    <div className="relative">
      <div
        ref={dragElementRef}
        className={cn(
          'group/task py-2 px-3 rounded-md',
          calendarMode &&
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          calendarMode &&
            !task.completed &&
            !uiState.isEditing &&
            'cursor-grab',
          className
        )}
        style={
          calendarMode
            ? {
                transition: 'none',
                transform: 'none',
                animation: 'none',
              }
            : undefined
        }
        onContextMenu={handleContextMenu}
      >
        {/* Top row: checkbox, title, actions */}
        <div className="flex items-center gap-3">
          {/* Completion control: either checkbox or status icon (icon-only badge), depending on settings. */}
          {!hideCheckbox &&
            (taskCompletionControl === 'checkbox' ? (
              <Checkbox
                checked={task.completed}
                onCheckedChange={handleToggle}
                aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
                className="flex-shrink-0"
                customColor={task.completed ? groupColor : undefined}
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

          <div className="flex-1 min-w-0 flex items-center gap-2">
            {/* No secondary inline status badge when using list view controls. The primary control is either the checkbox or the icon-only status badge rendered on the left. */}
            {uiState.isEditing ? (
              <input
                ref={inputRef}
                type="text"
                id={`task-edit-${task.id}`}
                name={`task-edit-${task.id}`}
                value={uiState.editTitle}
                onChange={(e) =>
                  setUiState((prev) => ({ ...prev, editTitle: e.target.value }))
                }
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-full bg-transparent border border-transparent outline-none text-foreground',
                  'text-sm font-medium focus:border-primary/30 rounded px-1 py-0.5',
                  'h-[1.25rem] leading-5 box-border flex items-center'
                )}
                aria-label="Edit task title"
              />
            ) : (
              <div
                onClick={handleEditStart}
                className={cn(
                  'cursor-pointer text-sm font-medium transition-colors duration-200',
                  'px-1 py-0.5 h-[1.25rem] leading-5 rounded box-border',
                  'flex items-center w-full',
                  task.completed &&
                    `line-through text-muted-foreground opacity-[${COMPLETED_TASK_OPACITY}]`
                )}
                title={task.title}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
                    {task.title}
                  </span>
                  {/* Task list context - LEFT ALIGNED inline label with icon */}
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
                              color: '#3b82f6',
                            }
                          : undefined);
                      return taskList ? (
                        <span
                          className={cn(
                            'group/label relative inline-flex items-center gap-1.5 text-sm ml-2 flex-shrink-0',
                            'cursor-pointer text-foreground opacity-60',
                            'transition-opacity duration-150 ease-out',
                            'hover:opacity-100'
                          )}
                        >
                          <CornerDownRight className="w-3 h-3 opacity-70" />
                          <span className="text-base">{taskList.emoji}</span>
                          <span className="inline-block whitespace-nowrap">
                            {taskList.name}
                          </span>
                        </span>
                      ) : null;
                    })()}
                </div>
              </div>
            )}
          </div>

          {/* Three-dot button - only shown in non-calendar mode */}
          {!calendarMode && (
            <div className="flex items-center opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 relative">
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
            </div>
          )}
        </div>

        {/* Tags - Hidden in calendar mode */}
        {!calendarMode && (
          <div className={cn('mt-1 space-y-1', !hideCheckbox && 'ml-7')}>
            {/* First row: Due date and other tags - Horizontal scrolling */}
            <ScrollArea className="w-full" orientation="horizontal">
              <div
                className="flex flex-nowrap gap-1 pb-1 min-w-max"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {/* Canonical Due Date tag - only render when set */}
                {task.scheduledDate && (
                  <div className="flex-shrink-0">
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
                  </div>
                )}

                {/* Show non-date/time smart tags */}
                {task.tags
                  ?.filter((tag) => tag.type !== 'date' && tag.type !== 'time')
                  .map((tag) => {
                    const IconComponent = getTagIcon(
                      tag.type
                    ) as React.ComponentType<{
                      className?: string;
                      style?: React.CSSProperties;
                    }>;
                    return (
                      <div
                        key={`${tag.id}_${String(tag.value)}`}
                        className="flex-shrink-0"
                      >
                        <Badge
                          variant="outline"
                          size="md"
                          className={cn(
                            'text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50 transition-all duration-100 ease-out group/tag',
                            onRemoveTag && 'cursor-pointer',
                            tag.color &&
                              `border-[${tag.color}]/30 text-[${tag.color}]`
                          )}
                          style={
                            tag.color
                              ? {
                                  borderColor: `${tag.color}30`,
                                  color: tag.color,
                                  backgroundColor: `${tag.color}1A`,
                                }
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
                          <div className="w-3 h-3 relative">
                            {IconComponent && (
                              <IconComponent
                                className="w-3 h-3 absolute inset-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-0"
                                style={{ color: tag.color }}
                              />
                            )}
                            {onRemoveTag && (
                              <X
                                className="w-3 h-3 absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-100"
                                style={{ color: tag.color }}
                              />
                            )}
                          </div>
                          {tag.displayText}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>

            {/* Second row: Attachments preview (compact) - Horizontal scrolling */}
            {task.attachments && task.attachments.length > 0 && (
              <ScrollArea className="w-full">
                <div
                  className="flex flex-nowrap items-center gap-1 pb-1 min-w-max"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {task.attachments.map((att) => {
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
                      <div key={att.id} className="flex-shrink-0">
                        <Badge
                          variant="outline"
                          size="md"
                          className={cn(
                            'text-muted-foreground border-muted-foreground/30 cursor-pointer',
                            'hover:border-muted-foreground/50 transition-all duration-150 group/attachment'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAttachment(att);
                          }}
                          title={`Preview ${att.name}`}
                        >
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          <span className="max-w-[120px] truncate inline-block align-middle">
                            {att.name}
                          </span>
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Intentionally remove the legacy auto-created creation date badge */}
          </div>
        )}
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
