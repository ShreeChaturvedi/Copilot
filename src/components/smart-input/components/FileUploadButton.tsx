/**
 * FileUploadButton - Button trigger for file upload functionality
 *
 * This component provides a button interface for the FileUploadZone component,
 * allowing users to trigger file uploads from the enhanced task input controls.
 * It integrates with the existing FileUploadZone for consistent file handling.
 */

import React, { useState, useCallback } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { FileUploadZone, UploadedFile } from './FileUploadZone';
import { cn } from '@/lib/utils';

export interface FileUploadButtonProps {
  /** Current uploaded files */
  files: UploadedFile[];
  /** Callback when files are added */
  onFilesAdded: (files: File[]) => void;
  /** Callback when a file is removed */
  onFileRemove: (fileId: string) => void;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button size */
  size?: 'sm' | 'default' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * File upload button with modal dialog
 */
export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  files,
  onFilesAdded,
  onFileRemove,
  maxFiles = 5,
  disabled = false,
  size = 'sm',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Handle files added from the upload zone
  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      onFilesAdded(newFiles);
    },
    [onFilesAdded]
  );

  // Handle file removal
  const handleFileRemove = useCallback(
    (fileId: string) => {
      onFileRemove(fileId);
    },
    [onFileRemove]
  );

  // Check if we have files
  const hasFiles = files.length > 0;
  const tooltipLabel = hasFiles
    ? `${files.length} file${files.length === 1 ? '' : 's'} attached`
    : 'Attach files';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size={size}
              aria-label={tooltipLabel}
              className={cn(
                'relative text-muted-foreground hover:text-foreground',
                size === 'sm' && 'h-8 w-8 p-0',
                hasFiles && 'text-primary hover:text-primary',
                className
              )}
              disabled={disabled}
            >
              <Paperclip
                className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')}
              />

              {/* File count indicator */}
              {hasFiles && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {files.length}
                </span>
              )}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipLabel}</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-lg lg:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attach Files</DialogTitle>
          <DialogDescription>
            Upload files to attach to your task. Supports images, documents
            (PDF, Word, Excel, PowerPoint), audio, and video files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FileUploadZone
            files={files}
            onFilesAdded={handleFilesAdded}
            onFileRemove={handleFileRemove}
            maxFiles={maxFiles}
            disabled={disabled}
            compact={true}
          />

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadButton;
