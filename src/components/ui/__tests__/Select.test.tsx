import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select } from '../Select';

describe('Select Component', () => {
  const user = userEvent.setup();
  const defaultOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
  ];

  it('should render with default props', () => {
    render(<Select options={defaultOptions} />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass('border-gray-300', 'text-gray-900');
  });

  it('should render with label', () => {
    render(<Select label="Test Label" options={defaultOptions} />);
    
    const label = screen.getByText('Test Label');
    const select = screen.getByRole('combobox');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', select.id);
    expect(select).toHaveAccessibleName('Test Label');
  });

  it('should render all options', () => {
    render(<Select options={defaultOptions} />);
    
    const option1 = screen.getByRole('option', { name: 'Option 1' });
    const option2 = screen.getByRole('option', { name: 'Option 2' });
    const option3 = screen.getByRole('option', { name: 'Option 3' });
    
    expect(option1).toBeInTheDocument();
    expect(option2).toBeInTheDocument();
    expect(option3).toBeInTheDocument();
    expect(option3).toBeDisabled();
  });

  it('should render placeholder option when provided', () => {
    render(<Select options={defaultOptions} placeholder="Choose an option" />);
    
    const placeholder = screen.getByRole('option', { name: 'Choose an option' });
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('value', '');
    expect(placeholder).toBeDisabled();
  });

  it('should display error state correctly', () => {
    render(<Select options={defaultOptions} error="This field is required" />);
    
    const select = screen.getByRole('combobox');
    const errorMessage = screen.getByRole('alert');
    
    expect(select).toHaveClass('border-red-300', 'text-red-900');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toHaveTextContent('This field is required');
    expect(select).toHaveAccessibleDescription('This field is required');
  });

  it('should display helper text', () => {
    render(<Select options={defaultOptions} helperText="This is helpful information" />);
    
    const select = screen.getByRole('combobox');
    const helperText = screen.getByText('This is helpful information');
    
    expect(helperText).toBeInTheDocument();
    expect(select).toHaveAccessibleDescription('This is helpful information');
  });

  it('should prioritize error over helper text', () => {
    render(
      <Select 
        options={defaultOptions}
        error="Error message" 
        helperText="Helper text" 
      />
    );
    
    expect(screen.getByRole('alert')).toHaveTextContent('Error message');
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('should render full width when specified', () => {
    render(<Select options={defaultOptions} fullWidth />);
    
    const container = screen.getByRole('combobox').parentElement?.parentElement;
    expect(container).toHaveClass('w-full');
  });

  it('should handle selection changes', async () => {
    const handleChange = vi.fn();
    render(<Select options={defaultOptions} onChange={handleChange} />);
    
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'option2');
    
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue('option2');
  });

  it('should handle disabled state', () => {
    render(<Select options={defaultOptions} disabled />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    expect(select).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();
    render(<Select options={defaultOptions} ref={ref} />);
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLSelectElement));
  });

  it('should apply custom className', () => {
    render(<Select options={defaultOptions} className="custom-class" />);
    
    expect(screen.getByRole('combobox')).toHaveClass('custom-class');
  });

  it('should generate unique IDs for multiple selects', () => {
    render(
      <div>
        <Select label="First Select" options={defaultOptions} />
        <Select label="Second Select" options={defaultOptions} />
      </div>
    );
    
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].id).not.toBe(selects[1].id);
  });

  it('should use provided ID', () => {
    render(<Select id="custom-id" label="Custom ID Select" options={defaultOptions} />);
    
    const select = screen.getByRole('combobox');
    const label = screen.getByText('Custom ID Select');
    
    expect(select).toHaveAttribute('id', 'custom-id');
    expect(label).toHaveAttribute('for', 'custom-id');
  });

  it('should have proper focus styles', async () => {
    render(<Select options={defaultOptions} />);
    
    const select = screen.getByRole('combobox');
    await user.click(select);
    
    expect(select).toHaveFocus();
    expect(select).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
  });

  it('should display dropdown arrow', () => {
    render(<Select options={defaultOptions} />);
    
    const arrow = screen.getByRole('combobox').parentElement?.querySelector('svg');
    expect(arrow).toBeInTheDocument();
    expect(arrow).toHaveClass('h-5', 'w-5', 'text-gray-400');
  });

  it('should support keyboard navigation', async () => {
    render(<Select options={defaultOptions} />);
    
    const select = screen.getByRole('combobox');
    select.focus();
    
    // Simulate selecting an option first
    await user.selectOptions(select, 'option1');
    expect(select).toHaveValue('option1');
    
    await user.selectOptions(select, 'option2');
    expect(select).toHaveValue('option2');
  });

  it('should handle default value', () => {
    render(<Select options={defaultOptions} defaultValue="option2" />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('option2');
  });

  it('should handle controlled value', () => {
    const { rerender } = render(<Select options={defaultOptions} value="option1" onChange={vi.fn()} />);
    
    let select = screen.getByRole('combobox');
    expect(select).toHaveValue('option1');
    
    rerender(<Select options={defaultOptions} value="option2" onChange={vi.fn()} />);
    select = screen.getByRole('combobox');
    expect(select).toHaveValue('option2');
  });
});