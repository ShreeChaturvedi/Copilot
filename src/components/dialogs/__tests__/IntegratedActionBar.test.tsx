import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { IntegratedActionBar } from '../IntegratedActionBar'

describe('IntegratedActionBar', () => {
  const defaultProps = {
    peekMode: 'center' as const,
    onPeekModeToggle: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders peek mode switcher button', () => {
      render(<IntegratedActionBar {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
    })

    it('renders edit button when onEdit is provided', () => {
      const onEdit = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onEdit={onEdit} />)
      
      expect(screen.getByRole('button', { name: 'Edit event' })).toBeInTheDocument()
    })

    it('renders delete button when onDelete is provided', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} />)
      
      expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument()
    })

    it('does not render edit button when onEdit is not provided', () => {
      render(<IntegratedActionBar {...defaultProps} />)
      
      expect(screen.queryByRole('button', { name: 'Edit event' })).not.toBeInTheDocument()
    })

    it('does not render delete button when onDelete is not provided', () => {
      render(<IntegratedActionBar {...defaultProps} />)
      
      expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument()
    })

    it('renders close button when onClose is provided', () => {
      const onClose = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onClose={onClose} />)
      
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
    })

    it('does not render close button when onClose is not provided', () => {
      render(<IntegratedActionBar {...defaultProps} />)
      
      expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
    })
  })

  describe('Button Interactions', () => {
    it('calls onPeekModeToggle when peek mode button is clicked', () => {
      render(<IntegratedActionBar {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Switch to right panel mode' }))
      expect(defaultProps.onPeekModeToggle).toHaveBeenCalledTimes(1)
    })

    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onEdit={onEdit} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Edit event' }))
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onClose={onClose} />)
      
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Peek Mode States', () => {
    it('shows correct icon and label for center mode', () => {
      render(<IntegratedActionBar {...defaultProps} peekMode="center" />)
      
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
    })

    it('shows correct icon and label for right mode', () => {
      render(<IntegratedActionBar {...defaultProps} peekMode="right" />)
      
      expect(screen.getByRole('button', { name: 'Switch to center mode' })).toBeInTheDocument()
    })
  })

  describe('Delete Button States', () => {
    it('disables delete button when isDeleting is true', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} isDeleting={true} />)
      
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      expect(deleteButton).toBeDisabled()
    })

    it('enables delete button when isDeleting is false', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} isDeleting={false} />)
      
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      expect(deleteButton).not.toBeDisabled()
    })

    it('enables delete button by default when isDeleting is not provided', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} />)
      
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      expect(deleteButton).not.toBeDisabled()
    })
  })

  describe('Button Styling', () => {
    it('applies consistent shadcn button styling', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onClose = vi.fn()
      render(
        <IntegratedActionBar 
          {...defaultProps} 
          onEdit={onEdit} 
          onDelete={onDelete}
          onClose={onClose}
        />
      )
      
      const editButton = screen.getByRole('button', { name: 'Edit event' })
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      const peekButton = screen.getByRole('button', { name: 'Switch to right panel mode' })
      const closeButton = screen.getByRole('button', { name: 'Close dialog' })
      
      // All buttons should have ghost variant and sm size classes
      expect(editButton).toHaveClass('p-2')
      expect(deleteButton).toHaveClass('p-2')
      expect(peekButton).toHaveClass('p-2')
      expect(closeButton).toHaveClass('p-2')
    })

    it('applies destructive styling to delete button', () => {
      const onDelete = vi.fn()
      render(<IntegratedActionBar {...defaultProps} onDelete={onDelete} />)
      
      const deleteButton = screen.getByRole('button', { name: 'Delete event' })
      expect(deleteButton).toHaveClass('text-destructive')
    })
  })

  describe('Layout and Spacing', () => {
    it('renders buttons in a horizontal flex layout with proper spacing', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onClose = vi.fn()
      const { container } = render(
        <IntegratedActionBar 
          {...defaultProps} 
          onEdit={onEdit} 
          onDelete={onDelete}
          onClose={onClose}
        />
      )
      
      const actionBar = container.firstChild as HTMLElement
      expect(actionBar).toHaveClass('flex', 'items-center', 'gap-1')
    })

    it('applies custom className when provided', () => {
      const { container } = render(
        <IntegratedActionBar {...defaultProps} className="custom-class" />
      )
      
      const actionBar = container.firstChild as HTMLElement
      expect(actionBar).toHaveClass('custom-class')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for all buttons', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onClose = vi.fn()
      render(
        <IntegratedActionBar 
          {...defaultProps} 
          onEdit={onEdit} 
          onDelete={onDelete}
          onClose={onClose}
        />
      )
      
      expect(screen.getByRole('button', { name: 'Edit event' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
    })

    it('updates peek mode ARIA label based on current mode', () => {
      const { rerender } = render(<IntegratedActionBar {...defaultProps} peekMode="center" />)
      expect(screen.getByRole('button', { name: 'Switch to right panel mode' })).toBeInTheDocument()
      
      rerender(<IntegratedActionBar {...defaultProps} peekMode="right" />)
      expect(screen.getByRole('button', { name: 'Switch to center mode' })).toBeInTheDocument()
    })
  })
})