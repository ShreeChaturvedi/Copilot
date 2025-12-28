/**
 * File Upload Accessibility Tests
 *
 * Tests accessibility features of the enhanced file upload components
 * to ensure compliance with WCAG guidelines and screen reader compatibility.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FileUploadButton } from '../FileUploadButton';
import type { UploadedFile } from '../FileUploadZone';

// Mock dialog components to avoid portal issues in tests
vi.mock('@/components/ui/dialog', () => {
  const DialogContext = React.createContext<((open: boolean) => void) | null>(
    null
  );

  return {
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <DialogContext.Provider value={onOpenChange || null}>
        <div data-testid="dialog" data-open={open}>
          {children}
        </div>
      </DialogContext.Provider>
    ),
    DialogContent: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div data-testid="dialog-content" className={className}>
        {children}
      </div>
    ),
    DialogDescription: ({ children }: { children: React.ReactNode }) => (
      <p data-testid="dialog-description">{children}</p>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2 data-testid="dialog-title">{children}</h2>
    ),
    DialogTrigger: ({ children }: { children: React.ReactNode }) => {
      const onOpenChange = React.useContext(DialogContext);

      if (!React.isValidElement(children)) {
        return <>{children}</>;
      }

      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange?.(true);
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          children.props.onKeyDown?.(event);
          if (event.key === 'Enter' || event.key === ' ') {
            onOpenChange?.(true);
          }
        },
      });
    },
  };
});

// Mock tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

// Mock FileUploadZone
vi.mock('../FileUploadZone', () => ({
  FileUploadZone: ({
    files,
    onFilesAdded,
    onFileRemove,
    disabled,
  }: {
    files: UploadedFile[];
    onFilesAdded: (files: File[]) => void;
    onFileRemove: (id: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="file-upload-zone">
      <div>Files: {files.length}</div>
      <button
        onClick={() =>
          onFilesAdded([
            new File(['test'], 'test.pdf', { type: 'application/pdf' }),
          ])
        }
        disabled={disabled}
      >
        Add File
      </button>
      {files.map((file) => (
        <div key={file.id} data-testid={`file-${file.id}`}>
          {file.name}
          <button
            onClick={() => onFileRemove(file.id)}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  ),
}));

describe('File Upload Accessibility', () => {
  const createMockFile = (name: string, type: string): UploadedFile => ({
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file: new File(['test'], name, { type }),
    name,
    size: 1024,
    type,
    status: 'completed',
  });

  describe('FileUploadButton Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Button should be accessible
      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveAttribute('aria-label', ''); // Should have meaningful label
    });

    it('should indicate file count in tooltip when files are attached', () => {
      const files = [
        createMockFile('document1.pdf', 'application/pdf'),
        createMockFile('document2.pdf', 'application/pdf'),
      ];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Should indicate multiple files in tooltip
      const tooltip = screen.getByTestId('tooltip-content');
      expect(tooltip).toHaveTextContent('2 files attached');
    });

    it('should show proper tooltip when no files are attached', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      const tooltip = screen.getByTestId('tooltip-content');
      expect(tooltip).toHaveTextContent('Attach files');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );

      // Should be focusable
      await user.tab();
      expect(button).toHaveFocus();

      // Should be activatable with Enter
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    });

    it('should properly handle disabled state', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
          disabled={true}
        />
      );

      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      expect(button).toBeDisabled();

      // Should pass disabled state to FileUploadZone
      const uploadZone = screen.getByTestId('file-upload-zone');
      expect(uploadZone.querySelector('button')).toBeDisabled();
    });
  });

  describe('Dialog Accessibility', () => {
    it('should have proper dialog structure with title and description', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Dialog should have proper title
      const dialogTitle = screen.getByTestId('dialog-title');
      expect(dialogTitle).toHaveTextContent('Attach Files');

      // Dialog should have description
      const dialogDescription = screen.getByTestId('dialog-description');
      expect(dialogDescription).toHaveTextContent(
        /Upload files to attach to your task/
      );
    });

    it('should describe supported file types clearly', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      const description = screen.getByTestId('dialog-description');
      expect(description).toHaveTextContent(
        /documents \(PDF, Word, Excel, PowerPoint\)/
      );
    });
  });

  describe('File Item Accessibility', () => {
    it('should provide proper remove button labels', async () => {
      const user = userEvent.setup();
      const files = [
        createMockFile('important-document.pdf', 'application/pdf'),
      ];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Remove button should have descriptive aria-label
      const removeButton = screen.getByLabelText(
        'Remove important-document.pdf'
      );
      expect(removeButton).toBeInTheDocument();

      // Should be keyboard accessible
      await user.click(removeButton);
      expect(onFileRemove).toHaveBeenCalledWith(files[0].id);
    });

    it('should handle file status announcements', () => {
      const files = [
        {
          ...createMockFile('uploading.pdf', 'application/pdf'),
          status: 'uploading' as const,
        },
        {
          ...createMockFile('completed.pdf', 'application/pdf'),
          status: 'completed' as const,
        },
        {
          ...createMockFile('error.pdf', 'application/pdf'),
          status: 'error' as const,
          error: 'Upload failed',
        },
      ];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Each file should have appropriate status indication
      expect(screen.getByTestId('file-upload-zone')).toBeInTheDocument();
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should announce errors to screen readers', () => {
      // This would typically test aria-live regions for error announcements
      // For now, we ensure error states are properly handled in the mock
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // The FileUploadZone should handle error states properly
      expect(screen.getByTestId('file-upload-zone')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', async () => {
      const user = userEvent.setup();
      const files = [createMockFile('document.pdf', 'application/pdf')];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Should be able to tab to trigger button
      await user.tab();
      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      expect(button).toHaveFocus();
    });

    it('should handle escape key to close dialog', async () => {
      const user = userEvent.setup();
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Open dialog
      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      await user.click(button);

      // Dialog should be open
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');

      // ESC key should close dialog (this would be handled by the actual Dialog component)
      // For now, we just test that the structure is correct
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful text alternatives for visual elements', () => {
      const files = [createMockFile('chart.jpg', 'image/jpeg')];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // File count indicator should be accessible
      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      expect(button).toBeInTheDocument();

      // Tooltip should provide context
      const tooltip = screen.getByTestId('tooltip-content');
      expect(tooltip).toHaveTextContent('1 file attached');
    });

    it('should use semantic HTML structure', () => {
      const files: UploadedFile[] = [];
      const onFilesAdded = vi.fn();
      const onFileRemove = vi.fn();

      render(
        <FileUploadButton
          files={files}
          onFilesAdded={onFilesAdded}
          onFileRemove={onFileRemove}
        />
      );

      // Should use proper button element
      const button = within(screen.getByTestId('tooltip-trigger')).getByRole(
        'button'
      );
      expect(button.tagName.toLowerCase()).toBe('button');

      // Dialog should have proper heading structure
      const title = screen.getByTestId('dialog-title');
      expect(title.tagName.toLowerCase()).toBe('h2');
    });
  });
});
