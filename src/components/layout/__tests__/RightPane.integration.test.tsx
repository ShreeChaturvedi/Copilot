import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RightPane } from '../RightPane';
import { SidebarProvider } from '@/components/ui/sidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the FullCalendar component to avoid complex setup
vi.mock('@fullcalendar/react', () => ({
  default: vi.fn(({ ref, ...props }) => (
    <div data-testid="fullcalendar" {...props}>
      FullCalendar Mock
    </div>
  )),
}));

// Mock the SmoothSidebarTrigger component
vi.mock('../SmoothSidebarTrigger', () => ({
  SmoothSidebarTrigger: ({ position }: { position: string }) => (
    <button data-testid={`sidebar-trigger-${position}`}>Toggle</button>
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
      <SidebarProvider>
        {ui}
      </SidebarProvider>
    </QueryClientProvider>
  );
};

describe('RightPane Integration', () => {
  it('renders the consolidated calendar header', () => {
    renderWithProviders(<RightPane />);
    
    // Check that the consolidated header elements are present
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('New Event')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous period')).toBeInTheDocument();
    expect(screen.getByLabelText('Next period')).toBeInTheDocument();
    
    // Check view switcher buttons
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
    
    // Check sidebar trigger
    expect(screen.getByTestId('sidebar-trigger-rightPane')).toBeInTheDocument();
  });

  it('handles view changes correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    renderWithProviders(<RightPane />);
    
    // Click on Month view
    fireEvent.click(screen.getByText('Month'));
    
    // The view should change (we can't easily test the FullCalendar API call, but we can verify the button state)
    const monthButton = screen.getByText('Month').closest('button');
    expect(monthButton).toHaveClass('bg-background', 'text-foreground', 'shadow-sm');
    
    consoleSpy.mockRestore();
  });

  it('handles navigation clicks correctly', () => {
    renderWithProviders(<RightPane />);
    
    // These buttons should be present and clickable
    expect(screen.getByText('Today')).toBeEnabled();
    expect(screen.getByLabelText('Previous period')).toBeEnabled();
    expect(screen.getByLabelText('Next period')).toBeEnabled();
  });

  it('handles create event click correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    renderWithProviders(<RightPane />);
    
    fireEvent.click(screen.getByText('New Event'));
    expect(consoleSpy).toHaveBeenCalledWith('Create event:', {});
    
    consoleSpy.mockRestore();
  });

  it('renders the calendar view component', () => {
    renderWithProviders(<RightPane />);
    
    // Check that the FullCalendar mock is rendered
    expect(screen.getByTestId('fullcalendar')).toBeInTheDocument();
  });

  it('has proper layout structure', () => {
    const { container } = renderWithProviders(<RightPane />);
    
    // Check that the main container has the right classes
    const mainContainer = container.firstChild?.firstChild;
    expect(mainContainer).toHaveClass('h-full', 'flex', 'flex-col', 'bg-background');
  });
});