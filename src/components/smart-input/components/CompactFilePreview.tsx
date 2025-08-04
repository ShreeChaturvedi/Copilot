/**
 * CompactFilePreview - Compact file preview for enhanced task input
 * 
 * Displays uploaded files in a compact horizontal layout suitable for
 * the enhanced task input interface. Shows file icons, names, and
 * provides remove functionality.
 */

import React from 'react';
import { X, File, Image, FileText, Music, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UploadedFile } from './FileUploadZone';
import { cn } from '@/lib/utils';

export interface CompactFilePreviewProps {
  /** Files to display */
  files: UploadedFile[];
  /** Callback when a file is removed */
  onFileRemove: (fileId: string) => void;
  /** Whether the preview is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Get file type icon based on file type
 */
function getFileIcon(file: UploadedFile) {
  const { type } = file.file;
  
  if (type.startsWith('image/')) {
    return Image;
  } else if (type.startsWith('audio/')) {
    return Music;
  } else if (type.startsWith('video/')) {
    return Video;
  } else if (
    type === 'application/pdf' || 
    type.startsWith('text/') ||
    type.includes('document')
  ) {
    return FileText;
  }
  
  return File;
}

/**
 * Format file size for compact display
 */
function formatCompactFileSize(bytes: number): string {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

/**
 * Individual compact file item
 */
interface CompactFileItemProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const CompactFileItem: React.FC<CompactFileItemProps> = ({ file, onRemove, disabled }) => {
  const IconComponent = getFileIcon(file);
  
  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-muted/50',
      'hover:bg-muted transition-colors flex-shrink-0',
      disabled && 'opacity-50'
    )}>
      {/* File Icon or Image Preview */}
      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
        {file.preview && file.file.type.startsWith('image/') ? (
          <img
            src={file.preview}
            alt={file.name}
            className="w-full h-full object-cover rounded-sm"
          />
        ) : (
          <IconComponent className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate max-w-[120px]">
          {file.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCompactFileSize(file.size)}
        </div>
      </div>

      {/* Remove Button */}
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
    </div>
  );
};

/**
 * Compact file preview component
 */
export const CompactFilePreview: React.FC<CompactFilePreviewProps> = ({
  files,
  onFileRemove,
  disabled = false,
  className
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
          />
        ))}
      </div>
      

    </div>
  );
};

export default CompactFilePreview;