import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResizableDivider } from '../ResizableDivider';

describe('ResizableDivider', () => {
  const mockOnResize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders divider correctly', () => {
    render(<ResizableDivider onResize={mockOnResize} />);

    const divider = screen.getByRole('separator');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveClass('w-3', 'bg-gradient-to-r');
  });

  it('shows resize cursor on hover', () => {
    render(<ResizableDivider onResize={mockOnResize} />);

    const divider = screen.getByRole('separator');
    expect(divider).toHaveClass('cursor-col-resize');
  });

  it('handles mouse resize events', () => {
    render(<ResizableDivider onResize={mockOnResize} />);

    const divider = screen.getByRole('separator');

    // Simulate mouse down
    fireEvent.mouseDown(divider, { clientX: 300 });

    // Simulate mouse move
    fireEvent.mouseMove(document, { clientX: 350 });

    // Simulate mouse up
    fireEvent.mouseUp(document);

    expect(mockOnResize).toHaveBeenCalledWith(350);
  });

  it('supports keyboard resizing', () => {
    render(<ResizableDivider onResize={mockOnResize} />);

    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });

    expect(mockOnResize).toHaveBeenCalledWith(310);
  });

  it('applies custom className when provided', () => {
    render(
      <ResizableDivider onResize={mockOnResize} className="custom-class" />
    );

    const divider = screen.getByRole('separator');
    expect(divider).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<ResizableDivider onResize={mockOnResize} />);

    const divider = screen.getByRole('separator');
    expect(divider).toHaveAttribute('aria-label', 'Resize sidebar');
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
  });
});
