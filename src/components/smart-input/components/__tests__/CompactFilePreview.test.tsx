/**
 * CompactFilePreview component tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompactFilePreview } from '../CompactFilePreview';
import { UploadedFile } from '../FileUploadZone';

describe('CompactFilePreview', () => {
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

  it('renders nothing when no files are provided', () => {
    const { container } = render(
      <CompactFilePreview files={[]} onFileRemove={mockOnFileRemove} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders files when provided', () => {
    render(
      <CompactFilePreview files={mockFiles} onFileRemove={mockOnFileRemove} />
    );

    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('image.png')).toBeInTheDocument();
  });

  it('displays file sizes correctly', () => {
    render(
      <CompactFilePreview files={mockFiles} onFileRemove={mockOnFileRemove} />
    );

    expect(screen.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('calls onFileRemove when remove button is clicked', () => {
    render(
      <CompactFilePreview files={mockFiles} onFileRemove={mockOnFileRemove} />
    );

    const removeButtons = screen.getAllByLabelText(/Remove/);
    fireEvent.click(removeButtons[0]);

    expect(mockOnFileRemove).toHaveBeenCalledWith('1');
  });

  it('handles disabled state', () => {
    render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        disabled={true}
      />
    );

    const removeButtons = screen.getAllByLabelText(/Remove/);
    expect(removeButtons[0]).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CompactFilePreview
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows image preview for image files', async () => {
    render(
      <CompactFilePreview files={mockFiles} onFileRemove={mockOnFileRemove} />
    );

    const imagePreview = await screen.findByAltText('Preview of image.png');
    expect(imagePreview).toBeInTheDocument();
    expect(imagePreview).toHaveAttribute('src', 'blob:mock');
  });

  it('renders single file correctly', () => {
    render(
      <CompactFilePreview
        files={[mockFiles[0]]}
        onFileRemove={mockOnFileRemove}
      />
    );

    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });
});
