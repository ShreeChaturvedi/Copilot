import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Download, Trash2, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import type { FileAttachment } from '@shared/types';
import { formatFileSize } from '@shared/config/fileTypes';
import { cn } from '@/lib/utils';

export interface AttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: FileAttachment | null;
  onDelete?: (attachment: FileAttachment) => Promise<void> | void;
  onDownload?: (attachment: FileAttachment) => Promise<void> | void;
}

export const AttachmentPreviewDialog: React.FC<AttachmentPreviewDialogProps> = ({
  open,
  onOpenChange,
  attachment,
  onDelete,
  onDownload,
}) => {
  if (!attachment) return null;

  const isImage = attachment.type?.startsWith('image/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Preview for {attachment.name}
        </DialogDescription>

        {/* Header with filename and actions on the right */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight truncate" title={attachment.name}>
              {attachment.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onDownload?.(attachment)}
              aria-label="Download attachment"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void onDelete?.(attachment)}
              aria-label="Delete attachment"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-2">
          {isImage ? (
            <div className="rounded-md border overflow-hidden">
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-md border bg-muted/40 h-56">
              {/* Large icon for non-images */}
              {attachment.type?.startsWith('video/') ? (
                <ImageIcon className="w-14 h-14 text-muted-foreground" />
              ) : (
                <FileIcon className="w-14 h-14 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-2">
            <span className="truncate">{attachment.type || 'file'}</span>
            <span>•</span>
            <span>{formatFileSize(attachment.size)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentPreviewDialog;