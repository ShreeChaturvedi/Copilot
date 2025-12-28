import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RightPane } from '../RightPane';

// Mock the CalendarView component
vi.mock('../../calendar', () => ({
  CalendarView: ({
    onEventClick,
    onEventCreate,
  }: {
    onEventClick?: (event: { id: string; title: string }) => void;
    onEventCreate?: (event: object) => void;
  }) => (
    <div data-testid="calendar-view">
      <button
        data-testid="mock-event-click"
        onClick={() => onEventClick?.({ id: '1', title: 'Test Event' })}
      >
        Mock Event
      </button>
      <button
        data-testid="mock-event-create"
        onClick={() => onEventCreate?.({ title: 'New Event' })}
      >
        Create Event
      </button>
    </div>
  ),
}));

vi.mock('../../calendar/ConsolidatedCalendarHeader', () => ({
  ConsolidatedCalendarHeader: ({
    onCreateEvent,
    onViewChange,
    currentView,
  }: {
    onCreateEvent?: () => void;
    onViewChange?: (view: string) => void;
    currentView?: string;
  }) => (
    <div data-testid="calendar-header">
      <span data-testid="current-view">{currentView}</span>
      <button
        type="button"
        aria-label="New Event"
        onClick={() => onCreateEvent?.()}
      >
        New Event
      </button>
      <button type="button" onClick={() => onViewChange?.('dayGridMonth')}>
        Month
      </button>
    </div>
  ),
}));

vi.mock('../../dialogs/EventCreationDialog', () => ({
  EventCreationDialog: ({
    open,
    initialEventData,
  }: {
    open: boolean;
    initialEventData?: { title?: string };
  }) => (
    <div
      data-testid="event-creation-dialog"
      data-open={open}
      data-title={initialEventData?.title || ''}
    />
  ),
}));

vi.mock('../../dialogs/EventDisplayDialog', () => ({
  EventDisplayDialog: ({
    open,
    event,
  }: {
    open: boolean;
    event?: { title?: string };
  }) => (
    <div
      data-testid="event-display-dialog"
      data-open={open}
      data-title={event?.title || ''}
    />
  ),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    calendarSubView: null,
    setCalendarSubView: vi.fn(),
  }),
}));

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('RightPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the calendar view header', async () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(await screen.findByTestId('calendar-header')).toBeInTheDocument();
  });

  it('renders the create event button', async () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(await screen.findByLabelText('New Event')).toBeInTheDocument();
  });

  it('renders the calendar component', () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('renders notes editor section', async () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(
      await screen.findByTestId('event-creation-dialog')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('event-display-dialog')
    ).toBeInTheDocument();
  });

  it('opens create dialog from header button', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const createButton = await screen.findByLabelText('New Event');
    await user.click(createButton);

    expect(await screen.findByTestId('event-creation-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('handles event click from calendar', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const eventButton = await screen.findByTestId('mock-event-click');
    await user.click(eventButton);

    expect(await screen.findByTestId('event-display-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(await screen.findByTestId('event-display-dialog')).toHaveAttribute(
      'data-title',
      'Test Event'
    );
  });

  it('handles event creation from calendar', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const createButton = await screen.findByTestId('mock-event-create');
    await user.click(createButton);

    expect(await screen.findByTestId('event-creation-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(await screen.findByTestId('event-creation-dialog')).toHaveAttribute(
      'data-title',
      'New Event'
    );
  });

  it('renders children when provided', () => {
    render(
      <TestWrapper>
        <RightPane>
          <div data-testid="custom-child">Custom Content</div>
        </RightPane>
      </TestWrapper>
    );

    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const rightPane = container.firstChild as HTMLElement;
    expect(rightPane).toHaveClass(
      'h-full',
      'flex',
      'flex-col',
      'bg-background',
      'overflow-hidden'
    );
  });
});
