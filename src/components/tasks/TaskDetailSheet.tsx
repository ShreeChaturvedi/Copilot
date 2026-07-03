import React, { useCallback, useMemo, useRef, useState } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { MapPin, Paperclip, FileText, Plus, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { CustomTimeInput } from '@/components/ui/CustomTimeInput';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IntegratedActionBar } from '@/components/dialogs/IntegratedActionBar';
import { cn } from '@/lib/utils';
import { DEFAULT_PRESET_COLOR } from '@/constants/colors';
import type { FileAttachment, Task, TaskTag, Priority } from '@shared/types';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import AttachmentPreviewDialog from './AttachmentPreviewDialog';
import { attachmentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { taskQueryKeys } from '@/hooks/useTasks';

// Reuse the compact file preview UI from EnhancedTaskInput
import { DefaultPreview } from '@/components/smart-input/components/previews/DefaultPreview';
import { useTasks } from '@/hooks/useTasks';
import StatusBadge from './StatusBadge';
import './task-item.css';
import './task-detail-sheet.css';

/* ----------------------------------------------------------------------------
 * Permanent field rows (#45): SCHEDULE, PRIORITY, LIST, TAGS are always
 * drawn. Unset fields render etched (SSM 11 label in --etch-text + a dashed
 * ghost slot), per design-brief §4.5 / §2.5: unset is drawn, not hidden.
 * Every control writes through the real task update API.
 * ------------------------------------------------------------------------- */

interface TaskListOption {
  id: string;
  name: string;
  color: string;
}

function useTaskListOptions(): TaskListOption[] {
  const query = useQuery({
    // Same key as useTaskManagement's list query so React Query dedupes
    queryKey: ['task-lists', { withTaskCount: false }],
    queryFn: async () => {
      // Refresh a stale JWT first so an expired access token is exchanged
      // (via the refresh token) instead of dropped, which the server would
      // reject with "Missing or invalid authorization header".
      await useAuthStore.getState().refreshTokenIfNeeded();
      const token = useAuthStore.getState().getValidAccessToken();
      const res = await fetch('/api/task-lists', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!(res.headers.get('content-type') || '').includes('json')) return [];
      const body = await res.json();
      if (!res.ok || !body.success) return [];
      const items = Array.isArray(body.data?.data)
        ? body.data.data
        : Array.isArray(body.data)
          ? body.data
          : [];
      return items.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        name: String(item.name ?? 'Tasks'),
        emoji: String(item.icon ?? ''),
        color: String(item.color ?? DEFAULT_PRESET_COLOR),
      }));
    },
    staleTime: 30_000,
  });
  return (query.data as TaskListOption[] | undefined) ?? [];
}

