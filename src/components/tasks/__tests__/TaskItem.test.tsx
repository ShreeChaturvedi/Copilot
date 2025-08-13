/**
 * Tests for TaskItem component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TaskItem } from '../TaskItem';
import type { Task } from "@shared/types";
import AttachmentPreviewDialog from '../AttachmentPreviewDialog';

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const mockTask: Task = {
  id: 'test-task-1',
  title: 'Test Task',
  completed: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  userId: 'test-user-1',
};

const completedTask: Task = {
  ...mockTask,
  id: 'completed-task',
  title: 'Completed Task',
  completed: true,
};

const scheduledTask: Task = {
  ...mockTask,
  id: 'scheduled-task',
  title: 'Scheduled Task',
  scheduledDate: new Date('2024-01-15'),
};

const renderTaskItem = (task: Task = mockTask, props = {}) => {
  const Wrapper = createWrapper();
  const defaultProps = {
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSchedule: vi.fn(),
    ...props
  };
  return render(
    <Wrapper>
      <TaskItem task={task} {...defaultProps} />
    </Wrapper>
  );
};

describe('TaskItem Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render task title', () => {
      renderTaskItem();
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should render completed task with strikethrough', () => {
      renderTaskItem(completedTask);
      
      const title = screen.getByText('Completed Task');
      expect(title).toHaveClass('line-through');
    });

    it('should render scheduled task with calendar icon', () => {
      renderTaskItem(scheduledTask);
      
      expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
      // Should show calendar icon for scheduled tasks
      expect(screen.getByText('1/14/2024')).toBeInTheDocument();
      // Check that the calendar icon SVG is present
      const calendarSvg = document.querySelector('.lucide-calendar');
      expect(calendarSvg).toBeInTheDocument();
    });

    it('should show dropdown menu trigger', () => {
      renderTaskItem();
      
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      expect(menuTrigger).toBeInTheDocument();
    });
  });

  describe('Task Completion', () => {
    it('should toggle task completion when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      
      renderTaskItem(mockTask, { onToggle });
      
      const checkbox = screen.getByRole('checkbox', { name: /Mark "Test Task" as complete/ });
      await user.click(checkbox);
      
      expect(onToggle).toHaveBeenCalledWith('test-task-1');
    });

    it('should show checked state for completed tasks', () => {
      renderTaskItem(completedTask);
      
      const checkbox = screen.getByRole('checkbox', { name: /Mark "Completed Task" as incomplete/ });
      expect(checkbox).toBeChecked();
    });
  });

  describe('Inline Editing', () => {
    it('should enter edit mode when task title is clicked', async () => {
      const user = userEvent.setup();
      
      renderTaskItem();
      
      const taskTitle = screen.getByText('Test Task');
      await user.click(taskTitle);
      
      // Should show input field
      const input = screen.getByDisplayValue('Test Task');
      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
    });

    it('should save changes when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      
      renderTaskItem(mockTask, { onEdit });
      
      // Enter edit mode
      const taskTitle = screen.getByText('Test Task');
      await user.click(taskTitle);
      
      const input = screen.getByDisplayValue('Test Task');
      
      // Edit the title
      await user.clear(input);
      await user.type(input, 'Updated Task Title');
      await user.keyboard('{Enter}');
      
      expect(onEdit).toHaveBeenCalledWith('test-task-1', 'Updated Task Title');
    });

    it('should cancel editing when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      
      renderTaskItem(mockTask, { onEdit });
      
      // Enter edit mode
      const taskTitle = screen.getByText('Test Task');
      await user.click(taskTitle);
      
      const input = screen.getByDisplayValue('Test Task');
      
      // Edit and cancel
      await user.clear(input);
      await user.type(input, 'Changed Title');
      await user.keyboard('{Escape}');
      
      // Should exit edit mode without saving
      expect(screen.queryByDisplayValue('Changed Title')).not.toBeInTheDocument();
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  describe('Dropdown Menu Actions', () => {
    it('should show schedule option in dropdown menu for incomplete tasks', async () => {
      const user = userEvent.setup();
      
      renderTaskItem(mockTask, { onSchedule: vi.fn() });
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      await user.click(menuTrigger);
      
      // Should show schedule option
      expect(screen.getByText('Schedule')).toBeInTheDocument();
      
      // Should show info icon for AutoScheduling
      const infoIcon = screen.getByLabelText('AutoScheduling information');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should not show schedule option for completed tasks', async () => {
      const user = userEvent.setup();
      
      renderTaskItem(completedTask, { onSchedule: vi.fn() });
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Completed Task"');
      await user.click(menuTrigger);
      
      // Should not show schedule option
      expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
    });

    it('should call onSchedule when schedule option is clicked', async () => {
      const user = userEvent.setup();
      const onSchedule = vi.fn();
      
      renderTaskItem(mockTask, { onSchedule });
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      await user.click(menuTrigger);
      
      // Click schedule option
      const scheduleOption = screen.getByText('Schedule');
      await user.click(scheduleOption);
      
      expect(onSchedule).toHaveBeenCalledWith('test-task-1');
    });

    it('should show info icon with proper accessibility', async () => {
      const user = userEvent.setup();
      
      renderTaskItem(mockTask, { onSchedule: vi.fn() });
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      await user.click(menuTrigger);
      
      // Should show info icon with proper aria-label
      const infoIcon = screen.getByLabelText('AutoScheduling information');
      expect(infoIcon).toBeInTheDocument();
      expect(infoIcon).toHaveClass('cursor-help');
    });

    it('should show delete option in dropdown menu', async () => {
      const user = userEvent.setup();
      
      renderTaskItem();
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      await user.click(menuTrigger);
      
      // Should show delete option
      const deleteOption = screen.getByText('Delete');
      expect(deleteOption).toBeInTheDocument();
      // The parent menu item should have destructive styling
      expect(deleteOption.closest('[data-slot="dropdown-menu-item"]')).toHaveClass('text-destructive');
    });

    it('should call onDelete when delete option is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      
      renderTaskItem(mockTask, { onDelete });
      
      // Open the dropdown menu
      const menuTrigger = screen.getByLabelText('Task options for "Test Task"');
      await user.click(menuTrigger);
      
      // Click delete option
      const deleteOption = screen.getByText('Delete');
      await user.click(deleteOption);
      
      expect(onDelete).toHaveBeenCalledWith('test-task-1');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderTaskItem();
      
      const checkbox = screen.getByRole('checkbox', { name: /Mark "Test Task" as complete/ });
      expect(checkbox).not.toBeChecked();
    });

    it('should have proper menu trigger label', () => {
      renderTaskItem();
      
      expect(screen.getByLabelText('Task options for "Test Task"')).toBeInTheDocument();
    });

    it('should have proper edit input accessibility', async () => {
      const user = userEvent.setup();
      
      renderTaskItem();
      
      // Enter edit mode
      const taskTitle = screen.getByText('Test Task');
      await user.click(taskTitle);
      
      const input = screen.getByLabelText('Edit task title');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      renderTaskItem(mockTask, { className: 'custom-class' });
      
      const taskContainer = screen.getByText('Test Task').closest('.group\\/task');
      expect(taskContainer).toHaveClass('custom-class');
    });

    it('should apply dragging styles when isDragging is true', () => {
      renderTaskItem(mockTask, { isDragging: true });
      
      const taskContainer = screen.getByText('Test Task').closest('.group\\/task');
      expect(taskContainer).toHaveClass('opacity-50');
    });
  });

  it('opens attachment preview dialog when an attachment badge is clicked', async () => {
    const task = {
      id: 't1',
      title: 'Task with file',
      completed: false,
      createdAt: new Date(),
      attachments: [
        { id: 'a1', name: 'photo.jpg', type: 'image/jpeg', size: 1024, url: 'data:image/jpeg;base64,xxx', uploadedAt: new Date(), taskId: 't1' },
      ],
    } as any;

    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <TaskItem
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        calendarMode={false}
      />
    );

    const badge = await screen.findByTitle(/Preview photo.jpg/i);
    expect(badge).toBeInTheDocument();

    await userEvent.click(badge);

    // Dialog content should appear with file meta text
    expect(await screen.findByText(/photo.jpg/i)).toBeInTheDocument();
  });
});