import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../Select';

const renderSelect = (props?: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  return render(
    <Select
      defaultValue={props?.defaultValue}
      value={props?.value}
      onValueChange={props?.onValueChange}
      open={props?.open}
      onOpenChange={props?.onOpenChange}
    >
      <SelectTrigger aria-label="Test select" disabled={props?.disabled}>
        <SelectValue placeholder="Select option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3" disabled>
          Option 3
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

describe('Select Component', () => {
  it('should render trigger with placeholder', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox', { name: 'Test select' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Select option');
    expect(trigger).toHaveAttribute('data-slot', 'select-trigger');
  });

  it('should open and render options', async () => {
    renderSelect({ open: true, onOpenChange: vi.fn() });

    expect(
      screen.getByRole('option', { name: 'Option 1' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Option 2' })
    ).toBeInTheDocument();
    const disabledOption = screen.getByRole('option', { name: 'Option 3' });
    expect(disabledOption).toHaveAttribute('data-disabled');
  });

  it('should call onValueChange when selecting an option', () => {
    const onValueChange = vi.fn();
    renderSelect({
      open: true,
      onOpenChange: vi.fn(),
      onValueChange,
    });

    fireEvent.click(screen.getByRole('option', { name: 'Option 2' }));
    expect(onValueChange).toHaveBeenCalledWith('option2');
  });

  it('should handle default value', () => {
    renderSelect({ defaultValue: 'option2' });

    const trigger = screen.getByRole('combobox', { name: 'Test select' });
    expect(trigger).toHaveTextContent('Option 2');
  });

  it('should handle controlled value', () => {
    const onValueChange = vi.fn();
    const { rerender } = renderSelect({
      value: 'option1',
      onValueChange,
    });

    let trigger = screen.getByRole('combobox', { name: 'Test select' });
    expect(trigger).toHaveTextContent('Option 1');

    rerender(
      <Select value="option2" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Test select">
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
          <SelectItem value="option3" disabled>
            Option 3
          </SelectItem>
        </SelectContent>
      </Select>
    );

    trigger = screen.getByRole('combobox', { name: 'Test select' });
    expect(trigger).toHaveTextContent('Option 2');
  });

  it('should render the dropdown icon', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox', { name: 'Test select' });
    const icon = trigger.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should include focus-visible classes', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox', { name: 'Test select' });
    expect(trigger).toHaveClass(
      'focus-visible:border-ring',
      'focus-visible:ring-[3px]'
    );
  });
});
