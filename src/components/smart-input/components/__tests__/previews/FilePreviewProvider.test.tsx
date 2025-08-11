/**
 * FilePreviewProvider Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilePreviewProvider } from '../../previews/FilePreviewProvider';

// Mock the preview components
vi.mock('../../previews/ImagePreview', () => ({
  ImagePreview: ({ file, size, className }: { file: File; size?: 'sm' | 'md' | 'lg'; className?: string }) => (
    <div data-testid="image-preview" data-file={file.name} data-size={size} className={className}>
      Image Preview
    </div>
  ),
}));

vi.mock('../../previews/PDFPreview', () => ({
  PDFPreview: ({ file, size, className, onError }: { file: File; size?: 'sm' | 'md' | 'lg'; className?: string; onError?: (err: Error) => void }) => (
    <div 
      data-testid="pdf-preview" 
      data-file={file.name} 
      data-size={size} 
      className={className}
      onClick={() => onError?.(new Error('test error'))}
    >
      PDF Preview
    </div>
  ),
}));

vi.mock('../../previews/DefaultPreview', () => ({
  DefaultPreview: ({ file, size, className }: { file: File; size?: 'sm' | 'md' | 'lg'; className?: string }) => (
    <div data-testid="default-preview" data-file={file.name} data-size={size} className={className}>
      Default Preview
    </div>
  ),
}));

describe('FilePreviewProvider', () => {
  const createMockFile = (name: string, type: string, size: number = 1024): File => {
    const file = new File(['test content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('Preview Type Routing', () => {
    it('should use ImagePreview for image files', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      expect(screen.getByTestId('image-preview')).toHaveAttribute('data-file', 'photo.jpg');
    });

    it('should use PDFPreview for PDF files', () => {
      const file = createMockFile('document.pdf', 'application/pdf');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('pdf-preview')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-preview')).toHaveAttribute('data-file', 'document.pdf');
    });

    it('should use DefaultPreview for audio files', () => {
      const file = createMockFile('song.mp3', 'audio/mpeg');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('default-preview')).toBeInTheDocument();
      expect(screen.getByTestId('default-preview')).toHaveAttribute('data-file', 'song.mp3');
    });

    it('should use DefaultPreview for video files', () => {
      const file = createMockFile('movie.mp4', 'video/mp4');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('default-preview')).toBeInTheDocument();
      expect(screen.getByTestId('default-preview')).toHaveAttribute('data-file', 'movie.mp4');
    });

    it('should use DefaultPreview for document files (non-PDF)', () => {
      const file = createMockFile('spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('default-preview')).toBeInTheDocument();
      expect(screen.getByTestId('default-preview')).toHaveAttribute('data-file', 'spreadsheet.xlsx');
    });

    it('should use DefaultPreview for unknown file types', () => {
      const file = createMockFile('unknown.xyz', 'application/unknown');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('default-preview')).toBeInTheDocument();
      expect(screen.getByTestId('default-preview')).toHaveAttribute('data-file', 'unknown.xyz');
    });
  });

  describe('Props Forwarding', () => {
    it('should forward size prop to preview components', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      
      render(<FilePreviewProvider file={file} size="lg" />);
      
      expect(screen.getByTestId('image-preview')).toHaveAttribute('data-size', 'lg');
    });

    it('should forward className prop to preview components', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      
      render(<FilePreviewProvider file={file} className="custom-class" />);
      
      expect(screen.getByTestId('image-preview')).toHaveClass('custom-class');
    });

    it('should default to medium size when not specified', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      
      render(<FilePreviewProvider file={file} />);
      
      expect(screen.getByTestId('image-preview')).toHaveAttribute('data-size', 'md');
    });
  });

  describe('Error Handling', () => {
    it('should handle preview errors gracefully', () => {
      const onError = vi.fn();
      const file = createMockFile('document.pdf', 'application/pdf');
      
      render(<FilePreviewProvider file={file} onError={onError} />);
      
      // Simulate error by clicking the mock PDF preview
      screen.getByTestId('pdf-preview').click();
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should log errors to console', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const file = createMockFile('document.pdf', 'application/pdf');
      
      render(<FilePreviewProvider file={file} />);
      
      // Simulate error
      screen.getByTestId('pdf-preview').click();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preview generation failed for document.pdf'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('File Type Detection', () => {
    it('should handle files with MIME type variants', () => {
      // Test different image MIME types
      const jpegFile = createMockFile('photo1.jpg', 'image/jpeg');
      const pngFile = createMockFile('photo2.png', 'image/png');
      const webpFile = createMockFile('photo3.webp', 'image/webp');
      
      render(<FilePreviewProvider file={jpegFile} />);
      expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      
      render(<FilePreviewProvider file={pngFile} />);
      expect(screen.getAllByTestId('image-preview')).toHaveLength(2);
      
      render(<FilePreviewProvider file={webpFile} />);
      expect(screen.getAllByTestId('image-preview')).toHaveLength(3);
    });

    it('should handle Microsoft Office document types', () => {
      const docxFile = createMockFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const xlsxFile = createMockFile('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const pptxFile = createMockFile('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      
      render(<FilePreviewProvider file={docxFile} />);
      expect(screen.getByTestId('default-preview')).toBeInTheDocument();
      
      render(<FilePreviewProvider file={xlsxFile} />);
      expect(screen.getAllByTestId('default-preview')).toHaveLength(2);
      
      render(<FilePreviewProvider file={pptxFile} />);
      expect(screen.getAllByTestId('default-preview')).toHaveLength(3);
    });
  });
});