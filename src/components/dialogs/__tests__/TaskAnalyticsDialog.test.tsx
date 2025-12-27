/**
 * Tests for TaskAnalyticsDialog component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskAnalyticsDialog } from '../TaskAnalyticsDialog';

// Mock the hooks
vi.mock('@/hooks/useTasks', () => ({
  useAllTasks: () => ({
    data: [
      {
        id: '1',
        title: 'Test Task 1',
        completed: false,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        taskListId: 'list1',
      },
      {
        id: '2',
        title: 'Test Task 2',
        completed: true,
        createdAt: new Date('2024-01-02T10:00:00Z'),
        completedAt: new Date('2024-01-03T10:00:00Z'),
        taskListId: 'list1',
      },
      {
        id: '3',
        title: 'Test Task 3',
        completed: false,
        createdAt: new Date('2024-01-05T10:00:00Z'),
        taskListId: 'list2',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useTaskManagement', () => ({
  useTaskManagement: () => ({
    taskGroups: [
      { id: 'list1', name: 'Test List 1' },
      { id: 'list2', name: 'Test List 2' },
    ],
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    peekMode: 'center',
    setPeekMode: vi.fn(),
  }),
}));

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}));

// Test wrapper with React Query
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('TaskAnalyticsDialog', () => {
  let mockOnOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOpenChange = vi.fn();
  });

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    defaultScope: null,
  };

  it('should render the dialog when open', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Task Analytics')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} open={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Task Analytics')).not.toBeInTheDocument();
  });

  it('should render scope badge when defaultScope is provided', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} defaultScope="list1" />
      </TestWrapper>
    );

    expect(screen.getByText('Test List 1')).toBeInTheDocument();
  });

  it('should render all tab triggers', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /trends/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /lists/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /priority/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tags/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /attachments/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /goals/i })).toBeInTheDocument();
  });

  it('should have disabled placeholder tabs', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('tab', { name: /lists/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /priority/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /tags/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /attachments/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /goals/i })).toBeDisabled();
  });

  it('should render time range controls', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ytd/i })).toBeInTheDocument();
  });

  it('should render grouping controls', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Group by')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
  });

  it('should render show completed toggle', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Show completed')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('should switch between tabs', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Should start with Overview tab active
    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    const trendsTab = screen.getByRole('tab', { name: /trends/i });

    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(trendsTab).toHaveAttribute('aria-selected', 'false');

    // Click on Trends tab
    fireEvent.click(trendsTab);

    await waitFor(() => {
      expect(trendsTab).toHaveAttribute('aria-selected', 'true');
      expect(overviewTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  it('should render Overview tab content', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check for KPI cards
    expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    // Check for status distribution
    expect(screen.getByText('Status Distribution')).toBeInTheDocument();

    // Check for weekly sparkline
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('should render Trends tab content when selected', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Switch to Trends tab
    const trendsTab = screen.getByRole('tab', { name: /trends/i });
    fireEvent.click(trendsTab);

    await waitFor(() => {
      expect(screen.getByText('Task Trends')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bars/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /areas/i })
      ).toBeInTheDocument();
    });
  });

  it('should change time range when controls are clicked', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    const sevenDayButton = screen.getByRole('button', { name: /7d/i });
    const thirtyDayButton = screen.getByRole('button', { name: /30d/i });

    // Should start with 30d selected (default)
    expect(thirtyDayButton).toHaveClass('bg-background');

    // Click on 7d
    fireEvent.click(sevenDayButton);

    await waitFor(() => {
      expect(sevenDayButton).toHaveClass('bg-background');
      expect(thirtyDayButton).not.toHaveClass('bg-background');
    });
  });

  it('should change grouping when controls are clicked', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    const dayButton = screen.getByRole('button', { name: /day/i });
    const weekButton = screen.getByRole('button', { name: /week/i });

    // Should start with Day selected (default)
    expect(dayButton).toHaveClass('bg-background');

    // Click on Week
    fireEvent.click(weekButton);

    await waitFor(() => {
      expect(weekButton).toHaveClass('bg-background');
      expect(dayButton).not.toHaveClass('bg-background');
    });
  });

  it('should toggle completed tasks switch', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    const completedSwitch = screen.getByRole('switch');

    // Should start as checked (default true)
    expect(completedSwitch).toBeChecked();

    // Click to uncheck
    fireEvent.click(completedSwitch);

    await waitFor(() => {
      expect(completedSwitch).not.toBeChecked();
    });
  });

  it('should call onOpenChange when close button is clicked', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should render charts in both tabs', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Overview tab charts
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(2); // Status distribution + sparkline
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();

    // Switch to Trends tab
    const trendsTab = screen.getByRole('tab', { name: /trends/i });
    fireEvent.click(trendsTab);

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('should switch chart modes in Trends tab', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Switch to Trends tab
    const trendsTab = screen.getByRole('tab', { name: /trends/i });
    fireEvent.click(trendsTab);

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    // Switch to Areas mode
    const areasButton = screen.getByRole('button', { name: /areas/i });
    fireEvent.click(areasButton);

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check dialog accessibility
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Check tabs accessibility
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1); // Only active tab panel is rendered
  });
});
