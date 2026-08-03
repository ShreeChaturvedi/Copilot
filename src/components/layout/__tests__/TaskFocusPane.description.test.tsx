/**
 * Regression test for #71: the description typed in the inline smart input was
 * silently dropped on create because TaskFocusPane.handleAddTaskWithFiles (the
 * onAddTaskWithFiles / files path — the one EnhancedTaskInput actually calls)
 * built the addTask.mutate payload without `description`. This drives that exact
 * path and asserts the created task carries its description. Reverting the fix
 * makes `description` undefined and this test fails.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskFocusPane } from '../TaskFocusPane';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import type { SmartTaskData } from '@/components/smart-input/SmartTaskInput';

vi.mock('@/stores/uiStore', () => ({ useUIStore: vi.fn() }));
vi.mock('@/stores/settingsStore', () => ({ useSettingsStore: vi.fn() }));
vi.mock('@/hooks/useTaskManagement', () => ({ useTaskManagement: vi.fn() }));

// Keep the pane light: stub the heavy children we don't exercise.
vi.mock('@/components/tasks/TaskControls', () => ({
  TaskControls: () => <div data-testid="task-controls" />,
}));
vi.mock('@/components/tasks/TaskFolderGrid', () => ({
  TaskFolderGrid: () => <div data-testid="task-folder-grid" />,
}));
vi.mock('@/components/tasks/TaskPaneContainer', () => ({
  TaskPaneContainer: () => <div data-testid="task-pane-container" />,
}));

// Stub EnhancedTaskInput with a button that invokes onAddTaskWithFiles the way
// the real component does after the user types a title + description.
vi.mock('@/components/smart-input/EnhancedTaskInput', () => ({
  EnhancedTaskInput: (props: {
    onAddTaskWithFiles: (
      title: string,
      groupId: string | undefined,
      smart: SmartTaskData | undefined,
      files: unknown[]
    ) => void;
  }) => (
    <button
      data-testid="submit-with-desc"
      onClick={() =>
        props.onAddTaskWithFiles(
          'Buy milk',
          'default',
          {
            title: 'Buy milk',
            description: 'organic whole milk',
            originalInput: 'Buy milk',
            tags: [],
            confidence: 1,
          },
          []
        )
      }
    >
      submit
    </button>
  ),
}));

const mutate = vi.fn();

beforeEach(() => {
  mutate.mockClear();
  (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    dragState: { isDragging: false },
    taskViewMode: 'list',
    globalShowCompleted: false,
    taskPanes: [],
    maxTaskPanes: 3,
    addTaskPane: vi.fn(),
    selectedKanbanTaskListId: null,
  });
  (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    enhancedInputVisible: true,
    setEnhancedInputVisible: vi.fn(),
    enhancedInputTaskListId: '',
    setEnhancedInputTaskListId: vi.fn(),
  });
  (useTaskManagement as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    tasks: [],
    tasksLoading: false,
    addTask: { mutate, isPending: false },
    handleAddTask: vi.fn(),
    taskGroups: [{ id: 'default', name: 'Tasks' }],
    activeTaskGroupId: 'default',
    setShowCreateTaskDialog: vi.fn(),
    handleSelectTaskGroup: vi.fn(),
  });
});

describe('TaskFocusPane — #71 description threading', () => {
  it('includes the entered description in the create payload', async () => {
    render(<TaskFocusPane />);
    await userEvent.click(screen.getByTestId('submit-with-desc'));

    // handleAddTaskWithFiles is async (attachment data-URL resolve).
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Buy milk',
        description: 'organic whole milk',
      })
    );
  });
});
