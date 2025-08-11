/**
 * FileUploadZone - Professional drag-and-drop file upload component
 *
 * Provides a beautiful, accessible file upload interface with support for
 * multiple file types, drag-and-drop, file validation, and preview generation.
 *
 * Features:
 * - Drag-and-drop file upload
 * - File type validation
 * - File size limits
 * - Preview generation for images
 * - Progress indicators
 * - Error handling with helpful messages
 */

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
// import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { truncateMiddle } from '@shared/utils';
import { ALL_ACCEPTED_FILES, validateFile, formatFileSize as sharedFormatFileSize } from '@shared/config/fileTypes';
import { FilePreviewProvider } from './previews/FilePreviewProvider';

/**
 * File type configurations imported from shared package
 * This ensures consistency between frontend and backend
 */

/**
 * File upload data structure
 */
export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  uploadProgress?: number;
  error?: string;
  status: 'uploading' | 'completed' | 'error';
}

/**
 * Props for FileUploadZone component
 */
export interface FileUploadZoneProps {
  /** Current uploaded files */
  files: UploadedFile[];
  /** Callback when files are added */
  onFilesAdded: (files: File[]) => void;
  /** Callback when a file is removed */
  onFileRemove: (fileId: string) => void;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Whether the upload zone is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Whether to show compact mode */
  compact?: boolean;
}

/**
 * Legacy compatibility - use shared getFileDisplayInfo but return old format
 * TODO: Update consumers to use getFileDisplayInfo directly
 */
// function getFileTypeInfo(file: File) {
//   const displayInfo = getFileDisplayInfo(file);
//   
//   // Return format compatible with old FilePreview component expectations
//   return {
//     icon: File, // Default icon, will be replaced by FilePreviewProvider
//     color: displayInfo.color,
//     maxSize: displayInfo.config?.maxSize || 10 * 1024 * 1024,
//   };
// }

/**
 * Individual file preview component
 */
interface FilePreviewProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  compact?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  compact = false,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border bg-card',
        compact ? 'p-2' : 'p-3'
      )}
    >
      {/* Enhanced File Preview */}
      <FilePreviewProvider
        file={file.file}
        size={compact ? 'sm' : 'md'}
        className="flex-shrink-0"
      />

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium cursor-default',
            compact ? 'text-sm' : 'text-sm'
          )}
          title={file.name}
        >
          {truncateMiddle(file.name, compact ? 28 : 40)}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'text-muted-foreground',
              compact ? 'text-xs' : 'text-xs'
            )}
          >
            {sharedFormatFileSize(file.size)}
          </span>
          
          {/* File Extension Badge */}
          <Badge variant="outline" className="text-xs">
            {file.name.split('.').pop()?.toLowerCase() || 'file'}
          </Badge>

          {/* Status Badge */}
          {file.status === 'uploading' && (
            <Badge variant="outline" className="text-xs">
              Uploading...
            </Badge>
          )}
          {file.status === 'completed' && (
            <CheckCircle className="w-3 h-3 text-green-500" />
          )}
          {file.status === 'error' && (
            <AlertCircle className="w-3 h-3 text-destructive" />
          )}
        </div>

        {/* Upload Progress */}
        {file.status === 'uploading' && file.uploadProgress !== undefined && (
          <div className="mt-2">
            <div className="w-full bg-muted rounded-full h-1">
              <div
                className="bg-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${file.uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {file.error && (
          <div className="text-xs text-destructive mt-1">{file.error}</div>
        )}
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(file.id)}
        className={cn(
          'text-muted-foreground hover:text-destructive',
          compact ? 'h-6 w-6 p-0' : 'h-7 w-7 p-0'
        )}
        aria-label={`Remove ${file.name}`}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};

/**
 * FileUploadZone component
 */
export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onFilesAdded,
  onFileRemove,
  maxFiles = 5,
  disabled = false,
  className,
  compact = false,
}) => {
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  // Handle file drop and validation
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Clear previous errors
      setUploadErrors([]);
      const errors: string[] = [];

      // Check file count limit
      if (files.length + acceptedFiles.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
      }

      // Validate each file using shared validation
      acceptedFiles.forEach((file) => {
        const validation = validateFile(file);
        if (!validation.isValid && validation.error) {
          errors.push(validation.error);
        }
      });

      // Handle rejected files
      rejectedFiles.forEach(({ file, errors: fileErrors }) => {
        fileErrors.forEach((error: { code: string; message: string }) => {
          if (error.code === 'file-too-large') {
            errors.push(`${file.name} is too large`);
          } else if (error.code === 'file-invalid-type') {
            errors.push(`${file.name} is not a supported file type`);
          } else {
            errors.push(`Error with ${file.name}: ${error.message}`);
          }
        });
      });

      if (errors.length > 0) {
        setUploadErrors(errors);
        return;
      }

      // Add valid files
      if (acceptedFiles.length > 0) {
        onFilesAdded(acceptedFiles);
      }
    },
    [files.length, maxFiles, onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ALL_ACCEPTED_FILES,
      maxFiles: maxFiles - files.length,
      disabled: disabled || files.length >= maxFiles,
      noClick: disabled || files.length >= maxFiles,
      noKeyboard: false,
    });

  return (
    <div className={cn('space-y-3', className)}>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg transition-colors cursor-pointer',
          'flex flex-col items-center justify-center text-center',
          compact ? 'p-4' : 'p-6',
          !disabled && 'hover:border-primary/50',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          disabled && 'opacity-50 cursor-not-allowed',
          files.length >= maxFiles && 'opacity-50 cursor-not-allowed',
          files.length === 0
            ? 'border-muted-foreground/25'
            : 'border-muted-foreground/10'
        )}
      >
        <input {...getInputProps()} />

        <Upload
          className={cn(
            'mx-auto text-muted-foreground mb-2',
            compact ? 'w-6 h-6' : 'w-8 h-8'
          )}
        />

        <div className="space-y-1">
          <p
            className={cn(
              'text-muted-foreground',
              compact ? 'text-sm' : 'text-sm'
            )}
          >
            {isDragActive
              ? isDragReject
                ? 'Some files are not supported'
                : 'Drop files here...'
              : files.length >= maxFiles
                ? `Maximum ${maxFiles} files reached`
                : 'Click to upload or drag and drop'}
          </p>
          {/* Secondary hint removed to reduce clutter */}
        </div>
      </div>

      {/* Upload Errors */}
      {uploadErrors.length > 0 && (
        <div className="space-y-1">
          {uploadErrors.map((error, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={onFileRemove}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* File Count */}
      {files.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {files.length} of {maxFiles} files
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
