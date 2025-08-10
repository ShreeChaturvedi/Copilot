/**
 * Tests for InlineHighlightedInput component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineHighlightedInput } from '../InlineHighlightedInput';
import { ParsedTag } from "@shared/types";

// Mock tag data for testing
const mockTags: ParsedTag[] = [
  {
    id: 'tag-1',
    type: 'date',
    value: new Date('2025-12-31'),
    displayText: 'Dec 31',
    iconName: 'Calendar',
    startIndex: 15,
    endIndex: 21,
    originalText: 'Dec 31',
    confidence: 0.9,
    source: 'chrono',
    color: '#3b82f6'
  },
  {
    id: 'tag-2',
    type: 'priority',
    value: 'high',
    displayText: 'high',
    iconName: 'Flag',
    startIndex: 25,
    endIndex: 29,
    originalText: 'high',
    confidence: 0.8,
    source: 'priority',
    color: '#ef4444'
  }
];

describe('InlineHighlightedInput', () => {
  it('renders without crashing', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
        placeholder="Enter text..."
      />
    );
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays placeholder when empty', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
        placeholder="Enter a task..."
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('data-placeholder', 'Enter a task...');
  });

  it('calls onChange when text is input', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
        placeholder="Enter text..."
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { textContent: 'Hello world' } });
    
    expect(onChange).toHaveBeenCalledWith('Hello world');
  });

  it('prevents Enter key submission', () => {
    const onChange = vi.fn();
    const onKeyPress = vi.fn();
    
    render(
      <InlineHighlightedInput
        value="test"
        onChange={onChange}
        tags={[]}
        onKeyPress={onKeyPress}
      />
    );
    
    const input = screen.getByRole('textbox');
    
    // Use fireEvent.keyDown which should trigger our handleKeyDown
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // The onKeyPress should still be called since we only prevent default
    expect(onKeyPress).toHaveBeenCalled();
  });

  it('displays confidence indicator when enabled and confidence is low', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value="test task"
        onChange={onChange}
        tags={mockTags}
        showConfidence={true}
        confidence={0.5}
      />
    );
    
    // Should show red indicator for low confidence
    const indicator = document.querySelector('.bg-red-400');
    expect(indicator).toBeInTheDocument();
  });

  it('handles focus and blur events', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onChange = vi.fn();
    
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
    
    const input = screen.getByRole('textbox');
    
    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalled();
    
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
        disabled={true}
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('contentEditable', 'false');
    expect(input).toHaveClass('cursor-not-allowed', 'opacity-50');
  });

  it('maintains single-line behavior', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value="test"
        onChange={onChange}
        tags={[]}
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('whitespace-nowrap');
    expect(input).toHaveAttribute('aria-multiline', 'false');
  });

  it('has proper accessibility attributes', () => {
    const onChange = vi.fn();
    render(
      <InlineHighlightedInput
        value=""
        onChange={onChange}
        tags={[]}
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Smart task input with highlighting');
    expect(input).toHaveAttribute('role', 'textbox');
    expect(input).toHaveAttribute('spellCheck', 'false');
  });
});