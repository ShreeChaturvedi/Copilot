import React from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Modal } from '../Modal';

// Mock createPortal to render in the same container
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe('Modal Component', () => {
  const user = userEvent.setup();
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body styles
    document.body.style.overflow = 'unset';
  });

  it('should not render when closed', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<Modal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('should render with title', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('Test Modal');
    
    expect(title).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    expect(title).toHaveAttribute('id', 'modal-title');
  });

  it('should render close button when title is provided', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} title="Test Modal" onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: 'Close modal' });
    expect(closeButton).toBeInTheDocument();
    
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should handle different sizes', () => {
    const { rerender } = render(<Modal {...defaultProps} size="sm" />);
    const modalPanel = screen.getByRole('dialog').children[1]; // Skip backdrop, get modal panel
    expect(modalPanel).toHaveClass('max-w-md');

    rerender(<Modal {...defaultProps} size="lg" />);
    const modalPanelLg = screen.getByRole('dialog').children[1];
    expect(modalPanelLg).toHaveClass('max-w-2xl');

    rerender(<Modal {...defaultProps} size="xl" />);
    const modalPanelXl = screen.getByRole('dialog').children[1];
    expect(modalPanelXl).toHaveClass('max-w-4xl');
  });

  it('should close on escape key by default', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on escape when disabled', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);
    
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close on overlay click by default', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on overlay click when disabled', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />);
    
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not close when clicking modal content', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    
    const content = screen.getByText('Modal content');
    await user.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should prevent body scroll when open', () => {
    render(<Modal {...defaultProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(<Modal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(<Modal {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('unset');
  });

  it('should trap focus within modal', async () => {
    render(
      <Modal {...defaultProps} title="Focus Test">
        <button>First Button</button>
        <button>Second Button</button>
      </Modal>
    );
    
    const firstButton = screen.getByText('First Button');
    const secondButton = screen.getByText('Second Button');
    const closeButton = screen.getByRole('button', { name: 'Close modal' });
    
    // First focusable element should be focused initially
    expect(closeButton).toHaveFocus();
    
    // Tab should move to next element
    await user.tab();
    expect(firstButton).toHaveFocus();
    
    await user.tab();
    expect(secondButton).toHaveFocus();
    
    // Tab from last element should wrap to first
    await user.tab();
    expect(closeButton).toHaveFocus();
    
    // Shift+Tab should move backwards
    await user.tab({ shift: true });
    expect(secondButton).toHaveFocus();
  });

  it('should apply custom className', () => {
    render(<Modal {...defaultProps} className="custom-modal" />);
    
    const modalPanel = screen.getByRole('dialog').children[1]; // Skip backdrop, get modal panel
    expect(modalPanel).toHaveClass('custom-modal');
  });

  it('should have proper accessibility attributes', () => {
    render(<Modal {...defaultProps} title="Accessible Modal" />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('should handle content overflow with scrolling', () => {
    render(
      <Modal {...defaultProps}>
        <div style={{ height: '2000px' }}>Very tall content</div>
      </Modal>
    );
    
    const contentArea = screen.getByRole('dialog').querySelector('.overflow-y-auto');
    expect(contentArea).toBeInTheDocument();
    expect(contentArea).toHaveClass('max-h-[calc(90vh-8rem)]');
  });

  it('should restore focus to previously focused element when closed', async () => {
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open Modal';
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    
    const { rerender } = render(<Modal {...defaultProps} />);
    
    // Wait for focus to be set
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Close modal
    rerender(<Modal {...defaultProps} isOpen={false} />);
    
    // Focus should be restored to trigger button
    expect(document.activeElement).toBe(triggerButton);
    
    document.body.removeChild(triggerButton);
  });
});