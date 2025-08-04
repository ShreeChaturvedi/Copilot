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
    expect(input).toHaveClass('border-gray-300', 'text-gray-900');
  });

  it('should render with label', () => {
    render(<Input label="Test Label" />);
    
    const label = screen.getByText('Test Label');
    const input = screen.getByRole('textbox');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', input.id);
    expect(input).toHaveAccessibleName('Test Label');
  });

  it('should display error state correctly', () => {
    render(<Input error="This field is required" />);
    
    const input = screen.getByRole('textbox');
    const errorMessage = screen.getByRole('alert');
    
    expect(input).toHaveClass('border-red-300', 'text-red-900');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toHaveTextContent('This field is required');
    expect(input).toHaveAccessibleDescription('This field is required');
  });

  it('should display helper text', () => {
    render(<Input helperText="This is helpful information" />);
    
    const input = screen.getByRole('textbox');
    const helperText = screen.getByText('This is helpful information');
    
    expect(helperText).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('This is helpful information');
  });

  it('should prioritize error over helper text', () => {
    render(
      <Input 
        error="Error message" 
        helperText="Helper text" 
      />
    );
    
    expect(screen.getByRole('alert')).toHaveTextContent('Error message');
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('should render full width when specified', () => {
    render(<Input fullWidth />);
    
    const container = screen.getByRole('textbox').parentElement?.parentElement;
    expect(container).toHaveClass('w-full');
  });

  it('should render with left icon', () => {
    const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
    render(<Input leftIcon={<LeftIcon />} />);
    
    const input = screen.getByRole('textbox');
    const icon = screen.getByTestId('left-icon');
    
    expect(icon).toBeInTheDocument();
    expect(input).toHaveClass('pl-10');
  });

  it('should render with right icon', () => {
    const RightIcon = () => <span data-testid="right-icon">✓</span>;
    render(<Input rightIcon={<RightIcon />} />);
    
    const input = screen.getByRole('textbox');
    const icon = screen.getByTestId('right-icon');
    
    expect(icon).toBeInTheDocument();
    expect(input).toHaveClass('pr-10');
  });

  it('should render with both left and right icons', () => {
    const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
    const RightIcon = () => <span data-testid="right-icon">✓</span>;
    
    render(<Input leftIcon={<LeftIcon />} rightIcon={<RightIcon />} />);
    
    const input = screen.getByRole('textbox');
    
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    expect(input).toHaveClass('pl-10', 'pr-10');
  });

  it('should handle user input', async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello World');
    
    expect(input).toHaveValue('Hello World');
    expect(handleChange).toHaveBeenCalledTimes(11); // One for each character
  });

  it('should handle disabled state', () => {
    render(<Input disabled />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  it('should handle placeholder text', () => {
    render(<Input placeholder="Enter your name" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter your name');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  });

  it('should apply custom className', () => {
    render(<Input className="custom-class" />);
    
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('should generate unique IDs for multiple inputs', () => {
    render(
      <div>
        <Input label="First Input" />
        <Input label="Second Input" />
      </div>
    );
    
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });

  it('should use provided ID', () => {
    render(<Input id="custom-id" label="Custom ID Input" />);
    
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Custom ID Input');
    
    expect(input).toHaveAttribute('id', 'custom-id');
    expect(label).toHaveAttribute('for', 'custom-id');
  });

  it('should have proper focus styles', async () => {
    render(<Input />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    expect(input).toHaveFocus();
    expect(input).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
  });

  it('should support different input types', () => {
    render(<Input type="email" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
  });
});