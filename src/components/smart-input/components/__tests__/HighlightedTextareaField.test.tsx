/**
 * Tests for HighlightedTextareaField component
 */


import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HighlightedTextareaField } from '../HighlightedTextareaField';
import { ParsedTag } from "@shared/types";

describe('HighlightedTextareaField', () => {
  const mockTags: ParsedTag[] = [
    {
      id: '1',
      type: 'priority',
      value: 'high',
      displayText: 'High Priority',
      iconName: 'AlertCircle',
      color: '#ef4444',
      startIndex: 0,
      endIndex: 4,
      originalText: 'high',
      confidence: 0.9,
      source: 'test-parser'
    }
  ];

  it('renders without crashing', () => {
    const onChange = vi.fn();
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
      />
    );
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays placeholder when empty', () => {
    const onChange = vi.fn();
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
        placeholder="Enter task..."
      />
    );
    
    expect(screen.getByPlaceholderText('Enter task...')).toBeInTheDocument();
  });

  it('calls onChange when text is input', () => {
    const onChange = vi.fn();
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test task' } });
    
    expect(onChange).toHaveBeenCalledWith('test task');
  });

  it('handles focus and blur events', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onChange = vi.fn();
    
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    
    fireEvent.focus(textarea);
    expect(onFocus).toHaveBeenCalled();
    
    fireEvent.blur(textarea);
    expect(onBlur).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
        disabled={true}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('supports multi-line text', () => {
    const onChange = vi.fn();
    const multiLineText = 'Line 1\nLine 2\nLine 3';
    
    render(
      <HighlightedTextareaField
        value={multiLineText}
        onChange={onChange}
        tags={[]}
      />
    );
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(multiLineText);
  });

  it('has proper accessibility attributes', () => {
    const onChange = vi.fn();
    render(
      <HighlightedTextareaField
        value=""
        onChange={onChange}
        tags={[]}
      />
    );
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('aria-label', 'Smart task input with highlighting');
  });

  it('shows confidence indicator when enabled and confidence is low', () => {
    const onChange = vi.fn();
    const { container } = render(
      <HighlightedTextareaField
        value="high priority task"
        onChange={onChange}
        tags={mockTags}
        confidence={0.5}
        showConfidence={true}
      />
    );
    
    const indicator = container.querySelector('[title*="Parsing confidence"]');
    expect(indicator).toBeInTheDocument();
  });
});