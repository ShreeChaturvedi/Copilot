/**
 * SmartParsingToggle Component Tests
 * 
 * Tests the SmartParsingToggle component functionality including:
 * - Rendering with correct icon and label
 * - Toggle state changes
 * - Disabled state handling
 * - Accessibility attributes
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SmartParsingToggle } from '../SmartParsingToggle';

describe('SmartParsingToggle', () => {
  it('renders with Brain icon', () => {
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={vi.fn()}
      />
    );

    // Check that the Brain icon is present
    const toggle = screen.getByRole('button');
    expect(toggle).toBeInTheDocument();
    
    // Check for Brain icon (it should be an SVG)
    const icon = toggle.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('shows "Autotag" label when pressed', () => {
    render(
      <SmartParsingToggle
        pressed={true}
        onPressedChange={vi.fn()}
      />
    );

    expect(screen.getByText('Autotag')).toBeInTheDocument();
  });

  it('does not show "Autotag" label when not pressed', () => {
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={vi.fn()}
      />
    );

    expect(screen.queryByText('Autotag')).not.toBeInTheDocument();
  });

  it('calls onPressedChange when clicked', () => {
    const handlePressedChange = vi.fn();
    
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={handlePressedChange}
      />
    );

    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);

    expect(handlePressedChange).toHaveBeenCalledWith(true);
  });

  it('has correct accessibility attributes when not pressed', () => {
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={vi.fn()}
      />
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-label', 'Enable smart parsing');
    expect(toggle).toHaveAttribute('data-state', 'off');
  });

  it('has correct accessibility attributes when pressed', () => {
    render(
      <SmartParsingToggle
        pressed={true}
        onPressedChange={vi.fn()}
      />
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-label', 'Disable smart parsing');
    expect(toggle).toHaveAttribute('data-state', 'on');
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={vi.fn()}
        disabled={true}
      />
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toBeDisabled();
  });

  it('does not call onPressedChange when disabled and clicked', () => {
    const handlePressedChange = vi.fn();
    
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={handlePressedChange}
        disabled={true}
      />
    );

    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);

    expect(handlePressedChange).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <SmartParsingToggle
        pressed={false}
        onPressedChange={vi.fn()}
        className="custom-class"
      />
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveClass('custom-class');
  });
});