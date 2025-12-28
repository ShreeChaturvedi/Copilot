import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConsolidatedCalendarHeaderDemo } from '../ConsolidatedCalendarHeaderDemo';

// Mock console.log to test the demo functionality
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ConsolidatedCalendarHeaderDemo', () => {
  afterEach(() => {
    consoleSpy.mockClear();
  });

  it('renders the demo component correctly', () => {
    render(<ConsolidatedCalendarHeaderDemo />);

    // Check that the header is rendered
    expect(screen.getByText('Calendar Content Area')).toBeInTheDocument();
    expect(screen.getByText(/Current view:/)).toBeInTheDocument();
    expect(screen.getByText('timeGridWeek')).toBeInTheDocument();
  });

  it('handles view changes correctly', () => {
    render(<ConsolidatedCalendarHeaderDemo />);

    // Click on Month view
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    expect(consoleSpy).toHaveBeenCalledWith('View changed to:', 'dayGridMonth');
    expect(screen.getByText('dayGridMonth')).toBeInTheDocument();
  });

  it('handles navigation clicks correctly', () => {
    render(<ConsolidatedCalendarHeaderDemo />);

    // Test Today button
    fireEvent.click(screen.getByText('Today'));
    expect(consoleSpy).toHaveBeenCalledWith('Today clicked');

    // Test Previous button
    fireEvent.click(screen.getByLabelText('Previous period'));
    expect(consoleSpy).toHaveBeenCalledWith('Previous clicked');

    // Test Next button
    fireEvent.click(screen.getByLabelText('Next period'));
    expect(consoleSpy).toHaveBeenCalledWith('Next clicked');
  });

  it('handles create event click correctly', () => {
    render(<ConsolidatedCalendarHeaderDemo />);

    fireEvent.click(screen.getByLabelText('New Event'));
    expect(consoleSpy).toHaveBeenCalledWith('Create event clicked');
  });
});
