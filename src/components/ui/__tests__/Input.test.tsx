import React from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../Input';

describe('Input Component', () => {
  const user = userEvent.setup();

  it('should render with default props', () => {
    render(<Input />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-slot', 'input');
    expect(input).toHaveClass('border-input', 'rounded-md', 'bg-transparent');
  });

  it('should support different input types', () => {
    render(<Input type="email" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should handle placeholder text', () => {
    render(<Input placeholder="Enter your name" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter your name');
  });

  it('should handle user input', async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello World');

    expect(input).toHaveValue('Hello World');
    expect(handleChange).toHaveBeenCalledTimes(11);
  });

  it('should handle disabled state', () => {
    render(<Input disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveClass(
      'disabled:opacity-50',
      'disabled:cursor-not-allowed'
    );
  });

  it('should forward ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should apply custom className', () => {
    render(<Input className="custom-class" />);

    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('should respect aria-invalid when provided', () => {
    render(<Input aria-invalid="true" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('aria-invalid:border-destructive');
  });
});
