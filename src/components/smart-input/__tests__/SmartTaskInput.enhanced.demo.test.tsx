/**
 * Demo test for SmartTaskInput enhanced layout functionality
 * Demonstrates that all key features work correctly in enhanced mode
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SmartTaskInput } from '../SmartTaskInput';

describe('SmartTaskInput Enhanced Layout Demo', () => {
  const mockOnAddTask = vi.fn();

  const taskGroups = [
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

  it('demonstrates enhanced layout with all features working', async () => {
    const user = userEvent.setup();

    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
        showConfidence={true}
        taskGroups={taskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
        onCreateTaskGroup={vi.fn()}
      />
    );

    // 1. Verify enhanced layout structure
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName.toLowerCase()).toBe('textarea'); // Should be textarea, not input

    // 2. Verify task group selector is present
    const taskGroupButton = screen.getByRole('button', {
      name: /current task group/i,
    });
    expect(taskGroupButton).toBeInTheDocument();

    // 3. Verify submit button is present
    const submitButton = screen.getByRole('button', { name: /add task/i });
    expect(submitButton).toBeInTheDocument();

    // 4. Test multi-line input capability
    const multiLineText = 'Complete project\nReview code\nDeploy to production';
    await user.type(textarea, multiLineText);
    expect(textarea).toHaveValue(multiLineText);

    // 5. Test task submission
    await user.clear(textarea);
    await user.type(textarea, 'Test enhanced layout task');
    await user.click(submitButton);

    expect(mockOnAddTask).toHaveBeenCalled();
    const [title, groupId, smartData] = mockOnAddTask.mock.calls[0] ?? [];
    expect(title).toBe('Test enhanced layout task');
    expect(groupId).toBe('work');

    if (smartData) {
      expect(smartData).toEqual(
        expect.objectContaining({
          title: 'Test enhanced layout task',
          originalInput: 'Test enhanced layout task',
        })
      );
    } else {
      expect(smartData).toBeUndefined();
    }

    // 6. Verify input is cleared after submission
    expect(textarea).toHaveValue('');
  });

  it('demonstrates smart parsing in enhanced layout', async () => {
    const user = userEvent.setup();

    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
        showConfidence={true}
      />
    );

    const textarea = screen.getByRole('textbox');

    // Type text that should trigger smart parsing
    await user.type(textarea, 'Meeting with client tomorrow high priority');

    // Verify the text is entered correctly
    expect(textarea).toHaveValue('Meeting with client tomorrow high priority');

    // The parsing happens asynchronously, so we just verify the input works
    // The actual parsing is tested in other test files
  });

  it('demonstrates disabled state in enhanced layout', () => {
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

  it('demonstrates fallback to regular layout when useEnhancedLayout is false', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={false}
        useFlexInputGroup={true}
        enableSmartParsing={false}
      />
    );

    const input = screen.getByRole('textbox');

    // Should be regular input, not textarea
    expect(input.tagName.toLowerCase()).toBe('input');
  });
});
