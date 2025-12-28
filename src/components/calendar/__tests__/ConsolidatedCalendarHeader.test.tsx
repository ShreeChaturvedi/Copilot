import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConsolidatedCalendarHeader } from '../ConsolidatedCalendarHeader';

// Mock the SmoothSidebarTrigger component
vi.mock('@/components/layout/SmoothSidebarTrigger', () => ({
  SmoothSidebarTrigger: ({ position }: { position: string }) => (
    <button data-testid={`sidebar-trigger-${position}`}>Toggle</button>
  ),
}));

const defaultProps = {
  currentView: 'timeGridWeek' as const,
  onViewChange: vi.fn(),
  onTodayClick: vi.fn(),
  onPrevClick: vi.fn(),
  onNextClick: vi.fn(),
  onCreateEvent: vi.fn(),
};

describe('ConsolidatedCalendarHeader', () => {
  it('renders all header elements correctly', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    // Check for sidebar trigger
    expect(screen.getByTestId('sidebar-trigger-rightPane')).toBeInTheDocument();

    // Check for title (should show current month/year)
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent(/\w+\s+\d{4}/);

    // Check for navigation buttons
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous period')).toBeInTheDocument();
    expect(screen.getByLabelText('Next period')).toBeInTheDocument();

    // Check for view switcher buttons
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();

    // Check for new event button (now a plus icon with aria-label)
    expect(screen.getByLabelText('New Event')).toBeInTheDocument();
  });

  it('calls onTodayClick when Today button is clicked', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    fireEvent.click(screen.getByText('Today'));
    expect(defaultProps.onTodayClick).toHaveBeenCalledTimes(1);
  });

  it('calls onPrevClick when previous button is clicked', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Previous period'));
    expect(defaultProps.onPrevClick).toHaveBeenCalledTimes(1);
  });

  it('calls onNextClick when next button is clicked', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Next period'));
    expect(defaultProps.onNextClick).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateEvent when New Event button is clicked', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('New Event'));
    expect(defaultProps.onCreateEvent).toHaveBeenCalledTimes(1);
  });

  it('calls onViewChange when view buttons are clicked', () => {
    render(<ConsolidatedCalendarHeader {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('dayGridMonth');

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('timeGridDay');

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('listWeek');
  });

  it('highlights the current view button', () => {
    render(
      <ConsolidatedCalendarHeader
        {...defaultProps}
        currentView="dayGridMonth"
      />
    );

    const monthButton = screen.getByRole('button', { name: 'Month' });
    expect(monthButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ConsolidatedCalendarHeader {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
