/**
 * Overlay Highlighted Input - Proper overlay technique for inline highlighting
 * Uses a real input element with a perfectly aligned visual overlay
 * Based on Stack Overflow research and industry best practices
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ParsedTag } from "@shared/types";
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export interface OverlayHighlightedInputProps {
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
  /** Additional CSS classes */
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
}

/**
 * Overlay highlighted input using industry-standard technique
 */
export const OverlayHighlightedInput: React.FC<OverlayHighlightedInputProps> = ({
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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setIsFocused] = useState(false);

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
      
      events.forEach(event => {
        input.addEventListener(event, syncScroll);
      });
      
      // Initial sync
      syncScroll();
      
      return () => {
        events.forEach(event => {
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
      
      // Use span with exact styling to match TaskItem badges
      html += `<span class="inline-highlight-span" style="--tag-color: ${color}; background-color: ${color}20; border: 1px solid ${color}30; color: inherit; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(tagText)}</span>`;
      
      lastIndex = tag.endIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      html += escapeHtml(value.substring(lastIndex));
    }

    return html;
  }, [value, tags]);

  // Handle input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // Trigger scroll sync after state update
    requestAnimationFrame(syncScroll);
  }, [onChange, syncScroll]);

  // Handle key press events
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyPress?.(e);
    // Sync after key events
    requestAnimationFrame(syncScroll);
  }, [onKeyPress, syncScroll]);

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
    <div ref={containerRef} className="relative">
      {/* Real input element - handles all interaction */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          // Make input transparent but fully interactive
          'relative z-10 bg-transparent',
          // Ensure text is invisible but selection/cursor visible
          'text-transparent',
          // Maintain all normal input styling
          className
        )}
        style={{
          // Ensure caret is visible
          caretColor: 'var(--foreground)',
          // Perfect font matching for overlay alignment
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
        }}
        id="overlay-task-input"
        name="overlay-task-input"
        aria-label="Smart task input with highlighting"
      />

      {/* Overlay div - shows visual highlighting */}
      <div
        ref={overlayRef}
        className={cn(
          // Position exactly over the input
          'absolute inset-0 pointer-events-none',
          // Match input styling exactly INCLUDING the passed className padding
          'flex h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent py-1 text-base shadow-xs transition-[color,box-shadow] md:text-sm',
          // Typography matching
          'font-inherit text-foreground',
          // Layout matching - add margin-right to prevent spillover into send button
          'items-center whitespace-nowrap overflow-x-auto mr-12',
          // Ensure it's behind the input
          'z-0',
          // CRITICAL: Apply the same padding classes that were passed to the input (EXCEPT pr-12)
          'pl-10'
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
        aria-hidden="true"
      />

      {/* Confidence indicator */}
      {showConfidence && confidence < 1 && tags.length > 0 && (
        <div className="absolute -bottom-1 right-1 flex items-center gap-1 z-20">
          <div 
            className={cn(
              'w-2 h-2 rounded-full',
              confidence >= 0.8 ? 'bg-green-400' : 
              confidence >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'
            )}
            title={`Parsing confidence: ${Math.round(confidence * 100)}%`}
          />
        </div>
      )}
    </div>
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