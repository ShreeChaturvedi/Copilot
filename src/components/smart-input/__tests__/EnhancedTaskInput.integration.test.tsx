/**
 * Integration tests for EnhancedTaskInput with enhanced layout
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancedTaskInput } from '../EnhancedTaskInput';

// Mock the tooltip components to avoid provider issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('EnhancedTaskInput Integration', () => {
  const mockOnAddTask = vi.fn();

  it('renders with enhanced layout structure', () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        enableSmartParsing={true}
        placeholder="What would you like to work on?"
      />
    );

    // Should render textarea (multi-line input)
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea).toHaveAttribute(
      'placeholder',
      'What would you like to work on?'
    );
  });

  it('has controls positioned below the input', () => {
    render(
      <EnhancedTaskInput onAddTask={mockOnAddTask} enableSmartParsing={true} />
    );

    // Should have submit button
    const submitButton = screen.getByRole('button', { name: /add task/i });
    expect(submitButton).toBeInTheDocument();

    // Should have task group selector
    const taskGroupCombobox = screen.getByRole('combobox');
    expect(taskGroupCombobox).toBeInTheDocument();
  });

  it('shows task group selector with default group', () => {
    render(
      <EnhancedTaskInput
        onAddTask={mockOnAddTask}
        taskGroups={[
          {
            id: 'default',
            name: 'Tasks',
            iconId: 'CheckSquare',
            color: '#3b82f6',
            description: 'Default task group',
          },
        ]}
        activeTaskGroupId="default"
      />
    );

    // Should show the task group name
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders additional control buttons', () => {
    render(
      <EnhancedTaskInput onAddTask={mockOnAddTask} enableSmartParsing={true} />
    );

    // Should have file attachment, voice input, and more options buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2); // At least task group, submit, and additional controls
  });

  it('handles disabled state correctly', () => {
    render(<EnhancedTaskInput onAddTask={mockOnAddTask} disabled={true} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();

    const submitButton = screen.getByRole('button', { name: /add task/i });
    expect(submitButton).toBeDisabled();
  });
});
