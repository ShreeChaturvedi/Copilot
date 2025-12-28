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
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
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
  let defaultProps: {
    open: boolean;
    onOpenChange: ReturnType<typeof vi.fn>;
    defaultScope: string | null;
  };

  beforeEach(() => {
    mockOnOpenChange = vi.fn();
    defaultProps = {
      open: true,
      onOpenChange: mockOnOpenChange,
      defaultScope: null,
    };
  });

  it('should render the dialog when open', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Task Analytics').length).toBeGreaterThan(0);
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

    expect(screen.getByText(/Test List 1/)).toBeInTheDocument();
  });

  it('should render all tab triggers', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.getByRole('button', { name: /overview/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trends/i })).toBeInTheDocument();
  });

  it('should not render placeholder tabs', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.queryByRole('button', { name: /lists/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /priority/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /tags/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /attachments/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /goals/i })
    ).not.toBeInTheDocument();
  });

  it('should render time range controls', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ytd/i })).toBeInTheDocument();
    });
  });

  it('should render grouping controls', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'D' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'W' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
    });
  });

  it('should render show completed toggle', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByTitle('Hide completed tasks')).toBeInTheDocument();
    });
  });

  it('should switch between tabs', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Should start with Overview tab active
    const overviewTab = screen.getByRole('button', { name: /overview/i });
    const trendsTab = screen.getByRole('button', { name: /trends/i });

    expect(overviewTab).toHaveAttribute('aria-pressed', 'true');
    expect(trendsTab).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(trendsTab);

    await waitFor(() => {
      expect(trendsTab).toHaveAttribute('aria-pressed', 'true');
      expect(overviewTab).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('should render Overview tab content', () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    // Weekly heatmap
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('should render Trends tab content when selected', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Switch to Trends tab
    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByText('Task Activity')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bars/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /area/i })).toBeInTheDocument();
    });
  });

  it('should change time range when controls are clicked', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));
    const sevenDayButton = await screen.findByRole('button', { name: /7d/i });
    const thirtyDayButton = screen.getByRole('button', { name: /30d/i });

    // Should start with 30d selected (default)
    expect(thirtyDayButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(sevenDayButton);

    await waitFor(() => {
      expect(sevenDayButton).toHaveAttribute('aria-pressed', 'true');
      expect(thirtyDayButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('should change grouping when controls are clicked', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));
    const dayButton = await screen.findByRole('button', { name: 'D' });
    const weekButton = screen.getByRole('button', { name: 'W' });

    // Should start with Day selected (default)
    expect(dayButton).toHaveAttribute('aria-pressed', 'true');

    // Click on Week
    fireEvent.click(weekButton);

    await waitFor(() => {
      expect(weekButton).toHaveAttribute('aria-pressed', 'true');
      expect(dayButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('should toggle completed tasks switch', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /trends/i }));
    const toggleButton = await screen.findByTitle('Hide completed tasks');

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTitle('Show completed tasks')).toBeInTheDocument();
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
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();

    // Switch to Trends tab
    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('should switch chart modes in Trends tab', async () => {
    render(
      <TestWrapper>
        <TaskAnalyticsDialog {...defaultProps} />
      </TestWrapper>
    );

    // Switch to Trends tab
    fireEvent.click(screen.getByRole('button', { name: /trends/i }));

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    const barsButton = screen.getByRole('button', { name: /bars/i });
    fireEvent.click(barsButton);

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
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

    // Check view switcher accessibility
    expect(
      screen.getByRole('group', { name: /view selection/i })
    ).toBeInTheDocument();
  });
});
