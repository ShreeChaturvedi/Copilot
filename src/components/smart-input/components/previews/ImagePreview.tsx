/**
 * ImagePreview - Component for displaying image file thumbnails
 * 
 * Handles image preview generation with proper loading states,
 * error handling, and accessibility features.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  /** Image file to generate preview for */
  file: File;
  /** Size of the preview thumbnail */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Callback when preview generation fails */
  onError?: (error: Error) => void;
}

/**
 * Image preview states
 */
type PreviewState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Image thumbnail preview component
 */
const ImagePreviewComponent: React.FC<ImagePreviewProps> = ({
  file,
  size = 'md',
  className,
  onError,
}) => {
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onErrorRef = useRef<typeof onError | null>(null);
  onErrorRef.current = onError;

  // Size configurations
  const sizeConfig = {
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 56, height: 56 },
  };

  const { width, height } = sizeConfig[size];

  /**
   * Generate image preview
   */
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Invalid image file');
      setPreviewState('error');
      return;
    }

    let isMounted = true;

    const generatePreview = async () => {
      try {
        setPreviewState('loading');
        setError(null);

        // Create object URL for image
        const url = URL.createObjectURL(file);
        
        // Validate image can be loaded
        const img = new Image();
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = url;
        });

        if (isMounted) {
          setPreviewUrl(url);
          setPreviewState('success');
        } else {
          // Clean up if component unmounted
          URL.revokeObjectURL(url);
        }
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown image processing error');
        
        if (isMounted) {
          setError(error.message);
          setPreviewState('error');
          onErrorRef.current?.(error);
        }
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
    };
  }, [file]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /**
   * Render loading state
   */
  if (previewState === 'loading') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md bg-muted',
          className
        )}
        style={{ width, height }}
      >
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /**
   * Render error state
   */
  if (previewState === 'error' || !previewUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md bg-muted',
          className
        )}
        style={{ width, height }}
        title={error || 'Failed to generate image preview'}
      >
        <ImageIcon className="w-4 h-4 text-red-500" />
      </div>
    );
  }

  /**
   * Render image thumbnail
   */
  return (
    <div
      className={cn(
        'relative rounded-md overflow-hidden',
        className
      )}
      style={{ width, height }}
    >
      <img
        src={previewUrl}
        alt={`Preview of ${file.name}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

export const ImagePreview = React.memo(ImagePreviewComponent, (prev, next) => {
  return (
    prev.file === next.file &&
    prev.size === next.size &&
    prev.className === next.className
  );
});

export default ImagePreview;