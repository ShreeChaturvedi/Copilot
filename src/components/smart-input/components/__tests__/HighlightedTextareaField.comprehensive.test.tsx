/**
 * Comprehensive tests for HighlightedTextareaField component
 * Testing all requirements from task 4:
 * - Multi-line textarea functionality
 * - Scroll synchronization with larger input area
 * - Cursor positioning and text selection
 * - Highlighting accuracy with multi-line content
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HighlightedTextareaField } from '../HighlightedTextareaField';
import { ParsedTag } from '@shared/types';

// Mock requestAnimationFrame for testing
const mockRequestAnimationFrame = vi.fn((callback) => {
  callback();
  return 1;
});

describe('HighlightedTextareaField - Comprehensive Tests', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalScrollHeight = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'scrollHeight'
  );
  const originalScrollTop = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'scrollTop'
  );
  const originalScrollLeft = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'scrollLeft'
  );
  const deletePrototypeProperty = (
    key: 'scrollHeight' | 'scrollTop' | 'scrollLeft'
  ) => {
    const prototype = HTMLTextAreaElement.prototype as {
      scrollHeight?: number;
      scrollTop?: number;
      scrollLeft?: number;
    };

    delete prototype[key];
  };

  beforeEach(() => {
    // Mock requestAnimationFrame
    global.requestAnimationFrame = mockRequestAnimationFrame;

    // Mock scrollHeight and other DOM properties
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: function () {
        return this.value.split('\n').length * 20 + 40;
      },
    });

    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollTop', {
      configurable: true,
      get: function () {
        return this._scrollTop || 0;
      },
      set: function (value) {
        this._scrollTop = value;
      },
    });

    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollLeft', {
      configurable: true,
      get: function () {
        return this._scrollLeft || 0;
      },
      set: function (value) {
        this._scrollLeft = value;
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalRequestAnimationFrame) {
      global.requestAnimationFrame = originalRequestAnimationFrame;
    }
    if (originalScrollHeight) {
      Object.defineProperty(
        HTMLTextAreaElement.prototype,
        'scrollHeight',
        originalScrollHeight
      );
    } else {
      deletePrototypeProperty('scrollHeight');
    }
    if (originalScrollTop) {
      Object.defineProperty(
        HTMLTextAreaElement.prototype,
        'scrollTop',
        originalScrollTop
      );
    } else {
      deletePrototypeProperty('scrollTop');
    }
    if (originalScrollLeft) {
      Object.defineProperty(
        HTMLTextAreaElement.prototype,
        'scrollLeft',
        originalScrollLeft
      );
    } else {
      deletePrototypeProperty('scrollLeft');
    }
  });

  const createMockTags = (text: string): ParsedTag[] => [
    {
      id: '1',
      type: 'priority',
      value: 'high',
      displayText: 'high',
      iconName: 'AlertTriangle',
      startIndex: text.indexOf('high'),
      endIndex: text.indexOf('high') + 4,
      originalText: 'high',
      confidence: 0.9,
      source: 'priority-parser',
      color: '#ef4444',
    },
    {
      id: '2',
      type: 'date',
      value: new Date('2024-01-15'),
      displayText: 'tomorrow',
      iconName: 'Calendar',
      startIndex: text.indexOf('tomorrow'),
      endIndex: text.indexOf('tomorrow') + 8,
      originalText: 'tomorrow',
      confidence: 0.8,
      source: 'date-parser',
      color: '#3b82f6',
    },
  ];

  describe('Multi-line textarea functionality', () => {
    it('handles multi-line text input correctly', () => {
      const onChange = vi.fn();
      const multiLineText =
        'Line 1: high priority task\nLine 2: due tomorrow\nLine 3: final notes';

      render(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={createMockTags(multiLineText)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(multiLineText);
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('auto-resizes based on content', async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <HighlightedTextareaField
          value="Single line"
          onChange={onChange}
          tags={[]}
          minHeight="120px"
          maxHeight="300px"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Initial height should be minimum
      expect(textarea.style.height).toBe('120px');

      // Add more content
      const multiLineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      rerender(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={[]}
          minHeight="120px"
          maxHeight="300px"
        />
      );

      // Height should increase based on content
      await waitFor(() => {
        expect(parseInt(textarea.style.height)).toBeGreaterThan(120);
      });
    });

    it('respects maximum height and shows scrollbar', async () => {
      const onChange = vi.fn();
      const veryLongText = Array(20)
        .fill('This is a long line of text')
        .join('\n');

      render(
        <HighlightedTextareaField
          value={veryLongText}
          onChange={onChange}
          tags={[]}
          minHeight="120px"
          maxHeight="200px"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      await waitFor(() => {
        expect(textarea.style.height).toBe('200px');
        expect(textarea.style.overflowY).toBe('auto');
      });
    });
  });

  describe('Scroll synchronization', () => {
    it('synchronizes scroll between textarea and overlay', async () => {
      const onChange = vi.fn();
      const longText = Array(10)
        .fill('This is a line with high priority and due tomorrow')
        .join('\n');

      const { container } = render(
        <HighlightedTextareaField
          value={longText}
          onChange={onChange}
          tags={createMockTags(longText)}
          maxHeight="100px"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;

      expect(overlay).toBeInTheDocument();

      // Simulate scrolling
      textarea.scrollTop = 50;
      textarea.scrollLeft = 10;

      fireEvent.scroll(textarea);

      await waitFor(() => {
        expect(mockRequestAnimationFrame).toHaveBeenCalled();
      });
    });

    it('synchronizes scroll on input events', async () => {
      const onChange = vi.fn();
      const text = 'Initial text with high priority';

      render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createMockTags(text)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate typing
      fireEvent.change(textarea, { target: { value: text + '\nNew line' } });

      await waitFor(() => {
        expect(mockRequestAnimationFrame).toHaveBeenCalled();
      });
    });

    it('synchronizes scroll on focus and key events', async () => {
      const onChange = vi.fn();
      const text = 'Text with high priority due tomorrow';

      render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createMockTags(text)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Test focus event
      fireEvent.focus(textarea);
      await waitFor(() => {
        expect(mockRequestAnimationFrame).toHaveBeenCalled();
      });

      mockRequestAnimationFrame.mockClear();

      // Test key events
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await waitFor(() => {
        expect(mockRequestAnimationFrame).toHaveBeenCalled();
      });
    });
  });

  describe('Text highlighting with multi-line content', () => {
    it('highlights tags correctly across multiple lines', () => {
      const onChange = vi.fn();
      const multiLineText =
        'Line 1: high priority task\nLine 2: due tomorrow\nLine 3: final notes';
      const tags = createMockTags(multiLineText);

      const { container } = render(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={tags}
        />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      expect(overlay).toBeInTheDocument();

      // Check that overlay content includes line breaks
      expect(overlay.innerHTML).toContain('<br>');

      // Check that highlighted spans are present
      expect(overlay.innerHTML).toContain('inline-highlight-span');
      expect(overlay.innerHTML).toContain('background-color: #ef444420');
      expect(overlay.innerHTML).toContain('background-color: #3b82f620');
    });

    it('handles tags at line boundaries correctly', () => {
      const onChange = vi.fn();
      const text = 'high\npriority\ntomorrow';
      const tags: ParsedTag[] = [
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
          color: '#ef4444',
        },
        {
          id: '2',
          type: 'date',
          value: new Date('2024-01-15'),
          displayText: 'tomorrow',
          iconName: 'Calendar',
          startIndex: 14,
          endIndex: 22,
          originalText: 'tomorrow',
          confidence: 0.8,
          source: 'date-parser',
          color: '#3b82f6',
        },
      ];

      const { container } = render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={tags}
        />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;

      // Should have proper line breaks and highlighting
      expect(overlay.innerHTML).toContain('<br>');
      expect(overlay.innerHTML).toContain('inline-highlight-span');
    });

    it('updates highlighting when content changes', async () => {
      const onChange = vi.fn();
      const initialText = 'Task with high priority';
      const updatedText = 'Task with high priority due tomorrow';

      const { container, rerender } = render(
        <HighlightedTextareaField
          value={initialText}
          onChange={onChange}
          tags={createMockTags(initialText)}
        />
      );

      let overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      const initialHTML = overlay.innerHTML;

      // Update with new content and tags
      rerender(
        <HighlightedTextareaField
          value={updatedText}
          onChange={onChange}
          tags={createMockTags(updatedText)}
        />
      );

      overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      const updatedHTML = overlay.innerHTML;

      expect(updatedHTML).not.toBe(initialHTML);
      expect(updatedHTML).toContain('tomorrow');
    });
  });

  describe('Cursor positioning and text selection', () => {
    it('maintains transparent text with visible cursor', () => {
      const onChange = vi.fn();
      const text = 'Text with high priority';

      render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createMockTags(text)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Check that text is transparent but cursor is visible
      expect(textarea.className).toContain('text-transparent');

      // Focus should make caret visible
      fireEvent.focus(textarea);
      expect(textarea.style.caretColor).toBe('var(--foreground)');
    });

    it('handles text selection correctly', () => {
      const onChange = vi.fn();
      const text = 'Selectable text with high priority';

      render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createMockTags(text)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate text selection
      textarea.setSelectionRange(0, 10);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(10);
    });

    it('maintains proper z-index for interaction', () => {
      const onChange = vi.fn();
      const text = 'Interactive text';

      const { container } = render(
        <HighlightedTextareaField value={text} onChange={onChange} tags={[]} />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;

      // Textarea should be above overlay for interaction
      expect(textarea.className).toContain('z-10');
      expect(overlay?.className).toContain('z-0');
    });
  });

  describe('Performance and edge cases', () => {
    it('handles empty text gracefully', () => {
      const onChange = vi.fn();

      const { container } = render(
        <HighlightedTextareaField value="" onChange={onChange} tags={[]} />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      expect(overlay.innerHTML).toBe('');
    });

    it('handles text with no tags', () => {
      const onChange = vi.fn();
      const text = 'Plain text without any tags';

      const { container } = render(
        <HighlightedTextareaField value={text} onChange={onChange} tags={[]} />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      expect(overlay.innerHTML).toBe('Plain text without any tags');
    });

    it('escapes HTML characters properly', () => {
      const onChange = vi.fn();
      const text = 'Text with <script>alert("xss")</script> and & symbols';

      const { container } = render(
        <HighlightedTextareaField value={text} onChange={onChange} tags={[]} />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      expect(overlay.innerHTML).toContain('&lt;script&gt;');
      expect(overlay.innerHTML).toContain('&amp;');
      expect(overlay.innerHTML).not.toContain('<script>');
    });

    it('handles overlapping tags correctly', () => {
      const onChange = vi.fn();
      const text = 'high priority task';
      const overlappingTags: ParsedTag[] = [
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
          color: '#ef4444',
        },
        {
          id: '2',
          type: 'priority',
          value: 'high priority',
          displayText: 'high priority',
          iconName: 'AlertTriangle',
          startIndex: 0,
          endIndex: 13,
          originalText: 'high priority',
          confidence: 0.7,
          source: 'priority-parser-2',
          color: '#f59e0b',
        },
      ];

      const { container } = render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={overlappingTags}
        />
      );

      const overlay = container.querySelector(
        '[aria-hidden="true"]'
      ) as HTMLDivElement;
      expect(overlay.innerHTML).toContain('inline-highlight-span');
    });
  });

  describe('Accessibility and usability', () => {
    it('maintains proper ARIA attributes', () => {
      const onChange = vi.fn();

      render(
        <HighlightedTextareaField
          value="Accessible text"
          onChange={onChange}
          tags={[]}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute(
        'aria-label',
        'Smart task input with highlighting'
      );

      // Overlay should be hidden from screen readers
      const { container } = render(
        <HighlightedTextareaField value="Test" onChange={onChange} tags={[]} />
      );

      const overlay = container.querySelector('[aria-hidden="true"]');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });

    it('supports keyboard navigation', () => {
      const onChange = vi.fn();
      const onKeyPress = vi.fn();

      render(
        <HighlightedTextareaField
          value="Keyboard accessible"
          onChange={onChange}
          tags={[]}
          onKeyPress={onKeyPress}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Use keyDown instead of keyPress as keyPress is deprecated
      fireEvent.keyDown(textarea, { key: 'Enter' });

      // Test that the textarea is focusable and interactive
      expect(textarea).not.toHaveAttribute('tabindex', '-1');
      expect(textarea).not.toBeDisabled();
    });
  });
});
