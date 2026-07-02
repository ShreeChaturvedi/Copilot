/**
 * Kanban column-move reducer (test-audit §L4 / §6.7). The board's drag state is
 * driven through the keyboard path (Arrow Left/Right on a focused card), which
 * exercises the same commitMove logic a pointer drop would, with no DnD backend:
 *   - the COLUMN_ORDER transition (not_started <-> in_progress <-> done),
 *   - the status <-> completed linkage (entering done sets completed, leaving it
 *     clears completed),
 *   - the optimistic placement (the card re-renders in the target column before
 *     the mutation settles),
 *   - the board edges (no move past the first/last column).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '@shared/types';

const { updateMutate, state } = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  state: { tasks: [] as Task[] },
}));

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    updateTask: { mutate: updateMutate },
    deleteTask: { mutate: vi.fn() },
    scheduleTask: { mutate: vi.fn() },
  }),
}));

vi.mock('@/hooks/useTaskManagement', () => ({
  useTaskManagement: () => ({
    tasks: state.tasks,
    activeTaskGroupId: 'default',
    taskGroups: [
      { id: 'default', name: 'Tasks', color: '#0d97d5', emoji: '📋' },
    ],
  }),
}));

import { TaskKanbanBoard } from '../TaskKanbanBoard';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Task One',
  completed: false,
  status: 'not_started',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  ...over,
});

beforeAll(() => {
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof globalThis.requestAnimationFrame;
  }
});

afterEach(() => {
  vi.clearAllMocks();
  state.tasks = [];
});

describe('TaskKanbanBoard — keyboard column moves', () => {
  it('ArrowRight advances not_started -> in_progress (status only) and places the card', () => {
    state.tasks = [task({ status: 'not_started' })];
    render(<TaskKanbanBoard />);

    fireEvent.keyDown(screen.getByLabelText('Task One, Not started'), {
      key: 'ArrowRight',
    });

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: 't1',
      updates: { status: 'in_progress' },
    });
    // Optimistic placement: the card now lives in the In progress column
    expect(screen.getByLabelText('Task One, In progress')).toBeInTheDocument();
  });

  it('ArrowRight into done sets completed = true', () => {
    state.tasks = [task({ status: 'in_progress' })];
    render(<TaskKanbanBoard />);

    fireEvent.keyDown(screen.getByLabelText('Task One, In progress'), {
      key: 'ArrowRight',
    });

    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: 't1',
      updates: { status: 'done', completed: true },
    });
  });

  it('ArrowLeft out of done clears completed = false', () => {
    state.tasks = [task({ status: 'done', completed: true })];
    render(<TaskKanbanBoard />);

    fireEvent.keyDown(screen.getByLabelText('Task One, Done'), {
      key: 'ArrowLeft',
    });

    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: 't1',
      updates: { status: 'in_progress', completed: false },
    });
  });

  it('does not move (or mutate) past the first column', () => {
    state.tasks = [task({ status: 'not_started' })];
    render(<TaskKanbanBoard />);

    fireEvent.keyDown(screen.getByLabelText('Task One, Not started'), {
      key: 'ArrowLeft',
    });

    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Task One, Not started')).toBeInTheDocument();
  });
});
