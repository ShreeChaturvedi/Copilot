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
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  File, 
  Image, 
  FileText, 
  Music, 
  Video, 
  X, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Supported file types and their configurations
 */
export const FILE_TYPES = {
  IMAGE: {
    accept: {'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']},
    maxSize: 5 * 1024 * 1024, // 5MB
    icon: Image,
    color: 'text-blue-500'
  },
  DOCUMENT: {
    accept: {
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    icon: FileText,
    color: 'text-green-500'
  },
  AUDIO: {
    accept: {'audio/*': ['.mp3', '.wav', '.m4a', '.ogg']},
    maxSize: 25 * 1024 * 1024, // 25MB
    icon: Music,
    color: 'text-purple-500'
  },
  VIDEO: {
    accept: {'video/*': ['.mp4', '.mov', '.avi', '.mkv']},
    maxSize: 100 * 1024 * 1024, // 100MB
    icon: Video,
    color: 'text-red-500'
  }
} as const;

/**
 * Combined accept object for all file types
 */
const ALL_ACCEPTED_FILES = Object.values(FILE_TYPES).reduce((acc, type) => ({
  ...acc,
  ...type.accept
}), {});

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
 * Get file type category and icon
 */
function getFileTypeInfo(file: File) {
  const { type, name } = file;
  const extension = name.toLowerCase().split('.').pop() || '';

  if (type.startsWith('image/')) {
    return FILE_TYPES.IMAGE;
  } else if (type.startsWith('audio/')) {
    return FILE_TYPES.AUDIO;
  } else if (type.startsWith('video/')) {
    return FILE_TYPES.VIDEO;
  } else if (
    type === 'application/pdf' || 
    type.startsWith('text/') ||
    type.includes('document') ||
    ['.doc', '.docx', '.txt', '.md', '.pdf'].includes(`.${extension}`)
  ) {
    return FILE_TYPES.DOCUMENT;
  }
  
  return {
    icon: File,
    color: 'text-gray-500',
    maxSize: 10 * 1024 * 1024
  };
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Individual file preview component
 */
interface FilePreviewProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  compact?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove, compact = false }) => {
  const typeInfo = getFileTypeInfo(file.file);
  const IconComponent = typeInfo.icon;

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border border-border bg-card',
      compact ? 'p-2' : 'p-3'
    )}>
      {/* File Icon or Image Preview */}
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center rounded-md bg-muted',
        compact ? 'w-8 h-8' : 'w-10 h-10'
      )}>
        {file.preview && file.file.type.startsWith('image/') ? (
          <img
            src={file.preview}
            alt={file.name}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <IconComponent className={cn(
            typeInfo.color,
            compact ? 'w-4 h-4' : 'w-5 h-5'
          )} />
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium truncate',
          compact ? 'text-sm' : 'text-sm'
        )}>
          {file.name}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            'text-muted-foreground',
            compact ? 'text-xs' : 'text-xs'
          )}>
            {formatFileSize(file.size)}
          </span>
          
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
          <div className="text-xs text-destructive mt-1">
            {file.error}
          </div>
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
  compact = false
}) => {
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  // Handle file drop and validation
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Clear previous errors
    setUploadErrors([]);
    const errors: string[] = [];

    // Check file count limit
    if (files.length + acceptedFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
    }

    // Validate each file
    acceptedFiles.forEach((file) => {
      const typeInfo = getFileTypeInfo(file);
      if (file.size > typeInfo.maxSize) {
        errors.push(`Maximum upload file size is 10MB`);
      }
    });

    // Handle rejected files
    rejectedFiles.forEach(({ file, errors: fileErrors }) => {
      fileErrors.forEach((error: any) => {
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
  }, [files.length, maxFiles, onFilesAdded]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ALL_ACCEPTED_FILES,
    maxFiles: maxFiles - files.length,
    disabled,
    noClick: false,
    noKeyboard: false
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
          files.length === 0 ? 'border-muted-foreground/25' : 'border-muted-foreground/10'
        )}
      >
        <input {...getInputProps()} />
        
        <Upload className={cn(
          'mx-auto text-muted-foreground mb-2',
          compact ? 'w-6 h-6' : 'w-8 h-8'
        )} />
        
        <div className="space-y-1">
          <p className={cn(
            'text-muted-foreground',
            compact ? 'text-sm' : 'text-sm'
          )}>
            {isDragActive 
              ? isDragReject
                ? 'Some files are not supported'
                : 'Drop files here...'
              : files.length >= maxFiles
                ? `Maximum ${maxFiles} files reached`
                : 'Click to upload or drag and drop'
            }
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Images, documents, audio, video • Up to {formatFileSize(FILE_TYPES.VIDEO.maxSize)} each
            </p>
          )}
        </div>
      </div>

      {/* Upload Errors */}
      {uploadErrors.length > 0 && (
        <div className="space-y-1">
          {uploadErrors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
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