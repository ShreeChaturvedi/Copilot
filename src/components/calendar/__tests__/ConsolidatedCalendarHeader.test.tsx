import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConsolidatedCalendarHeader } from '../ConsolidatedCalendarHeader';
import { SidebarProvider } from '@/components/ui/sidebar';

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

const renderWithSidebar = (ui: React.ReactElement) => {
  return render(
    <SidebarProvider>
      {ui}
    </SidebarProvider>
  );
};

describe('ConsolidatedCalendarHeader', () => {
  it('renders all header elements correctly', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    // Check for sidebar trigger
    expect(screen.getByTestId('sidebar-trigger-rightPane')).toBeInTheDocument();
    
    // Check for title
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    
    // Check for navigation buttons
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous period')).toBeInTheDocument();
    expect(screen.getByLabelText('Next period')).toBeInTheDocument();
    
    // Check for view switcher buttons
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
    
    // Check for new event button
    expect(screen.getByText('New Event')).toBeInTheDocument();
  });

  it('calls onTodayClick when Today button is clicked', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Today'));
    expect(defaultProps.onTodayClick).toHaveBeenCalledTimes(1);
  });

  it('calls onPrevClick when previous button is clicked', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Previous period'));
    expect(defaultProps.onPrevClick).toHaveBeenCalledTimes(1);
  });

  it('calls onNextClick when next button is clicked', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Next period'));
    expect(defaultProps.onNextClick).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateEvent when New Event button is clicked', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByText('New Event'));
    expect(defaultProps.onCreateEvent).toHaveBeenCalledTimes(1);
  });

  it('calls onViewChange when view buttons are clicked', () => {
    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Month'));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('dayGridMonth');
    
    fireEvent.click(screen.getByText('Day'));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('timeGridDay');
    
    fireEvent.click(screen.getByText('List'));
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('listWeek');
  });

  it('highlights the current view button', () => {
    renderWithSidebar(
      <ConsolidatedCalendarHeader {...defaultProps} currentView="dayGridMonth" />
    );
    
    const monthButton = screen.getByText('Month').closest('button');
    expect(monthButton).toHaveClass('bg-background', 'text-foreground', 'shadow-sm');
  });

  it('shows abbreviated labels on mobile screens', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    renderWithSidebar(<ConsolidatedCalendarHeader {...defaultProps} />);
    
    // The mobile labels should be present but hidden by default in our test environment
    // The actual responsive behavior is handled by CSS classes
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = renderWithSidebar(
      <ConsolidatedCalendarHeader {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild?.firstChild).toHaveClass('custom-class');
  });
});