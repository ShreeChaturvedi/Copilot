import React, { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  MapPin,
  Tag as TagIcon,
  FileText,
  Loader,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { IntegratedActionBar } from '@/components/dialogs/IntegratedActionBar';
import { cn } from '@/lib/utils';
import type { FileAttachment, Task } from '@shared/types';
import { useUIStore } from '@/stores/uiStore';
import AttachmentPreviewDialog from './AttachmentPreviewDialog';
import { attachmentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { taskQueryKeys } from '@/hooks/useTasks';

// Reuse the compact file preview UI from EnhancedTaskInput
import { DefaultPreview } from '@/components/smart-input/components/previews/DefaultPreview';
import { useTasks } from '@/hooks/useTasks';
import StatusBadge from './StatusBadge';

// Local utils
function getTagIcon(type: string) {
  switch (type) {
    case 'priority':
      return TagIcon;
    case 'location':
      return MapPin;
    default:
      return TagIcon;
  }
}

function isSameDay(date: Date) {
  const now = new Date(date);
  return (
    now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeAttachment, setActiveAttachment] =
    useState<FileAttachment | null>(null);
  const taskWithDescription = task as Task & { description?: string };

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
  const otherTags = useMemo(
    () =>
      (task.tags || []).filter(
        (t) => t.type !== 'date' && t.type !== 'time' && t.type !== 'location'
      ),
    [task.tags]
  );

  // No client-side fetching needed for previews; use direct URLs for images

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
          'w-full sm:max-w-lg md:max-w-xl p-6 overflow-y-auto [&>button]:hidden',
          className
        )}
      >
        <SheetDescription className="sr-only">
          Task details for {task.title}
        </SheetDescription>
        {/* Header: Title + action bar (Edit / Delete / Peek toggle / Close) */}
        <div className="flex items-start justify-between gap-2">
          <SheetTitle
            className="text-xl font-semibold leading-tight truncate whitespace-nowrap"
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
            />
          </div>
        </div>

        <div className="space-y-6 mt-4">
          {/* Status property at top */}
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex-shrink-0">
              <Loader className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <StatusBadge
                task={task}
                onChange={(status) =>
                  updateTask.mutate({ id: task.id, updates: { status } })
                }
              />
            </div>
          </div>
          {/* Description */}
          {taskWithDescription.description ||
          task.parsedMetadata?.originalInput ? (
            <div className="flex items-start gap-3">
              <div className="text-muted-foreground flex-shrink-0 mt-1">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm whitespace-pre-wrap">
                  {String(
                    taskWithDescription.description ||
                      task.parsedMetadata?.originalInput ||
                      ''
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Due Date (and time) */}
          {task.scheduledDate && (
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground flex-shrink-0">
                {isSameDay(task.scheduledDate) ? (
                  <CalendarIcon className="h-4 w-4" />
                ) : (
                  <ClockIcon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 text-sm font-medium">
                <span>{format(task.scheduledDate, 'MMM dd, yyyy')}</span>
                {!isSameDay(task.scheduledDate) && (
                  <span className="ml-2 text-muted-foreground">
                    {format(task.scheduledDate, 'h:mm a')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {locationTag && (
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground flex-shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm">{String(locationTag.value)}</p>
              </div>
            </div>
          )}

          {/* Other Tags */}
          {otherTags.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="text-muted-foreground flex-shrink-0 mt-0.5">
                <TagIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1">
                  {otherTags.map((tag) => {
                    const Icon = getTagIcon(tag.type);
                    return (
                      <Badge
                        key={`${tag.id}_${String(tag.value)}`}
                        variant="outline"
                        className={cn(
                          'text-xs px-2 py-1 gap-1 text-muted-foreground border-muted-foreground/30',
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
                      >
                        <Icon
                          className="w-3 h-3"
                          style={{ color: tag.color }}
                        />
                        {tag.displayText}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* File Attachments - reuse CompactFilePreview visuals; disable removal */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Attachments</div>
              <div className="flex flex-wrap gap-2">
                {task.attachments.map((att) => {
                  const isImage = (att.type || '').startsWith('image/');
                  const fileLike = new File([], att.name, {
                    type: att.type || 'application/octet-stream',
                  });
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-background cursor-pointer hover:bg-muted transition-colors"
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
                        <div className="text-xs font-medium text-foreground max-w-[180px] truncate">
                          {att.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
