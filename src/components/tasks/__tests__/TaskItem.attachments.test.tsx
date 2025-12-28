import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TaskItem } from '../TaskItem';
import type { Task, FileAttachment } from '@shared/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { attachmentsApi as mockedAttachmentsApi } from '@/services/api/attachments';

vi.mock('@/services/api/attachments', () => ({
  attachmentsApi: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../AttachmentPreviewDialog', () => ({
  default: ({
    open,
    attachment,
    onDelete,
  }: {
    open: boolean;
    attachment?: FileAttachment;
    onDelete?: (attachment: FileAttachment) => void;
  }) => {
    if (!open || !attachment) return null;
    return (
      <div>
        <div>{attachment.name}</div>
        <button type="button" onClick={() => onDelete?.(attachment)}>
          Delete attachment
        </button>
      </div>
    );
  },
}));

const baseTask: Task = {
  id: 't1',
  title: 'Test task',
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  attachments: [
    {
      id: 'a1',
      name: 'image.png',
      type: 'image/png',
      size: 1024,
      url: 'https://example.com/image.png',
      uploadedAt: new Date(),
      taskId: 't1',
    },
  ],
};

describe('TaskItem attachments', () => {
  it('opens preview dialog and deletes attachment', async () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={qc}>
        <TaskItem
          task={baseTask}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </QueryClientProvider>
    );

    // Open dialog
    const chip = await screen.findByText('image.png');
    fireEvent.click(chip);

    // Click delete button from preview dialog
    const deleteBtn = await screen.findByRole('button', {
      name: /delete attachment/i,
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(vi.mocked(mockedAttachmentsApi.delete)).toHaveBeenCalledWith('a1');
    });
  });
});
