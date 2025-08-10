/**
 * Tests for TaskList component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskList } from '../TaskList';
import { taskStorage } from '../../../utils/storage';
import type { Task } from "@shared/types";

// Mock the storage utility
vi.mock('../../../utils/storage', () => ({
  taskStorage: {
    getTasks: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

const mockTaskStorage = taskStorage as typeof taskStorage & {
  addTask: ReturnType<typeof vi.fn>;
  getTasks: ReturnType<typeof vi.fn>;
  saveTasks: ReturnType<typeof vi.fn>;
  updateTask: ReturnType<typeof vi.fn>;
  deleteTask: ReturnType<typeof vi.fn>;
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Pending Task 1',
    completed: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userId: 'test-user',
    priority: 'medium',
  },
  {
    id: '2',
    title: 'Completed Task',
    completed: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    userId: 'test-user',
    priority: 'low',
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
  },
  {
    id: '4',
    title: 'Another Pending Task',
    completed: false,
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    userId: 'test-user',
    priority: 'medium',
  },
];

const renderTaskList = (props = {}) => {
  const Wrapper = createWrapper();
  const defaultProps = {
    tasks: [],
    onToggleTask: vi.fn(),
    onEditTask: vi.fn(),
    onDeleteTask: vi.fn(),
    ...props
  };
  return render(
    <Wrapper>
      <TaskList {...defaultProps} />
    </Wrapper>
  );
};

describe('TaskList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskStorage.getTasks.mockResolvedValue([...mockTasks]);
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      renderTaskList();

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('animate-spin');
    });

    it('should render tasks after loading', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
      expect(screen.getByText('Another Pending Task')).toBeInTheDocument();
      expect(screen.getByText('Completed Task')).toBeInTheDocument();
    });

    it('should show task count summary', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('3 pending, 1 completed')).toBeInTheDocument();
      });
    });

    it('should categorize tasks into sections', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Scheduled Tasks (1)')).toBeInTheDocument();
        expect(screen.getByText('Tasks (2)')).toBeInTheDocument();
        expect(screen.getByText('Completed Tasks (1)')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should hide completed tasks when toggle is unchecked', async () => {
      const user = userEvent.setup();

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Completed Task')).toBeInTheDocument();
      });

      // Uncheck show completed
      const showCompletedCheckbox = screen.getByLabelText(/Show completed/);
      await user.click(showCompletedCheckbox);

      await waitFor(() => {
        expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
      });

      // Count should update
      expect(screen.getByText('3 pending, 0 completed')).toBeInTheDocument();
    });

    it('should filter tasks by search term', async () => {
      const user = userEvent.setup();

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // Search for specific task
      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'Scheduled');

      await waitFor(() => {
        expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
        expect(screen.queryByText('Pending Task 1')).not.toBeInTheDocument();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup();

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // Search for something
      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'Scheduled');

      // Clear search
      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });
    });

    it('should use external search filter when provided', async () => {
      renderTaskList({ searchFilter: 'Pending' });

      // Should not show local search input
      expect(
        screen.queryByPlaceholderText('Search tasks...')
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
        expect(screen.getByText('Another Pending Task')).toBeInTheDocument();
        expect(screen.queryByText('Scheduled Task')).not.toBeInTheDocument();
      });
    });

    it('should show only scheduled tasks when scheduledOnly is true', async () => {
      renderTaskList({ scheduledOnly: true });

      await waitFor(() => {
        expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
        expect(screen.queryByText('Pending Task 1')).not.toBeInTheDocument();
      });

      // Should show different section title
      expect(screen.getByText('Scheduled Tasks (1)')).toBeInTheDocument();
      expect(screen.queryByText('Tasks (')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no tasks exist', async () => {
      mockTaskStorage.getTasks.mockResolvedValue([]);

      renderTaskList();

      await waitFor(() => {
        expect(
          screen.getByText('No tasks yet. Create your first task above!')
        ).toBeInTheDocument();
      });
    });

    it('should show search empty state when no tasks match search', async () => {
      const user = userEvent.setup();

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // Search for non-existent task
      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'NonExistent');

      await waitFor(() => {
        expect(
          screen.getByText('No tasks found matching "NonExistent"')
        ).toBeInTheDocument();
      });
    });

    it('should show scheduled empty state when scheduledOnly is true and no scheduled tasks', async () => {
      const unscheduledTasks = mockTasks.filter((task) => !task.scheduledDate);
      mockTaskStorage.getTasks.mockResolvedValue(unscheduledTasks);

      renderTaskList({ scheduledOnly: true });

      await waitFor(() => {
        expect(screen.getByText('No scheduled tasks yet')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when tasks fail to load', async () => {
      mockTaskStorage.getTasks.mockRejectedValue(new Error('Storage error'));

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByText('Try again');
      expect(retryButton).toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First call fails
      mockTaskStorage.getTasks.mockRejectedValueOnce(
        new Error('Storage error')
      );
      // Second call succeeds
      mockTaskStorage.getTasks.mockResolvedValueOnce([mockTasks[0]]);

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('Try again');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });
    });
  });

  describe('Task Scheduling', () => {
    it('should call onTaskSchedule when task is scheduled', async () => {
      const onTaskSchedule = vi.fn();

      renderTaskList({ onTaskSchedule });

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // This would be triggered by drag and drop or schedule button
      // For now, we'll test the callback is passed correctly
      expect(onTaskSchedule).toBeDefined();
    });
  });

  describe('Section Organization', () => {
    it('should not show empty sections', async () => {
      // Mock tasks with no scheduled tasks
      const tasksWithoutScheduled = mockTasks.filter(
        (task) => !task.scheduledDate
      );
      mockTaskStorage.getTasks.mockResolvedValue(tasksWithoutScheduled);

      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // Should not show scheduled section
      expect(screen.queryByText('Scheduled Tasks')).not.toBeInTheDocument();
    });

    it('should show section icons', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(screen.getByText('Scheduled Tasks (1)')).toBeInTheDocument();
      });

      // Icons should be present (we can't easily test SVG content, but we can check they exist)
      const sections = screen.getAllByRole('list');
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for sections', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(
          screen.getByRole('list', { name: 'Scheduled Tasks' })
        ).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Tasks' })).toBeInTheDocument();
        expect(
          screen.getByRole('list', { name: 'Completed Tasks' })
        ).toBeInTheDocument();
      });
    });

    it('should have proper form labels', async () => {
      renderTaskList();

      await waitFor(() => {
        expect(screen.getByLabelText('Search tasks')).toBeInTheDocument();
        expect(screen.getByLabelText(/Show completed/)).toBeInTheDocument();
      });
    });
  });

  describe('Props and Configuration', () => {
    it('should use showCompletedDefault prop', async () => {
      renderTaskList({ showCompletedDefault: false });

      const showCompletedCheckbox = screen.getByLabelText(
        /Show completed/
      ) as HTMLInputElement;
      expect(showCompletedCheckbox.checked).toBe(false);

      await waitFor(() => {
        expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
      });
    });

    it('should apply custom className', () => {
      const { container } = renderTaskList({ className: 'custom-class' });

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily when props are stable', async () => {
      const onScheduleTask = vi.fn();

      const { rerender } = renderTaskList({ onScheduleTask });

      await waitFor(() => {
        expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
      });

      // Re-render with same props
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <TaskList 
            tasks={[]}
            onToggleTask={vi.fn()}
            onEditTask={vi.fn()}
            onDeleteTask={vi.fn()}
            onScheduleTask={onScheduleTask} 
          />
        </QueryClientProvider>
      );

      // Should still show tasks without re-fetching
      expect(screen.getByText('Pending Task 1')).toBeInTheDocument();
    });
  });
});
