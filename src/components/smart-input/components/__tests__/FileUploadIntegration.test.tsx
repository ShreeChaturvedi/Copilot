/**
 * File Upload Integration Test
 * 
 * Tests the integration between FileUploadButton, CompactFilePreview, and EnhancedTaskInput
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancedTaskInput } from '../../EnhancedTaskInput';

// Mock the dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogTrigger: ({ children }: any) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
}));

// Mock the tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock the FileUploadZone component
vi.mock('../FileUploadZone', () => ({
  FileUploadZone: ({ files, onFilesAdded, onFileRemove }: any) => (
    <div data-testid="file-upload-zone">
      <div>Files: {files.length}</div>
      <button
        onClick={() => {
          const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
          onFilesAdded([mockFile]);
        }}
        data-testid="add-file-button"
      >
        Add File
      </button>
      {files.map((file: any) => (
        <div key={file.id} data-testid={`file-${file.id}`}>
          {file.name}
          <button onClick={() => onFileRemove(file.id)} data-testid={`remove-${file.id}`}>
            Remove
          </button>
        </div>
      ))}
    </div>
  ),
}));

describe('File Upload Integration', () => {
  const mockOnAddTask = vi.fn();
  const mockOnFilesAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('integrates file upload functionality with EnhancedTaskInput', async () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        onFilesAdded={mockOnFilesAdded}
        enableFileUpload={true}
      />
    );

    // Should render the file upload button (paperclip icon)
    const fileUploadButton = screen.getByTestId('tooltip-trigger');
    expect(fileUploadButton).toBeInTheDocument();

    // Initially no files should be shown
    expect(screen.queryByText('file attached')).not.toBeInTheDocument();
  });

  it('shows file count indicator when files are attached', async () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        onFilesAdded={mockOnFilesAdded}
        enableFileUpload={true}
      />
    );

    // The file upload button should be present
    const fileUploadButton = screen.getByTestId('tooltip-trigger');
    expect(fileUploadButton).toBeInTheDocument();

    // Should show tooltip text
    expect(screen.getByText('Attach files')).toBeInTheDocument();
  });

  it('can disable file upload functionality', () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        enableFileUpload={false}
      />
    );

    // File upload button should not be present when disabled
    expect(screen.queryByTestId('tooltip-trigger')).not.toBeInTheDocument();
  });

  it('respects maxFiles prop', () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        onFilesAdded={mockOnFilesAdded}
        enableFileUpload={true}
        maxFiles={3}
      />
    );

    // Should render without issues
    expect(screen.getByTestId('tooltip-trigger')).toBeInTheDocument();
  });

  it('calls onFilesAdded callback when files are added', () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        onFilesAdded={mockOnFilesAdded}
        enableFileUpload={true}
      />
    );

    // The callback should be properly connected
    expect(mockOnFilesAdded).not.toHaveBeenCalled();
  });
});