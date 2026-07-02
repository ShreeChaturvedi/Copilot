/**
 * Tests for SmartTaskInput enhanced layout functionality
 * Verifies that all existing functionality works correctly in enhanced mode
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartTaskInput } from '../SmartTaskInput';

describe('SmartTaskInput Enhanced Layout Functionality', () => {
  const mockOnAddTask = vi.fn();
  const mockOnCreateTaskGroup = vi.fn();
  const mockOnSelectTaskGroup = vi.fn();

  const defaultTaskGroups = [
    {
      id: 'work',
      name: 'Work',
      iconId: 'Briefcase',
      color: '#3b82f6',
      description: 'Work tasks',
    },
    {
      id: 'personal',
      name: 'Personal',
      iconId: 'User',
      color: '#10b981',
      description: 'Personal tasks',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Input and Parsing', () => {
    it('supports multi-line input in enhanced layout', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          enableSmartParsing={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      const multiLineText = 'Complete project\nby tomorrow\nwith high priority';

      await user.type(textarea, multiLineText);

      expect(textarea).toHaveValue(multiLineText);
    });
  });

  describe('Task Submission', () => {
    it('submits task correctly in enhanced layout', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          taskGroups={defaultTaskGroups}
          activeTaskGroupId="work"
        />
      );

      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /add task/i });

      await user.type(textarea, 'Test task');
      await user.click(submitButton);

      expect(mockOnAddTask).toHaveBeenCalledWith(
        'Test task',
        'work',
        undefined
      );
    });

    it('submits task with Enter key in enhanced layout', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          taskGroups={defaultTaskGroups}
          activeTaskGroupId="work"
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test task{enter}');

      expect(mockOnAddTask).toHaveBeenCalledWith(
        'Test task',
        'work',
        undefined
      );
    });

    it('clears input after successful submission', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput onAddTask={mockOnAddTask} useEnhancedLayout={true} />
      );

      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /add task/i });

      await user.type(textarea, 'Test task');
      await user.click(submitButton);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  describe('Task Group Selection', () => {
    it('shows task group selector in enhanced layout', () => {
      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          taskGroups={defaultTaskGroups}
          activeTaskGroupId="work"
        />
      );

      // Task group selector should be present (look for the dropdown trigger)
      const taskGroupButton = screen.getByRole('button', {
        name: /current task group/i,
      });
      expect(taskGroupButton).toBeInTheDocument();
    });

    it('allows task group selection in enhanced layout', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          taskGroups={defaultTaskGroups}
          activeTaskGroupId="work"
          onSelectTaskGroup={mockOnSelectTaskGroup}
        />
      );

      const taskGroupButton = screen.getByRole('button', {
        name: /current task group/i,
      });
      await user.click(taskGroupButton);

      // Should show dropdown with task groups
      const personalOption = await screen.findByText('Personal');
      await user.click(personalOption);

      await waitFor(() => {
        expect(mockOnSelectTaskGroup).toHaveBeenCalledWith('personal');
      });
    });

    it('allows creating new task group in enhanced layout', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          taskGroups={defaultTaskGroups}
          activeTaskGroupId="work"
          onCreateTaskGroup={mockOnCreateTaskGroup}
        />
      );

      const taskGroupButton = screen.getByRole('button', {
        name: /current task group/i,
      });
      await user.click(taskGroupButton);

      const newListOption = await screen.findByText('New List');
      await user.click(newListOption);

      await waitFor(() => {
        expect(mockOnCreateTaskGroup).toHaveBeenCalled();
      });
    });
  });

  describe('Disabled State', () => {
    it('handles disabled state correctly in enhanced layout', () => {
      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          disabled={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /add task/i });

      expect(textarea).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('prevents submission when disabled', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          disabled={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /add task/i });
      await user.click(submitButton);

      expect(mockOnAddTask).not.toHaveBeenCalled();
    });
  });

  describe('Layout and Styling', () => {
    it('applies correct CSS classes in enhanced layout', () => {
      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          className="custom-class"
        />
      );

      const form = screen.getByRole('textbox').closest('form');
      expect(form).toBeInTheDocument();
      const container = form?.parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('shows confidence indicators when enabled', () => {
      render(
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          enableSmartParsing={true}
          showConfidence={true}
        />
      );

      // Component should render without errors
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles empty input gracefully', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput onAddTask={mockOnAddTask} useEnhancedLayout={true} />
      );

      const submitButton = screen.getByRole('button', { name: /add task/i });

      // Submit button should be disabled when input is empty
      expect(submitButton).toBeDisabled();

      await user.click(submitButton);
      expect(mockOnAddTask).not.toHaveBeenCalled();
    });

    it('handles whitespace-only input', async () => {
      const user = userEvent.setup();

      render(
        <SmartTaskInput onAddTask={mockOnAddTask} useEnhancedLayout={true} />
      );

      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /add task/i });

      await user.type(textarea, '   ');

      // Submit button should still be disabled for whitespace-only input
      expect(submitButton).toBeDisabled();
    });
  });
});
