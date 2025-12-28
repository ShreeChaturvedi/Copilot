/**
 * DefaultPreview Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DefaultPreview } from '../../previews/DefaultPreview';

describe('DefaultPreview', () => {
  const createMockFile = (
    name: string,
    type: string,
    size: number = 1024
  ): File => {
    const file = new File(['test content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('File Type Icons', () => {
    it('should display PDF icon for PDF files', () => {
      const file = createMockFile('document.pdf', 'application/pdf');

      render(<DefaultPreview file={file} />);

      // Should show file text icon for PDF (based on our icon mapping)
      const container = screen.getByTitle(/Documents file: document\.pdf/i);
      expect(container).toBeInTheDocument();
    });

    it('should display spreadsheet icon for Excel files', () => {
      const file = createMockFile(
        'spreadsheet.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(/file: spreadsheet\.xlsx/i);
      expect(container).toBeInTheDocument();
    });

    it('should display presentation icon for PowerPoint files', () => {
      const file = createMockFile(
        'presentation.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(/file: presentation\.pptx/i);
      expect(container).toBeInTheDocument();
    });

    it('should display music icon for audio files', () => {
      const file = createMockFile('song.mp3', 'audio/mpeg');

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(/Audio file/i);
      expect(container).toBeInTheDocument();
    });

    it('should display video icon for video files', () => {
      const file = createMockFile('movie.mp4', 'video/mp4');

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(/Video file/i);
      expect(container).toBeInTheDocument();
    });

    it('should display archive icon for zip files', () => {
      const file = createMockFile('archive.zip', 'application/zip');

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(/Archives file/i);
      expect(container).toBeInTheDocument();
    });
  });

  describe('File Extension Badges', () => {
    it('does not show extension overlays for non-PDF previews', () => {
      const file = createMockFile('document.pdf', 'application/pdf');
      render(<DefaultPreview file={file} size="md" />);
      expect(screen.queryByText('pdf')).not.toBeInTheDocument();
    });

    it('handles files without extensions gracefully', () => {
      const file = createMockFile('noextension', 'application/octet-stream');
      render(<DefaultPreview file={file} size="sm" />);
      const container = screen.getByTitle(/file: noextension/i);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Responsive Sizing', () => {
    it('should apply small size styles correctly', () => {
      const file = createMockFile('test.pdf', 'application/pdf');

      const { container } = render(<DefaultPreview file={file} size="sm" />);

      const previewElement = container.firstChild as HTMLElement;
      expect(previewElement).toHaveStyle({ width: '32px', height: '32px' });
    });

    it('should apply medium size styles correctly', () => {
      const file = createMockFile('test.pdf', 'application/pdf');

      const { container } = render(<DefaultPreview file={file} size="md" />);

      const previewElement = container.firstChild as HTMLElement;
      expect(previewElement).toHaveStyle({ width: '40px', height: '40px' });
    });

    it('should apply large size styles correctly', () => {
      const file = createMockFile('test.pdf', 'application/pdf');

      const { container } = render(<DefaultPreview file={file} size="lg" />);

      const previewElement = container.firstChild as HTMLElement;
      expect(previewElement).toHaveStyle({ width: '56px', height: '56px' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper title attribute with file info', () => {
      const file = createMockFile('important-document.pdf', 'application/pdf');

      render(<DefaultPreview file={file} />);

      const container = screen.getByTitle(
        'Documents file: important-document.pdf'
      );
      expect(container).toBeInTheDocument();
    });

    it('should handle unknown file types gracefully', () => {
      const file = createMockFile('unknown.xyz', 'application/unknown');

      render(<DefaultPreview file={file} />);

      // Should not crash and should render something
      const container = screen.getByTitle(/file: unknown\.xyz/i);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept and apply custom className', () => {
      const file = createMockFile('test.pdf', 'application/pdf');

      const { container } = render(
        <DefaultPreview file={file} className="custom-class" />
      );

      const previewElement = container.firstChild as HTMLElement;
      expect(previewElement).toHaveClass('custom-class');
    });

    it('should maintain base styling classes', () => {
      const file = createMockFile('test.pdf', 'application/pdf');

      const { container } = render(<DefaultPreview file={file} />);

      const previewElement = container.firstChild as HTMLElement;
      expect(previewElement).toHaveClass(
        'relative',
        'flex',
        'items-center',
        'justify-center'
      );
    });
  });
});
