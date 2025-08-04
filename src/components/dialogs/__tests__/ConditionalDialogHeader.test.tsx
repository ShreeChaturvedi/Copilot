import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ConditionalDialogHeader } from '../ConditionalDialogHeader'

describe('ConditionalDialogHeader', () => {
  const defaultProps = {
    isEditing: false,
    activeTab: 'event',
    onTabChange: vi.fn(),
    peekMode: 'center' as const,
    onPeekModeToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    isDeleting: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Mode (not editing)', () => {
    it('renders tabs and peek mode switcher', () => {
      render(<ConditionalDialogHeader {...defaultProps} />)
      
      // Should show tabs
      expect(screen.getByRole('tab', { name: 'Create event' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Create task' })).toBeInTheDocument()
      
      // Should show peek mode switcher
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
    })

    it('renders active tab correctly', () => {
      render(<ConditionalDialogHeader {...defaultProps} activeTab="task" />)
      
      // The task tab should be selected
      const taskTab = screen.getByRole('tab', { name: 'Create task' })
      expect(taskTab).toHaveAttribute('data-state', 'active')
    })

    it('calls onPeekModeToggle when peek mode button is clicked', () => {
      render(<ConditionalDialogHeader {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Switch to right panel mode' }))
      expect(defaultProps.onPeekModeToggle).toHaveBeenCalled()
    })

    it('shows correct peek mode icon for center mode', () => {
      render(<ConditionalDialogHeader {...defaultProps} peekMode="center" />)
      
      const button = screen.getByRole('button', { name: 'Switch to right panel mode' })
      expect(button).toBeInTheDocument()
    })

    it('shows correct peek mode icon for right mode', () => {
      render(<ConditionalDialogHeader {...defaultProps} peekMode="right" />)
      
      const button = screen.getByRole('button', { name: 'Switch to center mode' })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    const editProps = { ...defaultProps, isEditing: true }

    it('does not render tabs in edit mode', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      // Should not show tabs
      expect(screen.queryByRole('tab', { name: 'Create event' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Create task' })).not.toBeInTheDocument()
    })

    it('renders IntegratedActionBar with all buttons in edit mode', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      // Should show edit button
      expect(screen.getByRole('button', { name: 'Edit event' })).toBeInTheDocument()
      
      // Should show delete button
      expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument()
      
      // Should show peek mode switcher
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
    })

    it('calls onPeekModeToggle when peek mode button is clicked in edit mode', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Switch to right panel mode' }))
      expect(defaultProps.onPeekModeToggle).toHaveBeenCalled()
    })

    it('calls onEdit when edit button is clicked', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Edit event' }))
      expect(defaultProps.onEdit).toHaveBeenCalled()
    })

    it('calls onDelete when delete button is clicked', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
      expect(defaultProps.onDelete).toHaveBeenCalled()
    })

    it('disables delete button when isDeleting is true', () => {
      render(<ConditionalDialogHeader {...editProps} isDeleting={true} />)
      
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      expect(deleteButton).toBeDisabled()
    })

    it('calls onClose when close button is clicked', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('renders close button in edit mode', () => {
      render(<ConditionalDialogHeader {...editProps} />)
      
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
    })

    it('has clean layout without unnecessary space', () => {
      const { container } = render(<ConditionalDialogHeader {...editProps} />)
      
      // Should have a simple flex container with justify-end
      const headerDiv = container.firstChild as HTMLElement
      expect(headerDiv).toHaveClass('flex', 'items-center', 'justify-end')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for tabs', () => {
      render(<ConditionalDialogHeader {...defaultProps} />)
      
      expect(screen.getByRole('tab', { name: 'Create event' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Create task' })).toBeInTheDocument()
    })

    it('has proper ARIA label for peek mode button', () => {
      render(<ConditionalDialogHeader {...defaultProps} peekMode="center" />)
      
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
    })

    it('updates ARIA label based on peek mode', () => {
      const { rerender } = render(<ConditionalDialogHeader {...defaultProps} peekMode="center" />)
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
      
      rerender(<ConditionalDialogHeader {...defaultProps} peekMode="right" />)
      expect(screen.getByRole('button', { name: 'Switch to center mode' })).toBeInTheDocument()
    })
  })

  describe('Custom className', () => {
    it('applies custom className in create mode', () => {
      const { container } = render(
        <ConditionalDialogHeader {...defaultProps} className="custom-class" />
      )
      
      const headerDiv = container.firstChild as HTMLElement
      expect(headerDiv).toHaveClass('custom-class')
    })

    it('applies custom className in edit mode', () => {
      const { container } = render(
        <ConditionalDialogHeader {...defaultProps} isEditing={true} className="custom-class" />
      )
      
      const headerDiv = container.firstChild as HTMLElement
      expect(headerDiv).toHaveClass('custom-class')
    })
  })
})