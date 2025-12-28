import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TaskList } from '../TaskList';
import { useUIStore } from '@/stores/uiStore';
import type { Task } from '@shared/types';

vi.mock('../TaskItem', () => ({
  TaskItem: ({
    task,
    calendarMode,
    showTaskListLabel,
  }: {
    task: Task;
    calendarMode?: boolean;
    showTaskListLabel?: boolean;
  }) => (
    <div
      data-testid="task-item"
      data-task-id={task.id}
      data-calendar-mode={calendarMode ? 'true' : 'false'}
      data-show-label={showTaskListLabel ? 'true' : 'false'}
    >
      {task.title}
    </div>
  ),
}));

vi.mock('@/components/dialogs/CreateTaskDialog', () => ({
  CreateTaskDialog: () => null,
}));

vi.mock('@/components/ui/CursorTooltip', () => ({
  CursorTooltip: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Pending Task 1',
    completed: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userId: 'test-user',
    priority: 'medium',
    taskListId: 'list-1',
  },
  {
    id: '2',
    title: 'Completed Task',
    completed: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    userId: 'test-user',
    priority: 'low',
    taskListId: 'list-1',
  },
  {
    id: '3',
    title: 'Scheduled Task',
    completed: false,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    userId: 'test-user',
    scheduledDate: new Date('2024-01-15'),
    priority: 'high',
    taskListId: 'list-1',
  },
  {
    id: '4',
    title: 'Another Pending Task',
    completed: false,
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    userId: 'test-user',
    priority: 'medium',
    taskListId: 'list-2',
  },
];

const mockTaskGroups = [
  {
    id: 'list-1',
    name: 'Work',
    emoji: '💼',
    color: '#3b82f6',
    description: 'Work tasks',
  },
  {
    id: 'list-2',
    name: 'Personal',
    emoji: '🏠',
    color: '#ef4444',
    description: 'Personal tasks',
  },
];

const renderTaskList = (
  props: Partial<React.ComponentProps<typeof TaskList>> = {}
) => {
  const defaultProps = {
    tasks: mockTasks,
    taskGroups: mockTaskGroups,
    activeTaskGroupId: 'all',
    onToggleTask: vi.fn(),
    onEditTask: vi.fn(),
    onDeleteTask: vi.fn(),
  };

  return render(<TaskList {...defaultProps} {...props} />);
};

describe('TaskList Component', () => {
  beforeEach(() => {
    useUIStore.setState({ globalShowCompleted: true });
  });

  it('renders empty state when no tasks exist', () => {
    renderTaskList({ tasks: [] });

    const emptyMessage = screen.getByText(/Your tasks will appear here/i);
    expect(emptyMessage).toBeInTheDocument();
    expect(emptyMessage).toHaveTextContent(/once you add them/i);
    expect(screen.queryByTestId('task-item')).not.toBeInTheDocument();
  });

  it('renders tasks passed via props', () => {
    renderTaskList({ activeTaskGroupId: 'all' });

    expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
    expect(screen.getByText('Completed Task')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
    expect(screen.getByText('Another Pending Task')).toBeInTheDocument();
  });

  it('filters tasks by active task group', () => {
    renderTaskList({ activeTaskGroupId: 'list-1' });

    expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
    expect(screen.getByText('Completed Task')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
    expect(screen.queryByText('Another Pending Task')).not.toBeInTheDocument();
  });

  it('hides completed tasks when globalShowCompleted is false', () => {
    useUIStore.setState({ globalShowCompleted: false });

    renderTaskList({ activeTaskGroupId: 'list-1' });

    expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
  });

  it('shows completed tasks when globalShowCompleted is true', () => {
    useUIStore.setState({ globalShowCompleted: true });

    renderTaskList({ activeTaskGroupId: 'list-1' });

    expect(screen.getByText('Completed Task')).toBeInTheDocument();
  });

  it('renders calendar mode grouping and overflow indicator', () => {
    const calendarTasks: Task[] = [
      {
        id: 'cal-1',
        title: 'Calendar Task 1',
        completed: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        taskListId: 'list-1',
      },
      {
        id: 'cal-2',
        title: 'Calendar Task 2',
        completed: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        taskListId: 'list-1',
      },
    ];

    renderTaskList({
      tasks: calendarTasks,
      activeTaskGroupId: 'list-1',
      calendarMode: true,
      maxTasks: 1,
    });

    expect(screen.getByText('No Due Date')).toBeInTheDocument();
    expect(screen.getByText('Calendar Task 1')).toBeInTheDocument();
    expect(screen.getByText('+1 more upcoming tasks')).toBeInTheDocument();
  });

  it('passes showTaskListLabels to task items', () => {
    renderTaskList({ showTaskListLabels: true, activeTaskGroupId: 'list-1' });

    const items = screen.getAllByTestId('task-item');
    items.forEach((item) => {
      expect(item).toHaveAttribute('data-show-label', 'true');
    });
  });

  it('hides header when hideHeader is true', () => {
    renderTaskList({ hideHeader: true, activeTaskGroupId: 'list-1' });

    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
  });

  it('updates when globalShowCompleted toggles after render', async () => {
    renderTaskList({ activeTaskGroupId: 'list-1' });

    expect(screen.getByText('Completed Task')).toBeInTheDocument();

    act(() => {
      useUIStore.setState({ globalShowCompleted: false });
    });

    await waitFor(() => {
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
    });
  });
});