function FieldRow({
  label,
  isSet,
  children,
}: {
  label: string;
  isSet: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-3 min-h-9">
      <span
        className={cn(
          'font-mono text-[11px] uppercase tracking-[0.06em] select-none',
          isSet ? 'text-ink-muted' : 'text-etch-text'
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex items-center">{children}</div>
    </div>
  );
}

/** Dashed etched slot for an unset value (§2.5: dashed = planned/not yet real) */
const ghostTriggerClass = cn(
  'inline-flex items-center gap-1.5 rounded-md border border-dashed border-etch-strong',
  'px-2.5 py-1 text-[13px] text-faint',
  'hover:bg-surface-hover hover:text-ink-muted transition-colors duration-150',
  'outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'
);

const setTriggerClass = cn(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 text-[13px] text-ink',
  'hover:bg-surface-hover transition-colors duration-150',
  'outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'
);

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** Ascending fill count per priority — feeds PrioritySignalBars. */
const PRIORITY_LEVEL: Record<Priority, 1 | 2 | 3> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Neutral signal-strength glyph (design-brief Craft): `currentColor` for
 * filled bars, `--hairline-strong` for the unfilled remainder. Deliberately
 * no red/amber/green mapping — priority isn't one of §1.6's five sanctioned
 * aqua uses, and a traffic-light scheme would plant a second saturated-color
 * system next to the one this app is disciplined about. `currentColor` means
 * it inherits the trigger's own ink color (set vs. ghost) for free.
 */
function PrioritySignalBars({ level }: { level: 0 | 1 | 2 | 3 }) {
  const heights = [5, 8, 12];
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="shrink-0"
    >
      {heights.map((h, i) => (
        <rect
          key={h}
          x={1 + i * 4}
          y={12 - h}
          width="2"
          height={h}
          rx="0.5"
          fill={i < level ? 'currentColor' : 'var(--hairline-strong)'}
        />
      ))}
    </svg>
  );
}

export interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  className?: string;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  open,
  onOpenChange,
  task,
  onEdit,
  onDelete,
  className,
}) => {
  const { peekMode, setPeekMode } = useUIStore();
  const { updateTask } = useTasks();
  const queryClient = useQueryClient();
  const taskLists = useTaskListOptions();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeAttachment, setActiveAttachment] =
    useState<FileAttachment | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const descriptionEditActiveRef = useRef(false);

  const handlePeekToggle = useCallback(() => {
    setPeekMode(peekMode === 'center' ? 'right' : 'center');
  }, [peekMode, setPeekMode]);

  const openAttachment = useCallback((att: FileAttachment) => {
    setActiveAttachment(att);
    setPreviewOpen(true);
  }, []);

  const handleDownload = useCallback(async (att: FileAttachment) => {
    try {
      const a = document.createElement('a');
      a.href = att.url;
      a.download = att.name || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Download failed', e);
    }
  }, []);

  const handleDeleteAttachment = useCallback(
    async (att: FileAttachment) => {
      try {
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
        queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      } catch (e) {
        console.error('Delete attachment failed', e);
      }
    },
    [task.id, queryClient]
  );

  const locationTag = useMemo(
    () => task.tags?.find((t) => t.type === 'location'),
    [task.tags]
  );
  const labelTags = useMemo(
    () =>
      (task.tags || []).filter(
        (t) => t.type !== 'date' && t.type !== 'time' && t.type !== 'location'
      ),
    [task.tags]
  );

  const currentList = useMemo(
    () => taskLists.find((l) => l.id === task.taskListId),
    [taskLists, task.taskListId]
  );

  /* ---- field mutations (all through the real update API) ---- */

  const setSchedule = useCallback(
    (date: Date | null) => {
      updateTask.mutate({ id: task.id, updates: { scheduledDate: date } });
    },
    [task.id, updateTask]
  );

  const handleDaySelect = useCallback(
    (day: Date | undefined) => {
      if (!day) return;
      const next = new Date(day);
      if (task.scheduledDate) {
        // Keep the existing time of day when only the date changes
        const prev = new Date(task.scheduledDate);
        next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      } else {
        next.setHours(0, 0, 0, 0);
      }
      setSchedule(next);
    },
    [task.scheduledDate, setSchedule]
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value; // "HH:mm" or ""
      const base = task.scheduledDate
        ? new Date(task.scheduledDate)
        : new Date();
      if (!value) {
        base.setHours(0, 0, 0, 0);
        setSchedule(base);
        return;
      }
      const [h, m] = value.split(':').map(Number);
      base.setHours(h, m, 0, 0);
      setSchedule(base);
    },
    [task.scheduledDate, setSchedule]
  );

  const setPriority = useCallback(
    (priority: Priority) => {
      updateTask.mutate({ id: task.id, updates: { priority } });
    },
    [task.id, updateTask]
  );

  const setList = useCallback(
    (taskListId: string) => {
      updateTask.mutate({ id: task.id, updates: { taskListId } });
    },
    [task.id, updateTask]
  );

  const replaceTags = useCallback(
    (tags: TaskTag[]) => {
      updateTask.mutate({ id: task.id, updates: { tags } });
    },
    [task.id, updateTask]
  );

  const addTag = useCallback(() => {
    const value = tagDraft.trim().replace(/^#/, '');
    if (!value) return;
    const exists = (task.tags || []).some(
      (t) =>
        t.type === 'label' &&
        String(t.value).toLowerCase() === value.toLowerCase()
    );
    if (!exists) {
      const newTag: TaskTag = {
        id: `tag-${Date.now()}`,
        type: 'label',
        value,
        displayText: `#${value}`,
        iconName: 'Tag',
      };
      replaceTags([...(task.tags || []), newTag]);
    }
    setTagDraft('');
    setAddTagOpen(false);
  }, [tagDraft, task.tags, replaceTags]);

  const removeTag = useCallback(
    (tagId: string) => {
      replaceTags((task.tags || []).filter((t) => t.id !== tagId));
    },
    [task.tags, replaceTags]
  );

  const descriptionText = String(
    task.description || task.parsedMetadata?.originalInput || ''
  );

  const startEditingDescription = useCallback(() => {
    setDescriptionDraft(descriptionText);
    descriptionEditActiveRef.current = true;
    setIsEditingDescription(true);
  }, [descriptionText]);

  const saveDescription = useCallback(() => {
    if (!descriptionEditActiveRef.current) return;
    descriptionEditActiveRef.current = false;
    setIsEditingDescription(false);
    setDescriptionDraft((draft) => {
      const next = draft.trim();
      if (next !== descriptionText) {
        updateTask.mutate({ id: task.id, updates: { description: next } });
      }
      return draft;
    });
  }, [descriptionText, task.id, updateTask]);

  const cancelEditingDescription = useCallback(() => {
    descriptionEditActiveRef.current = false;
    setIsEditingDescription(false);
  }, []);

  /* ---- display helpers ---- */

  const scheduled = task.scheduledDate ? new Date(task.scheduledDate) : null;
  const scheduledHasTime =
    !!scheduled && (scheduled.getHours() !== 0 || scheduled.getMinutes() !== 0);
  const scheduleInk = scheduled
    ? isBefore(scheduled, startOfDay(new Date())) && !task.completed
      ? 'text-destructive'
      : isToday(scheduled)
        ? 'text-aqua'
        : 'text-ink'
    : '';

  const metaCaption = [
    `Created ${format(new Date(task.createdAt), 'MMM d, yyyy')}`,
    task.updatedAt &&
    new Date(task.updatedAt).getTime() !== new Date(task.createdAt).getTime()
      ? `Updated ${format(new Date(task.updatedAt), 'MMM d, yyyy')}`
      : null,
    task.completed && task.completedAt
      ? `Completed ${format(new Date(task.completedAt), 'MMM d, yyyy')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleEdit = useCallback(() => {
    onEdit?.(task.id);
  }, [onEdit, task.id]);

  const handleDelete = useCallback(() => {
    onDelete?.(task.id);
  }, [onDelete, task.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'w-full sm:max-w-lg md:max-w-xl p-5 overflow-y-auto [&>button]:hidden',
          className
        )}
      >
        <SheetDescription className="sr-only">
          Task details for {task.title}
        </SheetDescription>
        {/* Header: Title + action bar (Edit / Delete / Close) */}
        <div className="flex items-start justify-between gap-2 pb-4 mb-1 border-b border-hairline">
          <SheetTitle
            className="text-lg font-semibold leading-tight tracking-[-0.01em] line-clamp-2"
            title={task.title}
          >
            {task.title}
          </SheetTitle>
          <div className="flex-shrink-0">
            <IntegratedActionBar
              peekMode={peekMode}
              onPeekModeToggle={handlePeekToggle}
              onEdit={onEdit ? handleEdit : undefined}
              onDelete={onDelete ? handleDelete : undefined}
              onClose={() => onOpenChange(false)}
              isDeleting={false}
              showPeekToggle={false}
              subject="task"
            />
          </div>
        </div>

        {/* Permanent field rows (#45): drawn whether set or not */}
        <div className="mt-4 space-y-2">
          <FieldRow label="Status" isSet>
            <StatusBadge
              task={task}
              onChange={(status) =>
                updateTask.mutate({ id: task.id, updates: { status } })
              }
              className="border-transparent bg-transparent -mx-2 px-2 hover:bg-surface-hover hover:border-transparent"
            />
          </FieldRow>

          <FieldRow label="Schedule" isSet={!!scheduled}>
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={scheduled ? setTriggerClass : ghostTriggerClass}
                  aria-label={
                    scheduled
                      ? `Change date, currently ${format(scheduled, 'EEEE, MMMM d')}`
                      : 'Set a date'
                  }
                >
                  {scheduled ? (
                    <span
                      className={cn(
                        'font-mono text-xs uppercase tracking-[0.02em]',
                        scheduleInk
                      )}
                    >
                      {format(scheduled, 'EEE, MMM d')}
                      {scheduledHasTime
                        ? ` · ${format(scheduled, 'h:mm a')}`
                        : ''}
                    </span>
                  ) : (
                    'No date'
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={scheduled ?? undefined}
                  onSelect={handleDaySelect}
                  initialFocus
                />
                <div className="flex items-center gap-2 border-t border-hairline p-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    Time
                  </span>
                  <CustomTimeInput
                    value={
                      scheduled && scheduledHasTime
                        ? format(scheduled, 'HH:mm')
                        : ''
                    }
                    onChange={handleTimeChange}
                    className="h-8 w-28 font-mono text-xs"
                  />
                  {scheduled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-ink-muted"
                      onClick={() => {
                        setSchedule(null);
                        setScheduleOpen(false);
                      }}
                    >
                      Remove date
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </FieldRow>

          <FieldRow label="Priority" isSet={!!task.priority}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={
                    task.priority ? setTriggerClass : ghostTriggerClass
                  }
                  aria-label={
                    task.priority
                      ? `Change priority, currently ${PRIORITY_LABELS[task.priority]}`
                      : 'Set a priority'
                  }
                >
                  <PrioritySignalBars
                    level={task.priority ? PRIORITY_LEVEL[task.priority] : 0}
                  />
                  {task.priority
                    ? PRIORITY_LABELS[task.priority]
                    : 'No priority'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36">
                {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'cursor-pointer',
                      task.priority === p && 'bg-accent text-accent-foreground'
                    )}
                  >
                    {PRIORITY_LABELS[p]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </FieldRow>

          <FieldRow label="List" isSet={!!currentList}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={currentList ? setTriggerClass : ghostTriggerClass}
                  aria-label={
                    currentList
                      ? `Move to another list, currently in ${currentList.name}`
                      : 'Add to a list'
                  }
                >
                  {currentList ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: currentList.color }}
                      />
                      <span className="truncate">{currentList.name}</span>
                    </>
                  ) : (
                    'No list'
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {taskLists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={() => setList(list.id)}
                    className={cn(
                      'cursor-pointer gap-2',
                      list.id === task.taskListId &&
                        'bg-accent text-accent-foreground'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="truncate">{list.name}</span>
                  </DropdownMenuItem>
                ))}
                {taskLists.length === 0 && (
                  <DropdownMenuItem disabled>No lists yet</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </FieldRow>

          <FieldRow label="Tags" isSet={labelTags.length > 0}>
            <div className="flex flex-wrap items-center gap-1.5">
              {labelTags.map((tag) => (
                <span
                  key={tag.id}
                  className="ti-tag group/tag"
                  style={
                    {
                      '--tag-c': tag.color || DEFAULT_PRESET_COLOR,
                    } as React.CSSProperties
                  }
                >
                  {tag.displayText}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag.displayText}`}
                    className="opacity-50 hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
                    onClick={() => removeTag(tag.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Popover open={addTagOpen} onOpenChange={setAddTagOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={
                      labelTags.length > 0
                        ? cn(setTriggerClass, 'text-ink-muted mx-0 px-1.5')
                        : ghostTriggerClass
                    }
                    aria-label="Add tag"
                  >
                    {labelTags.length > 0 ? (
                      <Plus className="h-3.5 w-3.5" />
                    ) : (
                      'No tags'
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTag();
                    }}
                  >
                    <Input
                      autoFocus
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      placeholder="Tag name"
                      aria-label="Tag name"
                      className="h-8 text-[13px]"
                    />
                  </form>
                </PopoverContent>
              </Popover>
            </div>
          </FieldRow>
        </div>

        {/* Content rows: render only when data exists */}
        <div className="space-y-5 mt-6 border-t border-hairline pt-5">
          {/* Description — click to edit, the one primary field this sheet
              can't otherwise edit inline. */}
          {task.description || task.parsedMetadata?.originalInput ? (
            <div className="flex items-start gap-3">
              <div className="text-ink-muted flex-shrink-0 mt-1">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingDescription ? (
                  <Textarea
                    autoFocus
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onBlur={saveDescription}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEditingDescription();
                      } else if (
                        (e.metaKey || e.ctrlKey) &&
                        e.key === 'Enter'
                      ) {
                        e.preventDefault();
                        saveDescription();
                      }
                    }}
                    placeholder="Add a description…"
                    className="min-h-20 text-sm"
                  />
                ) : (
                  <div
                    className="text-sm whitespace-pre-wrap cursor-pointer hover:bg-surface-hover rounded-md -mx-2 px-2 py-1 transition-colors"
                    onClick={startEditingDescription}
                  >
                    {descriptionText}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Location */}
          {locationTag && (
            <div className="flex items-center gap-3">
              <div className="text-ink-muted flex-shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm">{String(locationTag.value)}</p>
              </div>
            </div>
          )}

          {/* File Attachments - reuse CompactFilePreview visuals */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Paperclip className="h-4 w-4 text-ink-muted" />
                <div className="text-sm font-medium">Attachments</div>
              </div>
              <div className="flex flex-wrap gap-3">
                {task.attachments.map((att) => {
                  const isImage = (att.type || '').startsWith('image/');
                  const fileLike = new File([], att.name, {
                    type: att.type || 'application/octet-stream',
                  });
                  return (
                    <div
                      key={att.id}
                      className="tds-attachment-row flex items-center gap-2 px-2 py-1.5 rounded-md border border-hairline bg-surface-1 cursor-pointer hover:bg-surface-hover transition-colors"
                      onClick={() => openAttachment(att)}
                      title={`Preview ${att.name}`}
                    >
                      {isImage ? (
                        <img
                          src={att.thumbnailUrl || att.url}
                          alt={att.name}
                          className="w-8 h-8 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <DefaultPreview
                          file={fileLike}
                          size="sm"
                          className="w-8 h-8"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink max-w-[180px] truncate">
                          {att.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${att.name}`}
                        className="tds-attachment-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteAttachment(att);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer meta caption: gives the sheet a deliberate close even when
            every optional section above is empty. */}
        <div className="mt-5 border-t border-hairline pt-3">
          <p className="font-mono text-[11px] text-etch-text tabular-nums">
            {metaCaption}
          </p>
        </div>
      </SheetContent>

      {/* Attachment Preview Dialog */}
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        attachment={activeAttachment}
        onDelete={(att) => handleDeleteAttachment(att)}
        onDownload={(att) => handleDownload(att)}
      />
    </Sheet>
  );
};

export default TaskDetailSheet;
