/**
 * CompactFilePreview - Compact file preview for enhanced task input
 * 
 * Displays uploaded files in a compact horizontal layout suitable for
 * the enhanced task input interface. Shows file icons, names, and
 * provides remove functionality.
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UploadedFile } from './FileUploadZone';
import { FilePreviewProvider } from './previews/FilePreviewProvider';
import { formatFileSize } from '@shared/config/fileTypes';
import { cn } from '@/lib/utils';
import { truncateMiddle } from '@shared/utils';

export interface CompactFilePreviewProps {
  /** Files to display */
  files: UploadedFile[];
  /** Callback when a file is removed */
  onFileRemove: (fileId: string) => void;
  /** Whether the preview is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** When true, hides remove buttons while preserving identical visuals */
  readOnly?: boolean;
}



/**
 * Individual compact file item
 */
interface CompactFileItemProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

const CompactFileItemComponent: React.FC<CompactFileItemProps> = ({ file, onRemove, disabled, readOnly }) => {
  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-muted/50',
      'hover:bg-muted transition-colors flex-shrink-0',
      disabled && 'opacity-50'
    )}>
      {/* Enhanced File Preview */}
      <div className="flex-shrink-0">
        <FilePreviewProvider
          file={file.file}
          size="sm"
          className="w-6 h-6"
        />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium max-w-[160px]">
          {truncateMiddle(file.name, 24)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </div>
      </div>

      {/* Remove Button (hidden in readOnly mode) */}
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(file.id)}
          disabled={disabled}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${file.name}`}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

const CompactFileItem = React.memo(CompactFileItemComponent, (prev, next) => {
  return (
    prev.file.id === next.file.id &&
    prev.file.status === next.file.status &&
    prev.file.size === next.file.size &&
    prev.file.name === next.file.name &&
    prev.disabled === next.disabled
  );
});

/**
 * Compact file preview component
 */
const CompactFilePreviewComponent: React.FC<CompactFilePreviewProps> = ({
  files,
  onFileRemove,
  disabled = false,
  className,
  readOnly = false
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Files Grid */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {files.map((file) => (
          <CompactFileItem
            key={file.id}
            file={file}
            onRemove={onFileRemove}
            disabled={disabled}
            readOnly={readOnly}
          />
        ))}
      </div>
      

    </div>
  );
};

export const CompactFilePreview = React.memo(CompactFilePreviewComponent, (prev, next) => {
  if (prev.disabled !== next.disabled || prev.className !== next.className) {
    return false;
  }
  if (prev.files.length !== next.files.length) return false;
  for (let i = 0; i < prev.files.length; i++) {
    const a = prev.files[i];
    const b = next.files[i];
    if (a.id !== b.id || a.status !== b.status || a.name !== b.name || a.size !== b.size) {
      return false;
    }
  }
  return true;
});

export default CompactFilePreview;