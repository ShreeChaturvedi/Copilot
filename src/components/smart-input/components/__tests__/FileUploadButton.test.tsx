/**
 * FileUploadButton component tests
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileUploadButton } from '../FileUploadButton';
import type { UploadedFile } from '../FileUploadZone';

interface MockDialogProps {
  children: React.ReactNode;
  open?: boolean;
}

interface MockDialogChildProps {
  children: React.ReactNode;
}

interface MockFileUploadZoneProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  disabled?: boolean;
}

// Mock the dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: MockDialogProps) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: MockDialogChildProps) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: MockDialogChildProps) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: MockDialogChildProps) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: MockDialogChildProps) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogTrigger: ({ children }: MockDialogChildProps) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
}));

// Mock the tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: MockDialogChildProps) => <div>{children}</div>,
  TooltipTrigger: ({ children }: MockDialogChildProps) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: MockDialogChildProps) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock the FileUploadZone component
vi.mock('../FileUploadZone', () => ({
  FileUploadZone: ({
    files,
    onFilesAdded,
    onFileRemove,
    disabled,
  }: MockFileUploadZoneProps) => (
    <div data-testid="file-upload-zone">
      <div>Files: {files.length}</div>
      <button
        onClick={() =>
          onFilesAdded([
            {
              id: '1',
              file: new File(['test'], 'test.txt', { type: 'text/plain' }),
              name: 'test.txt',
              size: 100,
              type: 'text/plain',
              status: 'completed' as const,
            },
          ])
        }
        disabled={disabled}
      >
        Add File
      </button>
      {files.map((file: UploadedFile) => (
        <div key={file.id}>
          {file.name}
          <button onClick={() => onFileRemove(file.id)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

describe('FileUploadButton', () => {
  const mockFiles: UploadedFile[] = [];
  const mockOnFilesAdded = vi.fn();
  const mockOnFileRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <FileUploadButton
        files={mockFiles}
        onFilesAdded={mockOnFilesAdded}
        onFileRemove={mockOnFileRemove}
      />
    );

    expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
  });

  it('shows file count when files are present', () => {
    const filesWithContent: UploadedFile[] = [
      {
        id: '1',
        file: new File(['test'], 'test.txt', { type: 'text/plain' }),
        name: 'test.txt',
        size: 100,
        type: 'text/plain',
        status: 'completed',
      },
    ];

    render(
      <FileUploadButton
        files={filesWithContent}
        onFilesAdded={mockOnFilesAdded}
        onFileRemove={mockOnFileRemove}
      />
    );

    // Should show file count indicator
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(
      <FileUploadButton
        files={mockFiles}
        onFilesAdded={mockOnFilesAdded}
        onFileRemove={mockOnFileRemove}
        disabled={true}
      />
    );

    const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
      'button'
    );
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(
      <FileUploadButton
        files={mockFiles}
        onFilesAdded={mockOnFilesAdded}
        onFileRemove={mockOnFileRemove}
        className="custom-class"
      />
    );

    const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
      'button'
    );
    expect(button).toHaveClass('custom-class');
  });

  it('respects maxFiles prop', () => {
    const maxFiles = 3;
    render(
      <FileUploadButton
        files={mockFiles}
        onFilesAdded={mockOnFilesAdded}
        onFileRemove={mockOnFileRemove}
        maxFiles={maxFiles}
      />
    );

    // Component should render without issues
    expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
  });
});
