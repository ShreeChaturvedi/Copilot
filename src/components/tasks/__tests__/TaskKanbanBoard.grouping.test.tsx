/**
 * Evidence for #74 (triage): "Kanban board shows only the placeholder 'default'
 * group; tasks in a real list never appear."
 *
 * This renders the REAL TaskKanbanBoard over MSW with the real useTaskManagement
 * + useTasks hooks and real stores — nothing about the grouping/hydration path
 * is mocked. When /api/task-lists returns a real list ("General") and /api/tasks
 * returns a task assigned to it, the board:
 *   1. hydrates taskGroups from the placeholder to the real "General" list and
 *      makes it the active group (disproving "never replaces its placeholder"),
 *   2. groups the real-list task under "General" so the card appears,
 *   3. correctly excludes a task that belongs to a *different* list.
 *
 * It passes on the unmodified frontend, which shows the product grouping path is
 * correct. The symptom in #74 was reproduced only against the dev-server, where
 * the authenticated SPA received an EMPTY /api/task-lists (the dev-user-id auth
 * drift, #31): with no lists, taskGroups stays the 'default' placeholder and a
 * real-list task is filtered out. That is a data/auth artifact, not a grouping
 * bug — this test is the regression guard for the grouping path itself.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import type { Task } from '@shared/types';
import { makeWrapper, ok } from '@/test/optimistic';
import { useUIStore } from '@/stores/uiStore';
import { taskQueryKeys } from '@/hooks/useTasks';
import { TaskKanbanBoard } from '../TaskKanbanBoard';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const list = (id: string, name: string) => ({
  id,
  name,
  color: '#10b981',
  icon: '📁',
  description: '',
});

const taskRow = (over: Record<string, unknown>) => ({
  completed: false,
  status: 'NOT_STARTED',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

describe('#74 — Kanban groups tasks by their real task list', () => {
  it('populates a real list with its task (not just the default placeholder)', async () => {
    // No forced board scope: fall back to the (hydrated) active group.
    useUIStore.setState({ selectedKanbanTaskListId: null });

    server.use(
      http.get('/api/task-lists', () => ok([list('list-general', 'General')])),
      http.get('/api/tasks', () =>
        ok([
          taskRow({
            id: 't-general',
            title: 'Ship the release',
            taskListId: 'list-general',
          }),
          taskRow({
            id: 't-other',
            title: 'Belongs elsewhere',
            taskListId: 'list-other',
          }),
        ])
      )
    );

    const { Wrapper } = makeWrapper();
    render(<TaskKanbanBoard />, { wrapper: Wrapper });

    // The real-list task appears once the lists hydrate and become active.
    expect(await screen.findByText('Ship the release')).toBeInTheDocument();
    // A task in a different list is correctly excluded from this board scope.
    expect(screen.queryByText('Belongs elsewhere')).not.toBeInTheDocument();
  });

  it('reproduces the #74 symptom when the list fetch is EMPTY (the artifact)', async () => {
    useUIStore.setState({ selectedKanbanTaskListId: null });

    // The dev-user-id auth drift: the authenticated SPA gets no task lists back,
    // even though the task itself carries a real taskListId.
    server.use(
      http.get('/api/task-lists', () => ok([])),
      http.get('/api/tasks', () =>
        ok([
          taskRow({
            id: 't-general',
            title: 'Ship the release',
            taskListId: 'list-general',
          }),
        ])
      )
    );

    const { Wrapper, queryClient } = makeWrapper();
    render(<TaskKanbanBoard />, { wrapper: Wrapper });

    // Wait until the task has actually loaded into the cache, so the assertion
    // proves it is FILTERED OUT (not merely not-yet-fetched).
    await waitFor(() =>
      expect(queryClient.getQueryData<Task[]>(taskQueryKeys.all)).toHaveLength(
        1
      )
    );

    // The symptom: with no lists loaded, taskGroups stays the 'default'
    // placeholder, so the real-list task is filtered out of the board. This is
    // the data/auth artifact, not a grouping-logic bug.
    expect(screen.queryByText('Ship the release')).not.toBeInTheDocument();
  });
});
