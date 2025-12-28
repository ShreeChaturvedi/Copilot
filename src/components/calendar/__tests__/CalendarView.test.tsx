import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CalendarView } from '../CalendarView';
import { ThemeProvider } from '../../providers';
import FullCalendar from '@fullcalendar/react';

// Mock FullCalendar to avoid testing the actual calendar library
vi.mock('@fullcalendar/react', () => ({
  default: vi.fn(({ select, eventClick }) => (
    <div data-testid="fullcalendar-mock">
      <div data-testid="calendar-view">Calendar Component</div>
      <button
        data-testid="mock-event"
        onClick={() => {
          const mockEvent = {
            id: 'test-event-1',
            title: 'Test Event',
            start: new Date('2024-01-15T10:00:00'),
            end: new Date('2024-01-15T11:00:00'),
            calendarName: 'Primary',
          };
          eventClick?.({
            event: { extendedProps: { originalEvent: mockEvent } },
          });
        }}
      >
        Mock Event
      </button>
      <button
        data-testid="mock-date-select"
        onClick={() => {
          const mockSelectInfo = {
            start: new Date('2024-01-16T10:00:00'),
            end: new Date('2024-01-16T11:00:00'),
            allDay: false,
            view: { calendar: { unselect: vi.fn() } },
          };
          select?.(mockSelectInfo);
        }}
      >
        Mock Date Select
      </button>
    </div>
  )),
}));

// Mock the hooks
vi.mock('../../../hooks', () => ({
  useEvents: vi.fn(() => ({
    data: [
      {
        id: 'event-1',
        title: 'Test Event 1',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
        calendarName: 'Primary',
        color: '#3788d8',
      },
    ],
    isLoading: false,
  })),
  useCalendars: vi.fn(() => ({
    data: [
      {
        name: 'Primary',
        color: '#3788d8',
        visible: true,
        isDefault: true,
      },
    ],
  })),
  useCreateEvent: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useUpdateEvent: vi.fn(() => ({
    mutate: vi.fn(),
  })),
  useSwipeDetection: vi.fn(() => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  })),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ state: 'expanded' }),
}));

vi.mock('@/stores/calendarSettingsStore', () => ({
  useCalendarSettingsStore: () => ({
    getSlotTimes: () => ({ slotMinTime: '08:00:00', slotMaxTime: '18:00:00' }),
  }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('CalendarView', () => {
  const mockOnEventClick = vi.fn();
  const mockOnEventCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar component correctly', () => {
    render(
      <TestWrapper>
        <CalendarView
          onEventClick={mockOnEventClick}
          onEventCreate={mockOnEventCreate}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('fullcalendar-mock')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
    const fullCalendarMock = vi.mocked(FullCalendar);
    expect(fullCalendarMock).toHaveBeenCalled();
    expect(fullCalendarMock.mock.calls[0][0].events).toHaveLength(1);
  });

  it('calls onEventClick when event is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CalendarView
          onEventClick={mockOnEventClick}
          onEventCreate={mockOnEventCreate}
        />
      </TestWrapper>
    );

    const mockEventButton = screen.getByTestId('mock-event');
    await user.click(mockEventButton);

    expect(mockOnEventClick).toHaveBeenCalledWith({
      id: 'test-event-1',
      title: 'Test Event',
      start: new Date('2024-01-15T10:00:00'),
      end: new Date('2024-01-15T11:00:00'),
      calendarName: 'Primary',
    });
  });

  it('calls onEventCreate when date is selected', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CalendarView
          onEventClick={mockOnEventClick}
          onEventCreate={mockOnEventCreate}
        />
      </TestWrapper>
    );

    const mockDateSelectButton = screen.getByTestId('mock-date-select');
    await user.click(mockDateSelectButton);

    expect(mockOnEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '',
        allDay: false,
        calendarName: 'Primary',
      })
    );
  });

  it('applies custom className correctly', () => {
    const { container } = render(
      <TestWrapper>
        <CalendarView
          className="custom-calendar-class"
          onEventClick={mockOnEventClick}
          onEventCreate={mockOnEventCreate}
        />
      </TestWrapper>
    );

    expect(container.firstChild).toHaveClass('custom-calendar-class');
  });
});
