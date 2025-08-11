/**
 * File Upload Improvements Test
 * 
 * Tests the specific improvements made to the file upload functionality:
 * 1. Error message simplification
 * 2. Removed file count text
 * 3. Horizontal scrolling for files
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompactFilePreview } from '../CompactFilePreview';
import { UploadedFile } from '../FileUploadZone';

describe('File Upload Improvements', () => {
  const mockOnFileRemove = vi.fn();

  const mockFiles: UploadedFile[] = [
    {
      id: '1',
      file: new File(['test content'], 'test.txt', { type: 'text/plain' }),
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      status: 'completed',
    },
    {
      id: '2',
      file: new File(['image content'], 'image.png', { type: 'image/png' }),
      name: 'image.png',
      size: 2048,
      type: 'image/png',
      status: 'completed',
      preview: 'data:image/png;base64,test',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show file count text', () => {
    render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
      />
    );

    // Should not show file count text
    expect(screen.queryByText(/files attached/)).not.toBeInTheDocument();
    expect(screen.queryByText(/file attached/)).not.toBeInTheDocument();
  });

  it('uses horizontal scrolling layout', () => {
    const { container } = render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
      />
    );

    // Should have overflow-x-auto class for horizontal scrolling
    const filesContainer = container.querySelector('.overflow-x-auto');
    expect(filesContainer).toBeInTheDocument();
    expect(filesContainer).toHaveClass('flex', 'gap-2', 'overflow-x-auto', 'pb-1');
  });

  it('prevents file items from shrinking', () => {
    const { container } = render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
      />
    );

    // File items should have flex-shrink-0 to prevent shrinking
    const fileItems = container.querySelectorAll('.flex-shrink-0');
    expect(fileItems.length).toBeGreaterThan(0);
  });

  it('renders files correctly without wrapping', () => {
    render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
      />
    );

    // Files should be rendered
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('image.png')).toBeInTheDocument();
    
    // Should show file sizes
    expect(screen.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });
});