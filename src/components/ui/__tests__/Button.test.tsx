import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from '../Button';
import { expect, vi, describe, it } from 'vitest';

describe('Button Component', () => {
  const user = userEvent.setup();

  it('should render with default props', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
      'h-9',
      'px-4',
      'py-2'
    );
  });

  it('should render different variants correctly', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'bg-secondary',
      'text-secondary-foreground'
    );

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border', 'bg-background');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'bg-destructive',
      'text-white'
    );

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'text-primary',
      'hover:underline'
    );
  });

  it('should render different sizes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-8', 'px-3');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'px-6');

    rerender(
      <Button size="icon" aria-label="Icon">
        Icon
      </Button>
    );
    expect(screen.getByRole('button')).toHaveClass('size-9');
  });

  it('should handle disabled state', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass(
      'disabled:opacity-50',
      'disabled:pointer-events-none'
    );
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not trigger click when disabled', async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>);

    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('should forward ref correctly', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref test</Button>);

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it('should support asChild rendering', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should have proper accessibility attributes', () => {
    render(<Button aria-label="Custom label">Button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Custom label');
  });

  it('should support keyboard navigation', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Keyboard test</Button>);

    const button = screen.getByRole('button');
    button.focus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
