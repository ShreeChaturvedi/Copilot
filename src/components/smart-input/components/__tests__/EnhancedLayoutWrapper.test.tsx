/**
 * Tests for EnhancedLayoutWrapper component
 */


import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EnhancedLayoutWrapper } from '../EnhancedLayoutWrapper';

describe('EnhancedLayoutWrapper', () => {
  it('renders without crashing', () => {
    render(
      <EnhancedLayoutWrapper controls={<div>Controls</div>}>
        <div>Input content</div>
      </EnhancedLayoutWrapper>
    );
    
    expect(screen.getByText('Input content')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EnhancedLayoutWrapper 
        controls={<div>Controls</div>}
        className="custom-class"
      >
        <div>Input content</div>
      </EnhancedLayoutWrapper>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles disabled state', () => {
    const { container } = render(
      <EnhancedLayoutWrapper 
        controls={<div>Controls</div>}
        disabled={true}
      >
        <div>Input content</div>
      </EnhancedLayoutWrapper>
    );
    
    expect(container.firstChild).toHaveClass('opacity-50');
  });

  it('applies custom minHeight', () => {
    const { container } = render(
      <EnhancedLayoutWrapper 
        controls={<div>Controls</div>}
        minHeight="200px"
      >
        <div>Input content</div>
      </EnhancedLayoutWrapper>
    );
    
    // Find the input area div that has the CSS custom property
    const inputArea = container.querySelector('[style*="--min-height"]');
    expect(inputArea).toHaveStyle('--min-height: 200px');
  });

  it('renders controls in separate area', () => {
    render(
      <EnhancedLayoutWrapper controls={<button>Submit</button>}>
        <input placeholder="Type here" />
      </EnhancedLayoutWrapper>
    );
    
    const input = screen.getByPlaceholderText('Type here');
    const button = screen.getByRole('button', { name: 'Submit' });
    
    // Input and controls should be in different containers
    expect(input.closest('[class*="p-4"]')).toBeTruthy();
    expect(button.closest('[class*="border-t"]')).toBeTruthy();
  });
});