/**
 * FilePreviewProvider - Intelligent preview provider that selects appropriate preview component
 * 
 * Routes files to the correct preview component based on file type and capabilities.
 * Provides consistent interface and error handling across all preview types.
 */

import React from 'react';
import { getPreviewType } from '@shared/config/fileTypes';
import { ImagePreview } from './ImagePreview';
import { PDFPreview } from './PDFPreview';
import { DefaultPreview } from './DefaultPreview';

interface FilePreviewProviderProps {
  /** File to generate preview for */
  file: File;
  /** Size of the preview thumbnail */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Callback when preview generation fails */
  onError?: (error: Error) => void;
}

/**
 * Preview provider component that routes to appropriate preview implementation
 */
const FilePreviewProviderComponent: React.FC<FilePreviewProviderProps> = ({
  file,
  size = 'md',
  className,
  onError,
}) => {
  // Determine preview type based on file
  const previewType = getPreviewType(file);

  // Handle error callback
  const handlePreviewError = (error: Error) => {
    console.warn(`Preview generation failed for ${file.name}:`, error);
    onError?.(error);
  };

  // Route to appropriate preview component
  switch (previewType) {
    case 'thumbnail':
      // Image files get thumbnail previews
      return (
        <ImagePreview
          file={file}
          size={size}
          className={className}
          onError={handlePreviewError}
        />
      );

    case 'pdf':
      // PDF files get first page thumbnail, fallback to default on error
      return (
        <PDFPreview
          file={file}
          size={size}
          className={className}
          onError={(error) => {
            handlePreviewError(error);
            // Don't re-render, let PDFPreview handle its own error state
          }}
        />
      );

    case 'icon':
    case 'none':
    default:
      // All other files get enhanced icon preview
      return (
        <DefaultPreview
          file={file}
          size={size}
          className={className}
        />
      );
  }
};

export const FilePreviewProvider = React.memo(FilePreviewProviderComponent, (prev, next) => {
  return (
    prev.file === next.file &&
    prev.size === next.size &&
    prev.className === next.className
  );
});

export default FilePreviewProvider;