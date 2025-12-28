/**
 * HighlightedInputField - Input with highlighting overlay constrained to input area
 *
 * Proper implementation of input field with syntax highlighting that:
 * 1. Uses transparent input for interaction
 * 2. Overlay positioned within input container only (not full-width)
 * 3. Perfect scroll synchronization
 * 4. No spillover into prefix/suffix areas
 *
 * Based on:
 * - regex101.com overlay technique
 * - Stack Overflow input highlighting solutions
 * - Industry best practices for editable syntax highlighting
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ParsedTag } from '@shared/types';
import { cn } from '@/lib/utils';

export interface HighlightedInputFieldProps {
  /** Current input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Parsed tags for highlighting */
  tags: ParsedTag[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Additional CSS classes for the input */
  className?: string;
  /** Key press handler */
  onKeyPress?: (e: React.KeyboardEvent) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Parsing confidence (0-1) */
  confidence?: number;
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  /** Input ID for accessibility */
  id?: string;
  /** Input name for form compatibility */
  name?: string;
}

/**
 * Input field with highlighting overlay properly constrained to input area
 *
 * Key differences from previous implementation:
 * - Overlay is constrained to input container boundaries
 * - No absolute positioning relative to form
 * - Proper padding inheritance from input
 * - No spillover into prefix/suffix areas
 */
export const HighlightedInputField: React.FC<HighlightedInputFieldProps> = ({
  value,
  onChange,
  tags,
  placeholder = '',
  disabled = false,
  className = '',
  onKeyPress,
  onBlur,
  onFocus,
  confidence = 1,
  showConfidence = false,
  id,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync scroll position between input and overlay
  const syncScroll = useCallback(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;

    if (input && overlay) {
      // Use requestAnimationFrame for smooth synchronization
      requestAnimationFrame(() => {
        overlay.scrollLeft = input.scrollLeft;
      });
    }
  }, []);

  // Set up scroll synchronization
  useEffect(() => {
    const input = inputRef.current;

    if (input) {
      // Sync on all relevant events
      const events = ['scroll', 'input', 'focus', 'keydown', 'keyup'];

      events.forEach((event) => {
        input.addEventListener(event, syncScroll);
      });

      // Initial sync
      syncScroll();

      return () => {
        events.forEach((event) => {
          input.removeEventListener(event, syncScroll);
        });
      };
    }
  }, [syncScroll]);

  // Generate highlighted HTML using character-precise positioning
  const highlightedHTML = useMemo(() => {
    if (!value || tags.length === 0) {
      return escapeHtml(value || '');
    }

    const sortedTags = [...tags].sort((a, b) => a.startIndex - b.startIndex);
    let html = '';
    let lastIndex = 0;

    for (const tag of sortedTags) {
      // Add text before the tag
      if (tag.startIndex > lastIndex) {
        html += escapeHtml(value.substring(lastIndex, tag.startIndex));
      }

      // Add highlighted tag with precise styling
      const tagText = value.substring(tag.startIndex, tag.endIndex);
      const color = tag.color || '#3b82f6';

      // EXACT fix from Enhanced textarea: no border or margin, vertical padding only via CSS
      html += `<mark class="inline-highlight-span" style="--tag-color: ${color}; background-color: ${color}20; border: 1px solid ${color}30; color: inherit; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(tagText)}</mark>`;

      lastIndex = tag.endIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      html += escapeHtml(value.substring(lastIndex));
    }

    return html;
  }, [value, tags]);

  // Handle input changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      // Trigger scroll sync after state update
      requestAnimationFrame(syncScroll);
    },
    [onChange, syncScroll]
  );

  // Handle key press events
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyPress?.(e);
      // Sync after key events
      requestAnimationFrame(syncScroll);
    },
    [onKeyPress, syncScroll]
  );

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    // Sync on focus
    requestAnimationFrame(syncScroll);
  }, [onFocus, syncScroll]);

  // Handle blur events
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Update overlay content when highlighted HTML changes
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.innerHTML = highlightedHTML;
      // Sync scroll after content update
      requestAnimationFrame(syncScroll);
    }
  }, [highlightedHTML, syncScroll]);

  return (
    <>
      {/* Real input element - handles all interaction */}
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          // Base input styles - fill container completely
          'h-full w-full border-none outline-none bg-transparent',
          // Make text transparent but keep cursor visible
          'text-transparent placeholder:text-muted-foreground',
          // Typography - no margins, container handles spacing
          'text-base md:text-sm',
          // Ensure proper z-index for interaction
          'relative z-10',
          // Focus styles handled by parent FlexInputGroup
          'focus:outline-none',
          // Disabled state
          disabled && 'cursor-not-allowed',
          className
        )}
        style={{
          // Ensure caret is visible
          caretColor: isFocused ? 'var(--foreground)' : 'transparent',
          // Perfect font matching for overlay alignment
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
        }}
        aria-label="Smart task input with highlighting"
      />

      {/* Overlay - wrapper centers content vertically, inner preserves spaces */}
      <div
        className={cn(
          // Fill input container
          'absolute inset-0 pointer-events-none z-0',
          // Vertically center to match input caret
          'flex items-center'
        )}
        aria-hidden="true"
      >
        <div
          ref={overlayRef}
          className={cn(
            // Match input width and typography
            'w-full text-foreground text-base md:text-sm',
            // Preserve spaces exactly to match input caret behavior
            'whitespace-pre',
            // Constrain overflow within input bounds
            'overflow-hidden'
          )}
          style={{
            // Critical: Match input font properties exactly
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            letterSpacing: 'inherit',
            // Match text rendering
            textRendering: 'optimizeLegibility',
            // Ensure exact alignment
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Confidence indicator */}
      {showConfidence && confidence < 1 && tags.length > 0 && (
        <div className="absolute -bottom-1 right-1 flex items-center gap-1 z-20">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              confidence >= 0.8
                ? 'bg-green-400'
                : confidence >= 0.6
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
            )}
            title={`Parsing confidence: ${Math.round(confidence * 100)}%`}
          />
        </div>
      )}
    </>
  );
};

/**
 * Escape HTML characters for safe innerHTML usage
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default HighlightedInputField;
