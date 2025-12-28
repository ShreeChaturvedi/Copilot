/**
 * PDFPreview - Component for generating and displaying PDF first page thumbnails
 *
 * Uses PDF.js to render the first page of a PDF file as a canvas thumbnail.
 * Implements dynamic loading, error handling, and memory management.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PDF.js types (dynamically imported)
 */
interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => Promise<void>;
}

interface PDFPageProxy {
  getViewport: (options: { scale: number }) => PDFPageViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
    canvas?: HTMLCanvasElement;
  }) => PDFRenderTask;
  cleanup: () => void;
}

interface PDFPageViewport {
  width: number;
  height: number;
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PDFPreviewProps {
  /** PDF file to generate preview for */
  file: File;
  /** Size of the preview thumbnail */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Callback when preview generation fails */
  onError?: (error: Error) => void;
}

/**
 * PDF preview generation states
 */
type PreviewState = 'idle' | 'loading' | 'success' | 'error';

/**
 * PDF thumbnail preview component
 */
export const PDFPreview: React.FC<PDFPreviewProps> = ({
  file,
  size = 'md',
  className,
  onError,
}) => {
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const renderTaskRef = useRef<PDFRenderTask | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  // Size configurations
  const sizeConfig = {
    sm: { width: 32, height: 32, scale: 0.3 },
    md: { width: 40, height: 40, scale: 0.4 },
    lg: { width: 56, height: 56, scale: 0.6 },
  };

  const { width, height, scale } = sizeConfig[size];

  /**
   * Generate PDF thumbnail using PDF.js
   */
  const generateThumbnail = useCallback(async (): Promise<void> => {
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Invalid PDF file');
    }

    try {
      // Dynamic import to avoid bundle bloat
      const pdfjs = await import('pdfjs-dist');

      // Configure PDF.js worker from CDN to avoid bundling ~1MB worker in our dist
      // Pinned to the installed version for cacheability and consistency
      pdfjs.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs';

      // Convert file to array buffer
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      const loadingTask = pdfjs.getDocument(arrayBuffer);
      const pdfDoc = (await loadingTask.promise) as unknown as PDFDocumentProxy;
      pdfDocRef.current = pdfDoc as PDFDocumentProxy;

      if (pdfDoc.numPages === 0) {
        throw new Error('PDF has no pages');
      }

      // Get first page
      const page = await (
        pdfDoc as unknown as { getPage: (n: number) => Promise<PDFPageProxy> }
      ).getPage(1);

      // Calculate viewport
      const viewport = (page as PDFPageProxy).getViewport({ scale });

      // Create canvas programmatically to avoid ref issues
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to get canvas context');
      }

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Render PDF page to canvas
      const renderContext: {
        canvasContext: CanvasRenderingContext2D;
        viewport: PDFPageViewport;
        canvas?: HTMLCanvasElement;
      } = {
        canvasContext: context,
        viewport: viewport,
        canvas,
      };

      const renderTask = (page as PDFPageProxy).render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // Convert canvas to blob URL
      const blob = await new Promise<Blob>((resolve) => {
        // Prefer WebP for smaller previews with good quality; fall back to PNG if not supported
        const tryWebp = () =>
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else tryPng();
            },
            'image/webp',
            0.8
          );
        const tryPng = () =>
          canvas.toBlob(
            (b) => {
              resolve((b as Blob) || new Blob());
            },
            'image/png',
            0.8
          );
        tryWebp();
      });

      const url = URL.createObjectURL(blob);
      setThumbnailUrl(url);

      // Clean up page resources
      page.cleanup();
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Unknown PDF processing error');
      setError(error.message);
      onError?.(error);
      throw error;
    }
  }, [file, onError, scale]);

  /**
   * Clean up resources
   */
  const cleanup = useCallback(() => {
    // Cancel ongoing render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    // Destroy PDF document
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    // Revoke blob URL
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
      setThumbnailUrl(null);
    }
  }, [thumbnailUrl]);

  /**
   * Generate thumbnail on mount
   */
  useEffect(() => {
    let isMounted = true;

    const loadThumbnail = async () => {
      try {
        if (!isInView) return;
        setPreviewState('loading');
        setError(null);
        await generateThumbnail();
        if (isMounted) setPreviewState('success');
      } catch (err) {
        if (isMounted) {
          setPreviewState('error');
          console.error('PDF thumbnail generation failed:', err);
        }
      }
    };

    loadThumbnail();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [file, isInView, generateThumbnail, cleanup]);

  // Observe visibility to avoid loading/processing when off-screen
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

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
   * Render error state - fallback to file icon
   */
  if (previewState === 'error' || !thumbnailUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md bg-muted',
          className
        )}
        style={{ width, height }}
        title={error || 'Failed to generate PDF preview'}
      >
        <FileText className="w-4 h-4 text-red-500" />
      </div>
    );
  }

  /**
   * Render thumbnail
   */
  return (
    <div
      ref={containerRef}
      className={cn('relative rounded-md overflow-hidden bg-white', className)}
      style={{ width, height }}
    >
      {/* Thumbnail image */}
      <img
        src={thumbnailUrl}
        alt="PDF preview"
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* PDF indicator overlay */}
      <div className="absolute bottom-0 right-0 bg-red-500 text-white text-xs px-1 rounded-tl">
        PDF
      </div>
    </div>
  );
};

export default PDFPreview;
