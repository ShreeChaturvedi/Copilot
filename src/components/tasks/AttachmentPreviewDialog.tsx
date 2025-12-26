import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Download, Trash2, FileText, Music, Video, FileImage, Archive, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FileAttachment } from '@shared/types';
import { formatFileSize } from '@shared/config/fileTypes';


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

  const handleClickTopSheet = () => {
    void onDownload?.(attachment);
  };

  const FileSheets = () => {
    const type = attachment.type || '';
    const ext = (attachment.name.split('.').pop() || '').toLowerCase();

    // Brand-like file type representation
    const getFileTypeDisplay = () => {
      if (ext === 'pdf') {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#DC3545' }}>
              PDF
            </div>
          )
        };
      } else if (['doc', 'docx'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#2B579A' }}>
              DOC
            </div>
          )
        };
      } else if (['xls', 'xlsx'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#217346' }}>
              XLS
            </div>
          )
        };
      } else if (['ppt', 'pptx'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#D24726' }}>
              PPT
            </div>
          )
        };
      } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#F59E0B' }}>
              <Archive className="w-8 h-8" />
            </div>
          )
        };
      } else if (type.startsWith('image/')) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#059669' }}>
              <FileImage className="w-8 h-8" />
            </div>
          )
        };
      } else if (type.startsWith('video/')) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#DC2626' }}>
              <Video className="w-8 h-8" />
            </div>
          )
        };
      } else if (['mp3', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'aac'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#7C3AED' }}>
              <Music className="w-8 h-8" />
            </div>
          )
        };
      } else if (['js', 'ts'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: '#F7DF1E', color: '#000' }}>
              {ext.toUpperCase()}
            </div>
          )
        };
      } else if (['py'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#3776AB' }}>
              PY
            </div>
          )
        };
      } else if (['java'].includes(ext)) {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: '#ED8B00' }}>
              JAVA
            </div>
          )
        };
      } else {
        return {
          component: (
            <div className="w-20 h-20 rounded-lg flex items-center justify-center text-slate-600 border-2 border-slate-300 bg-slate-50">
              <FileText className="w-8 h-8" />
            </div>
          )
        };
      }
    };

    const fileTypeDisplay = getFileTypeDisplay();

    return (
      <div className="flex justify-center max-w-fit mx-auto">
        <div
          className="relative select-none group"
          style={{ width: 200, height: 260 }}
          onMouseEnter={(e) => {
            const backSheet = e.currentTarget.children[0] as HTMLElement;
            const middleSheet = e.currentTarget.children[1] as HTMLElement;
            if (backSheet) backSheet.style.transform = 'rotate(-5deg) translateX(-2px) translateY(1px)';
            if (middleSheet) middleSheet.style.transform = 'rotate(4deg) translateX(1px) translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            const backSheet = e.currentTarget.children[0] as HTMLElement;
            const middleSheet = e.currentTarget.children[1] as HTMLElement;
            if (backSheet) backSheet.style.transform = 'rotate(-4deg) translateX(-2px) translateY(2px)';
            if (middleSheet) middleSheet.style.transform = 'rotate(3deg) translateX(1px) translateY(-1px)';
          }}
        >
          {/* Back sheet - furthest back */}
          <div
            className="absolute inset-0 rounded-lg shadow-sm transition-all duration-300 ease-out bg-card border border-border"
            style={{
              transform: 'rotate(-4deg) translateX(-2px) translateY(2px)',
              transformOrigin: 'center bottom',
              zIndex: 1
            }}
          />

          {/* Middle sheet */}
          <div
            className="absolute inset-0 rounded-lg shadow-md transition-all duration-300 ease-out bg-card border border-border"
            style={{
              transform: 'rotate(3deg) translateX(1px) translateY(-1px)',
              transformOrigin: 'center bottom',
              zIndex: 2
            }}
          />

          {/* Top sheet - interactive */}
          <div
            className="absolute inset-0 rounded-lg shadow-lg border border-border cursor-pointer transition-all duration-300 ease-out will-change-transform group-hover:shadow-xl bg-card"
            onClick={handleClickTopSheet}
            title="Download"
            style={{
              transformOrigin: 'center bottom',
              zIndex: 3,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'rotate(-0.5deg) scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
            }}
          >

            {/* Content area */}
            <div className="absolute inset-0 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-4">
                {fileTypeDisplay.component}
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {ext || 'File'}
                </div>
                <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  Download
                </Badge>
              </div>
            </div>

            {/* Page edge effect */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 rounded-r-lg pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.05) 100%)'
              }}
            />
          </div>

          {/* Additional hover effects handled via CSS variables and onMouseEnter/Leave */}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Preview for {attachment.name}
        </DialogDescription>

        {/* Title + actions inline; title truncates within available space */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight truncate" title={attachment.name}>
              {attachment.name}
            </h2>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
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
        </div>

        {/* Preview */}
        <div className="mt-4 mb-5">
          {isImage ? (
            <div className="rounded-lg border overflow-hidden bg-black/5 p-2">
              <div className="flex items-center justify-center">
                {/* Prefer thumbnail, fall back to full URL */}
                <img
                  src={attachment.thumbnailUrl || attachment.url}
                  alt={attachment.name}
                  className="object-contain rounded-md"
                  style={{ maxWidth: '100%', maxHeight: '60vh', imageRendering: 'auto' as const }}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          ) : (
            <FileSheets />
          )}
        </div>

        {/* Meta */}
        <div className="text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-2">
            <span className="truncate">{(attachment.name.split('.').pop() || 'file').toUpperCase()}</span>
            <span>•</span>
            <span>{formatFileSize(attachment.size)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentPreviewDialog;
