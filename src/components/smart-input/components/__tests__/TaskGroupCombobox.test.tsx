/**
 * TaskGroupCombobox Component Tests
 * 
 * Tests the TaskGroupCombobox component functionality including:
 * - Rendering with task groups
 * - Selection handling
 * - Search functionality
 * - New list creation
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TaskGroupCombobox } from '../TaskGroupCombobox';
import { TaskGroup } from '../../../tasks/TaskInput';

// Mock ResizeObserver for testing environment
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

const mockTaskGroups: TaskGroup[] = [
  {
    id: 'work',
    name: 'Work',
    iconId: 'Briefcase',
    color: '#3b82f6',
    description: 'Work tasks'
  },
  {
    id: 'personal',
    name: 'Personal',
    iconId: 'Home',
    color: '#10b981',
    description: 'Personal tasks'
  }
];

describe('TaskGroupCombobox', () => {
  it('renders with active task group', () => {
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
      />
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('opens popover when clicked', () => {
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('calls onSelectTaskGroup when option is selected', () => {
    const handleSelect = vi.fn();
    
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={handleSelect}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const personalOption = screen.getByText('Personal');
    fireEvent.click(personalOption);

    expect(handleSelect).toHaveBeenCalledWith('personal');
  });

  it('shows new list option when onCreateTaskGroup is provided', () => {
    const handleCreate = vi.fn();
    
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
        onCreateTaskGroup={handleCreate}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(screen.getByText('New List')).toBeInTheDocument();
  });

  it('calls onCreateTaskGroup when new list is clicked', () => {
    const handleCreate = vi.fn();
    
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
        onCreateTaskGroup={handleCreate}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const newListOption = screen.getByText('New List');
    fireEvent.click(newListOption);

    expect(handleCreate).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <TaskGroupCombobox
        taskGroups={mockTaskGroups}
        activeTaskGroupId="work"
        onSelectTaskGroup={vi.fn()}
        disabled={true}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });
});