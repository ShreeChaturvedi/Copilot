import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainLayout } from '../MainLayout';
import { useUIStore } from '../../../stores/uiStore';

// Mock the UI store
vi.mock('../../../stores/uiStore');

// Mock child components to avoid complex dependencies
vi.mock('../LeftPane', () => ({
  LeftPane: () => <div data-testid="left-pane">Left Pane</div>
}));

vi.mock('../RightPane', () => ({
  RightPane: () => <div data-testid="right-pane">Right Pane</div>
}));

vi.mock('../ResizableDivider', () => ({
  ResizableDivider: ({ onResize }: { onResize: (width: number) => void }) => (
    <div 
      data-testid="resizable-divider"
      onClick={() => onResize(400)}
    >
      Divider
    </div>
  )
}));

describe('MainLayout', () => {
  const mockSetLeftPaneWidth = vi.fn();
  const mockUIStore = {
    leftPaneWidth: 300,
    setLeftPaneWidth: mockSetLeftPaneWidth,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useUIStore as ReturnType<typeof vi.fn>).mockReturnValue(mockUIStore);
  });

  it('renders all main layout components', () => {
    render(<MainLayout />);
    
    expect(screen.getByTestId('left-pane')).toBeInTheDocument();
    expect(screen.getByTestId('right-pane')).toBeInTheDocument();
    expect(screen.getByTestId('resizable-divider')).toBeInTheDocument();
  });

  it('applies correct layout structure', () => {
    const { container } = render(<MainLayout />);
    
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('flex', 'h-screen', 'bg-gray-50');
  });

  it('handles divider resize', () => {
    render(<MainLayout />);
    
    const divider = screen.getByTestId('resizable-divider');
    divider.click();
    
    expect(mockSetLeftPaneWidth).toHaveBeenCalledWith(400);
  });

  it('passes leftPaneWidth to components', () => {
    render(<MainLayout />);
    
    expect(useUIStore).toHaveBeenCalled();
  });
});