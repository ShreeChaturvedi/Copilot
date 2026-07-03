import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  Trash2,
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  Music,
  Video,
  Image as ImageIcon,
  Archive,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileAttachment } from '@shared/types';
import { formatFileSize } from '@shared/config/fileTypes';
import './attachment-preview.css';

export interface AttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: FileAttachment | null;
  onDelete?: (attachment: FileAttachment) => Promise<void> | void;
  onDownload?: (attachment: FileAttachment) => Promise<void> | void;
}

/* ----------------------------------------------------------------------------
 * File-type visual (§2C): one calm tile on the same --chip-c chip-film
 * formula .folder-card-icon already uses, fed by the foundation's
 * theme-invariant --filetype-* brand tokens. The icon says "what kind of
 * file" (shared across close variants, e.g. doc/docx); --chip-c carries the
 * brand-identity color per exact type. Every code/plaintext/unrecognized
 * extension gets one neutral fallback (FileCode, no --chip-c) instead of the
 * old JS/Python/Java-only special cases plus ten silent gray fallbacks.
 * ------------------------------------------------------------------------- */
const EXT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  zip: Archive,
  rar: Archive,
  '7z': Archive,
  tar: Archive,
  gz: Archive,
  mp3: Music,
  m4a: Music,
  wav: Music,
  webm: Music,
  ogg: Music,
  flac: Music,
  aac: Music,
};

const EXT_CHIP_COLOR: Record<string, string> = {
  pdf: 'var(--filetype-pdf)',
  doc: 'var(--filetype-doc)',
  docx: 'var(--filetype-doc)',
  xls: 'var(--filetype-sheet)',
  xlsx: 'var(--filetype-sheet)',
  csv: 'var(--filetype-sheet)',
  ppt: 'var(--filetype-slides)',
  pptx: 'var(--filetype-slides)',
  zip: 'var(--filetype-archive)',
  rar: 'var(--filetype-archive)',
  '7z': 'var(--filetype-archive)',
  tar: 'var(--filetype-archive)',
  gz: 'var(--filetype-archive)',
  mp3: 'var(--filetype-audio)',
  m4a: 'var(--filetype-audio)',
  wav: 'var(--filetype-audio)',
  webm: 'var(--filetype-audio)',
  ogg: 'var(--filetype-audio)',
  flac: 'var(--filetype-audio)',
  aac: 'var(--filetype-audio)',
};

function getAttachmentVisual(
  attachment: FileAttachment,
  ext: string
): {
  Icon: React.ComponentType<{ className?: string }>;
  chipColor?: string;
} {
  const type = attachment.type || '';

  if (type.startsWith('video/')) {
    return { Icon: Video, chipColor: 'var(--filetype-video)' };
  }
  const Icon = EXT_ICON[ext];
  if (Icon) {
    return { Icon, chipColor: EXT_CHIP_COLOR[ext] };
  }
  return { Icon: FileCode, chipColor: undefined };
}

export const AttachmentPreviewDialog: React.FC<
  AttachmentPreviewDialogProps
> = ({ open, onOpenChange, attachment, onDelete, onDownload }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrored, setImageErrored] = useState(false);

  // Reset image load/error state each time a different attachment opens —
  // this dialog instance persists across previews (TaskDetailSheet swaps
  // `attachment` while re-using one dialog), so stale state would otherwise
  // leak between files.
  useEffect(() => {
    setImageLoaded(false);
    setImageErrored(false);
  }, [attachment?.id]);

  if (!attachment) return null;

  const isImage = Boolean(attachment.type?.startsWith('image/'));
  const showImagePreview = isImage && !imageErrored;
  const ext = (attachment.name.split('.').pop() || '').toLowerCase();
  const visual = isImage
    ? { Icon: ImageIcon, chipColor: 'var(--filetype-image)' }
    : getAttachmentVisual(attachment, ext);
  const TileIcon = visual.Icon;

  const handleDownloadClick = () => {
    void onDownload?.(attachment);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[400px] overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Preview for {attachment.name}
        </DialogDescription>

        {/* Title + actions inline; title truncates within available space */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h2
              className="text-base leading-none font-semibold tracking-[-0.01em] truncate"
              title={attachment.name}
            >
              {attachment.name}
            </h2>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onDownload?.(attachment)}
              className="p-2 hover:bg-accent hover:text-accent-foreground"
              aria-label="Download attachment"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onDelete?.(attachment)}
              className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Delete attachment"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-accent hover:text-accent-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 mb-5">
          {showImagePreview ? (
            <div className="relative flex items-center justify-center min-h-[120px] rounded-card border border-hairline overflow-hidden bg-surface-2 p-2">
              {!imageLoaded && (
                <Skeleton className="absolute inset-2 rounded-card" />
              )}
              {/* Prefer thumbnail, fall back to full URL */}
              <img
                src={attachment.thumbnailUrl || attachment.url}
                alt={attachment.name}
                className={cn(
                  'object-contain rounded-card transition-opacity duration-200',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  imageRendering: 'auto' as const,
                }}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageErrored(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <button
                type="button"
                className="afp-tile"
                style={
                  visual.chipColor
                    ? ({ '--chip-c': visual.chipColor } as React.CSSProperties)
                    : undefined
                }
                onClick={handleDownloadClick}
                aria-label={`Download ${attachment.name}`}
              >
                <TileIcon className="afp-tile-glyph" aria-hidden="true" />
              </button>
              <div className="mt-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {ext || 'File'}
              </div>
              <p className="mt-2 text-center font-mono text-[11px] text-etch-text">
                {isImage
                  ? 'Preview unavailable — click to download'
                  : 'Click to download'}
              </p>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
            <span className="truncate">{(ext || 'file').toUpperCase()}</span>
            <span>•</span>
            <span>{formatFileSize(attachment.size)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentPreviewDialog;
