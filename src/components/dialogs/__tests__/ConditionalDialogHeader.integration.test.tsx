import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ConditionalDialogHeader } from '../ConditionalDialogHeader'

// Mock the UI components to avoid complex dependencies
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div data-testid="tabs" {...props}>{children}</div>,
  TabsList: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div data-testid="tabs-list" {...props}>{children}</div>,
  TabsTrigger: ({ children, value, ...props }: { children: React.ReactNode; value: string; [key: string]: unknown }) => (
    <button data-testid={`tab-${value}`} data-state={props.value === value ? 'active' : 'inactive'} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <button {...props}>{children}</button>,
}))

vi.mock('lucide-react', () => ({
  PanelRight: () => <span data-testid="panel-right-icon" />,
  PictureInPicture2: () => <span data-testid="picture-in-picture-icon" />,
}))

describe('ConditionalDialogHeader Integration', () => {
  const mockProps = {
    isEditing: false,
    activeTab: 'event',
    onTabChange: vi.fn(),
    peekMode: 'center' as const,
    onPeekModeToggle: vi.fn(),
  }

  it('integrates properly in create mode', () => {
    render(<ConditionalDialogHeader {...mockProps} />)
    
    // Should render tabs container
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
    expect(screen.getByTestId('tabs-list')).toBeInTheDocument()
    
    // Should render both tab triggers
    expect(screen.getByTestId('tab-event')).toBeInTheDocument()
    expect(screen.getByTestId('tab-task')).toBeInTheDocument()
    
    // Should render peek mode button
    expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument()
  })

  it('integrates properly in edit mode', () => {
    render(<ConditionalDialogHeader {...mockProps} isEditing={true} />)
    
    // Should NOT render tabs
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tabs-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-event')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-task')).not.toBeInTheDocument()
    
    // Should still render peek mode button
    expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument()
  })

  it('shows correct icon based on peek mode', () => {
    const { rerender } = render(<ConditionalDialogHeader {...mockProps} peekMode="center" />)
    
    // Center mode should show PanelRight icon
    expect(screen.getByTestId('panel-right-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('picture-in-picture-icon')).not.toBeInTheDocument()
    
    // Right mode should show PictureInPicture2 icon
    rerender(<ConditionalDialogHeader {...mockProps} peekMode="right" />)
    expect(screen.getByTestId('picture-in-picture-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-right-icon')).not.toBeInTheDocument()
  })

  it('eliminates blank space in edit mode', () => {
    const { container } = render(<ConditionalDialogHeader {...mockProps} isEditing={true} />)
    
    // Edit mode should have a compact layout
    const headerElement = container.firstChild as HTMLElement
    expect(headerElement).toHaveClass('flex', 'items-center', 'justify-end')
    
    // Should not have tabs taking up space
    expect(headerElement.children.length).toBe(1) // Only the button
  })
})