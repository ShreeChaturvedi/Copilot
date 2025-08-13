import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TaskItem } from '../TaskItem';
import type { Task } from '@shared/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/api/attachments', () => ({
  attachmentsApi: {
    delete: vi.fn().mockResolvedValue(undefined),
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

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

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

    // Dialog shows title
    await screen.findByText('image.png');

    // Click delete button
    const deleteBtn = screen.getByRole('button', { name: /delete attachment/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(require('@/services/api/attachments').attachmentsApi.delete).toHaveBeenCalledWith('a1');
    });
  });
});