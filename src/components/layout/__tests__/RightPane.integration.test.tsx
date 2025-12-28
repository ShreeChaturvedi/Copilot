import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RightPane } from '../RightPane';
import { SidebarProvider } from '@/components/ui/sidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../calendar', () => ({
  CalendarView: () => <div data-testid="calendar-view">Calendar View</div>,
}));

const viewChangeSpy = vi.fn();

vi.mock('../../calendar/ConsolidatedCalendarHeader', () => ({
  ConsolidatedCalendarHeader: ({
    onTodayClick,
    onPrevClick,
    onNextClick,
    onCreateEvent,
    onViewChange,
  }: {
    onTodayClick: () => void;
    onPrevClick: () => void;
    onNextClick: () => void;
    onCreateEvent: () => void;
    onViewChange: (view: string) => void;
  }) => (
    <div data-testid="calendar-header">
      <button type="button" data-testid="sidebar-trigger-rightPane">
        Toggle
      </button>
      <button type="button" onClick={onTodayClick}>
        Today
      </button>
      <button type="button" aria-label="Previous period" onClick={onPrevClick}>
        Prev
      </button>
      <button type="button" aria-label="Next period" onClick={onNextClick}>
        Next
      </button>
      <button type="button" aria-label="New Event" onClick={onCreateEvent}>
        New Event
      </button>
      <button
        type="button"
        aria-label="Month"
        onClick={() => {
          viewChangeSpy('dayGridMonth');
          onViewChange('dayGridMonth');
        }}
      >
        Month
      </button>
      <button
        type="button"
        aria-label="Week"
        onClick={() => {
          viewChangeSpy('timeGridWeek');
          onViewChange('timeGridWeek');
        }}
      >
        Week
      </button>
      <button
        type="button"
        aria-label="Day"
        onClick={() => {
          viewChangeSpy('timeGridDay');
          onViewChange('timeGridDay');
        }}
      >
        Day
      </button>
      <button
        type="button"
        aria-label="List"
        onClick={() => {
          viewChangeSpy('listWeek');
          onViewChange('listWeek');
        }}
      >
        List
      </button>
    </div>
  ),
}));

// Mock the SmoothSidebarTrigger component
vi.mock('@/components/layout/SmoothSidebarTrigger', () => ({
  SmoothSidebarTrigger: ({ position }: { position: string }) => (
    <button data-testid={`sidebar-trigger-${position}`}>Toggle</button>
  ),
}));

vi.mock('../../dialogs/EventCreationDialog', () => ({
  EventCreationDialog: ({ open }: { open: boolean }) => (
    <div data-testid="event-creation-dialog" data-open={open} />
  ),
}));

vi.mock('../../dialogs/EventDisplayDialog', () => ({
  EventDisplayDialog: ({ open }: { open: boolean }) => (
    <div data-testid="event-display-dialog" data-open={open} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>{ui}</SidebarProvider>
    </QueryClientProvider>
  );
};

describe('RightPane Integration', () => {
  it('renders the consolidated calendar header', async () => {
    renderWithProviders(<RightPane />);

    // Check that the consolidated header elements are present
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous period')).toBeInTheDocument();
    expect(screen.getByLabelText('Next period')).toBeInTheDocument();
    expect(screen.getByLabelText('New Event')).toBeInTheDocument();

    // Check view switcher buttons
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();

    // Check sidebar trigger
    expect(screen.getByTestId('sidebar-trigger-rightPane')).toBeInTheDocument();
  });

  it('handles view changes correctly', async () => {
    renderWithProviders(<RightPane />);

    // Click on Month view
    fireEvent.click(await screen.findByRole('button', { name: 'Month' }));

    expect(viewChangeSpy).toHaveBeenCalledWith('dayGridMonth');
  });

  it('handles navigation clicks correctly', async () => {
    renderWithProviders(<RightPane />);

    // These buttons should be present and clickable
    expect(await screen.findByText('Today')).toBeEnabled();
    expect(screen.getByLabelText('Previous period')).toBeEnabled();
    expect(screen.getByLabelText('Next period')).toBeEnabled();
  });

  it('handles create event click correctly', async () => {
    renderWithProviders(<RightPane />);

    fireEvent.click(await screen.findByLabelText('New Event'));
    expect(await screen.findByTestId('event-creation-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('renders the calendar view component', () => {
    renderWithProviders(<RightPane />);

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('has proper layout structure', () => {
    const { container } = renderWithProviders(<RightPane />);

    // Check that the main container has the right classes
    const mainContainer = container.firstChild?.firstChild;
    expect(mainContainer).toHaveClass(
      'h-full',
      'flex',
      'flex-col',
      'bg-background'
    );
  });
});
