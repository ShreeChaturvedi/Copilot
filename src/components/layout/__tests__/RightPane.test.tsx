import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RightPane } from '../RightPane';
import { ThemeProvider } from '../../providers';

// Mock the CalendarView component
vi.mock('../../calendar', () => ({
  CalendarView: ({ onEventClick, onEventCreate }: { onEventClick?: (event: { id: string; title: string }) => void; onEventCreate?: (event: object) => void }) => (
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
  )
}));

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('RightPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the calendar view header', () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(screen.getByText('Calendar View')).toBeInTheDocument();
  });

  it('renders the create event button', () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(screen.getByText('+ Event')).toBeInTheDocument();
  });

  it('renders the calendar component', () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('renders notes editor section', () => {
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Show Editor')).toBeInTheDocument();
  });

  it('toggles notes editor visibility', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const toggleButton = screen.getByText('Show Editor');
    
    // Initially should show "Show Editor"
    expect(toggleButton).toBeInTheDocument();
    
    // Click to show editor
    await user.click(toggleButton);
    
    // Should now show "Hide Editor"
    expect(screen.getByText('Hide Editor')).toBeInTheDocument();
    expect(screen.getByText('CKEditor will be integrated here for rich text editing')).toBeInTheDocument();
  });

  it('handles event click from calendar', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const eventButton = screen.getByTestId('mock-event-click');
    await user.click(eventButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Event clicked:', { id: '1', title: 'Test Event' });
    
    consoleSpy.mockRestore();
  });

  it('handles event creation from calendar', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const createButton = screen.getByTestId('mock-event-create');
    await user.click(createButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Create event:', { title: 'New Event' });
    
    consoleSpy.mockRestore();
  });

  it('handles create event button click', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <RightPane />
      </TestWrapper>
    );

    const createEventButton = screen.getByText('+ Event');
    await user.click(createEventButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Create event:', {});
    
    consoleSpy.mockRestore();
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
    expect(rightPane).toHaveClass('h-full', 'flex', 'flex-col', 'bg-white', 'dark:bg-gray-800');
  });
});