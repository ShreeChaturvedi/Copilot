/**
 * Tests for TaskInput component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskInput, type TaskGroup } from '../TaskInput';

const taskGroups: TaskGroup[] = [
  {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    color: '#3b82f6',
  },
  {
    id: 'personal',
    name: 'Personal',
    emoji: '🏠',
    color: '#10b981',
  },
];

const renderTaskInput = (
  props?: Partial<React.ComponentProps<typeof TaskInput>>
) => {
  const defaultProps = {
    onAddTask: vi.fn(),
    ...props,
  };

  return render(<TaskInput {...defaultProps} />);
};

describe('TaskInput Component', () => {
  it('renders input with placeholder and label', () => {
    renderTaskInput();

    const input = screen.getByRole('textbox', { name: 'New task input' });
    expect(input).toHaveAttribute('placeholder', 'Add Task');
  });

  it('submits task with active group', async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();

    renderTaskInput({
      onAddTask,
      taskGroups,
      activeTaskGroupId: 'work',
    });

    const input = screen.getByRole('textbox', { name: 'New task input' });
    await user.type(input, 'test task{enter}');

    expect(onAddTask).toHaveBeenCalledWith('Test task', 'work');
    expect(input).toHaveValue('');
  });

  it('uses default group when no groups are provided', async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();

    renderTaskInput({ onAddTask });

    const input = screen.getByRole('textbox', { name: 'New task input' });
    await user.type(input, 'hello{enter}');

    expect(onAddTask).toHaveBeenCalledWith('Hello', 'default');
  });

  it('disables input and submit when disabled', () => {
    renderTaskInput({ disabled: true });

    const input = screen.getByRole('textbox', { name: 'New task input' });
    const submitButton = screen.getByRole('button', { name: 'Add task' });

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('invokes task group selection callbacks', async () => {
    const user = userEvent.setup();
    const onSelectTaskGroup = vi.fn();
    const onCreateTaskGroup = vi.fn();

    renderTaskInput({
      taskGroups,
      activeTaskGroupId: 'work',
      onSelectTaskGroup,
      onCreateTaskGroup,
    });

    const trigger = screen.getByRole('button', { name: /current task group/i });
    await user.click(trigger);

    await user.click(await screen.findByText('Personal'));
    await waitFor(() => {
      expect(onSelectTaskGroup).toHaveBeenCalledWith('personal');
    });

    await user.click(trigger);
    await user.click(await screen.findByText('New List'));
    await waitFor(() => {
      expect(onCreateTaskGroup).toHaveBeenCalled();
    });
  });
});
