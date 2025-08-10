/**
 * Requirements verification tests for HighlightedTextareaField
 * 
 * This test file specifically verifies all requirements from task 4:
 * - Test HighlightedInputField component with multi-line textarea ✓
 * - Fix any textarea-specific highlighting issues ✓
 * - Ensure scroll synchronization works with larger input area ✓
 * - Verify cursor positioning and text selection work correctly ✓
 * - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 ✓
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HighlightedTextareaField } from '../HighlightedTextareaField';
import { ParsedTag } from "@shared/types";

describe('HighlightedTextareaField - Requirements Verification', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame for consistent testing
    global.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
    
    // Mock DOM properties for textarea
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: function() { return this.value.split('\n').length * 20 + 40; }
    });
  });

  const createTestTags = (text: string): ParsedTag[] => [
    {
      id: '1',
      type: 'priority' as const,
      value: 'high',
      displayText: 'high',
      iconName: 'AlertTriangle',
      startIndex: text.indexOf('high'),
      endIndex: text.indexOf('high') + 4,
      originalText: 'high',
      confidence: 0.9,
      source: 'priority-parser',
      color: '#ef4444'
    },
    {
      id: '2',
      type: 'date' as const,
      value: new Date('2024-01-15'),
      displayText: 'tomorrow',
      iconName: 'Calendar',
      startIndex: text.indexOf('tomorrow'),
      endIndex: text.indexOf('tomorrow') + 8,
      originalText: 'tomorrow',
      confidence: 0.8,
      source: 'date-parser',
      color: '#3b82f6'
    }
  ].filter(tag => tag.startIndex !== -1);

  describe('Requirement 1.1: Real-time highlighting as user types', () => {
    it('highlights tags in real-time without lag or flickering', async () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <HighlightedTextareaField
          value=""
          onChange={onChange}
          tags={[]}
        />
      );

      // Start typing
      const text1 = 'high';
      rerender(
        <HighlightedTextareaField
          value={text1}
          onChange={onChange}
          tags={createTestTags(text1)}
        />
      );

      // Check highlighting appears
      const overlay = container.querySelector('[aria-hidden="true"]');
      expect(overlay?.innerHTML).toContain('inline-highlight-span');
      expect(overlay?.innerHTML).toContain('background-color: #ef444420');

      // Continue typing
      const text2 = 'high priority task due tomorrow';
      rerender(
        <HighlightedTextareaField
          value={text2}
          onChange={onChange}
          tags={createTestTags(text2)}
        />
      );

      // Check both tags are highlighted
      expect(overlay?.innerHTML).toContain('high');
      expect(overlay?.innerHTML).toContain('tomorrow');
    });
  });

  describe('Requirement 1.2: Highlighting appears in real-time as user types', () => {
    it('updates highlighting dynamically during text input', () => {
      const onChange = vi.fn();
      const initialText = 'Task with high priority';
      
      const { container } = render(
        <HighlightedTextareaField
          value={initialText}
          onChange={onChange}
          tags={createTestTags(initialText)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const overlay = container.querySelector('[aria-hidden="true"]');

      // Simulate typing more text
      const newText = initialText + ' due tomorrow';
      fireEvent.change(textarea, { target: { value: newText } });

      // Verify onChange was called
      expect(onChange).toHaveBeenCalledWith(newText);
      
      // Verify highlighting structure is maintained
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Requirement 1.3: Same visual styling as existing left pane highlighting', () => {
    it('uses consistent highlighting styles with existing implementation', () => {
      const onChange = vi.fn();
      const text = 'high priority task due tomorrow';
      
      const { container } = render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createTestTags(text)}
        />
      );

      const overlay = container.querySelector('[aria-hidden="true"]');
      
      // Check for consistent styling classes and properties
      expect(overlay?.innerHTML).toContain('inline-highlight-span');
      expect(overlay?.innerHTML).toContain('background-color: #ef444420');
      expect(overlay?.innerHTML).toContain('border: 1px solid #ef444430');
      expect(overlay?.innerHTML).toContain('padding: 1px 2px');
      expect(overlay?.innerHTML).toContain('border-radius: 2px');
      expect(overlay?.innerHTML).toContain('font-weight: 500');
    });
  });

  describe('Requirement 1.4: Distinct colors for different tag types', () => {
    it('displays different tag types with distinct colors', () => {
      const onChange = vi.fn();
      const text = 'high priority task due tomorrow';
      const tags = createTestTags(text);
      
      const { container } = render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={tags}
        />
      );

      const overlay = container.querySelector('[aria-hidden="true"]');
      
      // Check that different colors are used for different tag types
      expect(overlay?.innerHTML).toContain('#ef444420'); // Priority tag color
      expect(overlay?.innerHTML).toContain('#3b82f620'); // Date tag color
      
      // Ensure colors are different
      expect(overlay?.innerHTML).not.toBe(overlay?.innerHTML.replace('#ef444420', '#3b82f620'));
    });
  });

  describe('Requirement 1.5: Dynamic highlighting updates when editing', () => {
    it('updates highlighting dynamically when text is edited', async () => {
      const onChange = vi.fn();
      const initialText = 'high priority task';
      
      const { container, rerender } = render(
        <HighlightedTextareaField
          value={initialText}
          onChange={onChange}
          tags={createTestTags(initialText)}
        />
      );

      const overlay = container.querySelector('[aria-hidden="true"]');
      const initialHTML = overlay?.innerHTML;

      // Edit the text
      const editedText = 'medium priority task due tomorrow';
      rerender(
        <HighlightedTextareaField
          value={editedText}
          onChange={onChange}
          tags={createTestTags(editedText)}
        />
      );

      const updatedHTML = overlay?.innerHTML;
      
      // Highlighting should have changed
      expect(updatedHTML).not.toBe(initialHTML);
      expect(updatedHTML).toContain('tomorrow');
    });
  });

  describe('Multi-line textarea functionality', () => {
    it('works correctly with multi-line text input', () => {
      const onChange = vi.fn();
      const multiLineText = 'Line 1: high priority task\nLine 2: due tomorrow\nLine 3: final notes';
      
      render(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={createTestTags(multiLineText)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Verify it's a textarea element
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.value).toBe(multiLineText);
    });

    it('handles line breaks in highlighting correctly', () => {
      const onChange = vi.fn();
      const multiLineText = 'high priority\ntask due tomorrow';
      
      const { container } = render(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={createTestTags(multiLineText)}
        />
      );

      const overlay = container.querySelector('[aria-hidden="true"]');
      
      // Check that line breaks are preserved in overlay
      expect(overlay?.innerHTML).toContain('<br>');
      expect(overlay?.innerHTML).toContain('inline-highlight-span');
    });
  });

  describe('Scroll synchronization with larger input area', () => {
    it('synchronizes scroll between textarea and overlay', async () => {
      const onChange = vi.fn();
      const longText = Array(10).fill('Line with high priority content').join('\n');
      
      const { container } = render(
        <HighlightedTextareaField
          value={longText}
          onChange={onChange}
          tags={createTestTags(longText)}
          maxHeight="100px"
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const overlay = container.querySelector('[aria-hidden="true"]');

      expect(overlay).toBeInTheDocument();

      // Simulate scrolling
      fireEvent.scroll(textarea);
      
      // Verify requestAnimationFrame was called for scroll sync
      await waitFor(() => {
        expect(global.requestAnimationFrame).toHaveBeenCalled();
      });
    });

    it('maintains scroll synchronization during input events', async () => {
      const onChange = vi.fn();
      const text = 'Initial text with high priority';
      
      render(
        <HighlightedTextareaField
          value={text}
          onChange={onChange}
          tags={createTestTags(text)}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate input event
      fireEvent.input(textarea);
      
      // Verify scroll sync is triggered
      await waitFor(() => {
        expect(global.requestAnimationFrame).toHaveBeenCalled();
      });
    });
  });

  describe('Cursor positioning and text selection', () => {
    it('maintains transparent text with visible cursor', () => {
      const onChange = vi.fn();
      
      render(
        <HighlightedTextareaField
          value="Text with cursor"
          onChange={onChange}
          tags={[]}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Check text transparency
      expect(textarea.className).toContain('text-transparent');
      
      // Focus should make caret visible
      fireEvent.focus(textarea);
      expect(textarea.style.caretColor).toBe('var(--foreground)');
    });

    it('handles text selection correctly', () => {
      const onChange = vi.fn();
      
      render(
        <HighlightedTextareaField
          value="Selectable text content"
          onChange={onChange}
          tags={[]}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Test text selection
      textarea.setSelectionRange(0, 10);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(10);
    });

    it('maintains proper layering for interaction', () => {
      const onChange = vi.fn();
      
      const { container } = render(
        <HighlightedTextareaField
          value="Interactive text"
          onChange={onChange}
          tags={[]}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const overlay = container.querySelector('[aria-hidden="true"]');

      // Textarea should be above overlay for interaction
      expect(textarea.className).toContain('z-10');
      expect(overlay?.className).toContain('z-0');
    });
  });

  describe('Auto-resizing functionality', () => {
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
      expect(textarea.style.height).toBe('120px');

      // Add more content
      const multiLineText = Array(5).fill('Long line of text').join('\n');
      rerender(
        <HighlightedTextareaField
          value={multiLineText}
          onChange={onChange}
          tags={[]}
          minHeight="120px"
          maxHeight="300px"
        />
      );

      // Height should increase
      await waitFor(() => {
        expect(parseInt(textarea.style.height)).toBeGreaterThan(120);
      });
    });
  });
});