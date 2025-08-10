/**
 * SmartParsingToggle Integration Tests
 * 
 * Tests the SmartParsingToggle component integration with EnhancedTaskInput:
 * - Toggle functionality affects smart parsing
 * - State persistence
 * - Visual feedback
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancedTaskInput } from '../../EnhancedTaskInput';

// Mock the text parser hook
vi.mock('../../hooks/useTextParser', () => ({
  useTextParser: vi.fn((text, options) => ({
    parseResult: null,
    isLoading: false,
    error: null,
    cleanTitle: text,
    tags: options.enabled ? [
      {
        id: '1',
        type: 'priority',
        value: 'high',
        displayText: 'High Priority',
        startIndex: 0,
        endIndex: 4,
        confidence: 0.9,
        color: '#ef4444'
      }
    ] : [],
    confidence: options.enabled ? 0.9 : 0,
    hasConflicts: false,
    clear: vi.fn(),
  }))
}));

describe('SmartParsingToggle Integration', () => {
  const defaultProps = {
    onAddTask: vi.fn(),
    taskGroups: [],
    activeTaskGroupId: 'default',
  };

  it('renders the smart parsing toggle', () => {
    render(<EnhancedTaskInput {...defaultProps} />);

    // Find the toggle button (should have Brain icon)
    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    expect(toggle).toBeInTheDocument();
  });

  it('shows "Autotag" label when toggle is pressed', async () => {
    render(<EnhancedTaskInput {...defaultProps} enableSmartParsing={true} />);

    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    
    // Initially should show "Autotag" since enableSmartParsing is true
    expect(screen.getByText('Autotag')).toBeInTheDocument();
    
    // Click to turn off
    fireEvent.click(toggle);
    
    // Should not show "Autotag" when off
    await waitFor(() => {
      expect(screen.queryByText('Autotag')).not.toBeInTheDocument();
    });
  });

  it('toggles smart parsing functionality', async () => {
    render(<EnhancedTaskInput {...defaultProps} enableSmartParsing={true} />);

    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    const textarea = screen.getByRole('textbox');
    
    // Type some text that would be parsed
    fireEvent.change(textarea, { target: { value: 'high priority task' } });
    
    // Should show parsed tags initially (mocked to return tags when enabled)
    await waitFor(() => {
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });
    
    // Turn off smart parsing
    fireEvent.click(toggle);
    
    // Clear and retype to trigger re-parsing
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.change(textarea, { target: { value: 'high priority task' } });
    
    // Should not show parsed tags when disabled
    await waitFor(() => {
      expect(screen.queryByText('High Priority')).not.toBeInTheDocument();
    });
  });

  it('maintains toggle state independently of prop', () => {
    const { rerender } = render(
      <EnhancedTaskInput {...defaultProps} enableSmartParsing={false} />
    );

    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    
    // Initially off (no "Autotag" label)
    expect(screen.queryByText('Autotag')).not.toBeInTheDocument();
    
    // Turn on
    fireEvent.click(toggle);
    expect(screen.getByText('Autotag')).toBeInTheDocument();
    
    // Re-render with same prop - should maintain internal state
    rerender(<EnhancedTaskInput {...defaultProps} enableSmartParsing={false} />);
    expect(screen.getByText('Autotag')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<EnhancedTaskInput {...defaultProps} enableSmartParsing={true} />);

    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    
    // Should have proper ARIA attributes
    expect(toggle).toHaveAttribute('data-state', 'on');
    expect(toggle).toHaveAttribute('aria-label', 'Disable smart parsing');
  });

  it('can be disabled', () => {
    render(<EnhancedTaskInput {...defaultProps} disabled={true} />);

    const toggle = screen.getByRole('button', { name: /smart parsing/i });
    expect(toggle).toBeDisabled();
  });
});