/**
 * Tests for SmartTaskInput enhanced layout integration
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SmartTaskInput } from '../SmartTaskInput';

describe('SmartTaskInput Enhanced Layout Integration', () => {
  const mockOnAddTask = vi.fn();

  it('renders enhanced layout when useEnhancedLayout is true', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
      />
    );

    // Should render textarea instead of input
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    // Should have the enhanced layout structure (Card container)
    const form = screen.getByRole('textbox').closest('form');
    expect(form).toBeInTheDocument();

    // Should have controls area (look for submit button)
    expect(
      screen.getByRole('button', { name: /add task/i })
    ).toBeInTheDocument();
  });

  it('renders regular layout when useEnhancedLayout is false', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={false}
        useFlexInputGroup={true}
        enableSmartParsing={false}
      />
    );

    // Should render regular input
    const input = screen.getByRole('textbox');
    expect(input.tagName.toLowerCase()).toBe('input');
  });

  it('passes correct props to EnhancedTaskInputLayout', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
        showConfidence={true}
        disabled={false}
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('placeholder', 'Add Task');
    expect(textarea).not.toBeDisabled();
  });

  it('handles disabled state in enhanced layout', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        disabled={true}
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });
});
