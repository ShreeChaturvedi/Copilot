/**
 * Integration tests for EnhancedTaskInputLayout with HighlightedTextareaField
 * Verifies that the textarea highlighting works properly in the enhanced layout
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancedTaskInputLayout } from '../EnhancedTaskInputLayout';
import { ParsedTag } from "@shared/types";

describe('EnhancedTaskInputLayout Integration', () => {
  const mockTags: ParsedTag[] = [
    {
      id: '1',
      type: 'priority',
      value: 'high',
      displayText: 'high',
      iconName: 'AlertTriangle',
      startIndex: 0,
      endIndex: 4,
      originalText: 'high',
      confidence: 0.9,
      source: 'priority-parser',
      color: '#ef4444'
    }
  ];

  it('renders HighlightedTextareaField when smart parsing is enabled', () => {
    const onChange = vi.fn();
    
    render(
      <EnhancedTaskInputLayout
        value="high priority task"
        onChange={onChange}
        tags={mockTags}
        enableSmartParsing={true}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-label', 'Smart task input with highlighting');
  });

  it('renders plain textarea when smart parsing is disabled', () => {
    const onChange = vi.fn();
    
    render(
      <EnhancedTaskInputLayout
        value="plain task"
        onChange={onChange}
        tags={[]}
        enableSmartParsing={false}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-label', 'Task input');
  });

  it('handles multi-line input correctly', () => {
    const onChange = vi.fn();
    const multiLineText = 'Line 1: high priority\nLine 2: due tomorrow';
    
    render(
      <EnhancedTaskInputLayout
        value={multiLineText}
        onChange={onChange}
        tags={mockTags}
        enableSmartParsing={true}
      />
    );
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(multiLineText);
  });

  it('passes through all props correctly', () => {
    const onChange = vi.fn();
    const onKeyPress = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    
    render(
      <EnhancedTaskInputLayout
        value="test task"
        onChange={onChange}
        tags={mockTags}
        placeholder="Custom placeholder"
        disabled={false}
        onKeyPress={onKeyPress}
        onFocus={onFocus}
        onBlur={onBlur}
        confidence={0.8}
        showConfidence={true}
        enableSmartParsing={true}
        minHeight="150px"
        maxHeight="400px"
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('placeholder', 'Custom placeholder');
    
    // Test event handlers
    fireEvent.change(textarea, { target: { value: 'new text' } });
    expect(onChange).toHaveBeenCalledWith('new text');
    
    fireEvent.focus(textarea);
    expect(onFocus).toHaveBeenCalled();
    
    fireEvent.blur(textarea);
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders controls correctly', () => {
    const onChange = vi.fn();
    const leftControls = <button data-testid="left-control">Left</button>;
    const rightControls = <button data-testid="right-control">Right</button>;
    
    render(
      <EnhancedTaskInputLayout
        value="test"
        onChange={onChange}
        tags={[]}
        leftControls={leftControls}
        rightControls={rightControls}
      />
    );
    
    expect(screen.getByTestId('left-control')).toBeInTheDocument();
    expect(screen.getByTestId('right-control')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    const onChange = vi.fn();
    
    render(
      <EnhancedTaskInputLayout
        value="test"
        onChange={onChange}
        tags={[]}
        disabled={true}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('handles highlighting overlay correctly', () => {
    const onChange = vi.fn();
    const text = 'high priority task';
    
    const { container } = render(
      <EnhancedTaskInputLayout
        value={text}
        onChange={onChange}
        tags={mockTags}
        enableSmartParsing={true}
      />
    );
    
    // Check that overlay exists and has highlighting
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.innerHTML).toContain('inline-highlight-span');
  });
});