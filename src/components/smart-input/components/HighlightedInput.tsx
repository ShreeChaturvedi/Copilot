/**
 * Smart input component that preserves original Input styling with subtle highlighting
 * Uses background overlay technique to highlight parsed tags while keeping text visible
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { ParsedTag } from "@shared/types";
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export interface HighlightedInputProps {
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
 * Smart highlighted input that maintains original Input appearance
 */
export const HighlightedInput: React.FC<HighlightedInputProps> = ({
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
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between input and highlight div
  useEffect(() => {
    const input = inputRef.current;
    const highlight = highlightRef.current;
    
    if (input && highlight) {
      const syncScroll = () => {
        highlight.scrollLeft = input.scrollLeft;
      };
      
      input.addEventListener('scroll', syncScroll);
      input.addEventListener('input', syncScroll);
      
      return () => {
        input.removeEventListener('scroll', syncScroll);
        input.removeEventListener('input', syncScroll);
      };
    }
  }, []);

  // Generate highlighted HTML for background layer
  const highlightedHTML = useMemo(() => {
    if (!value || tags.length === 0) {
      return escapeHtml(value);
    }

    const sortedTags = [...tags].sort((a, b) => a.startIndex - b.startIndex);
    let html = '';
    let lastIndex = 0;

    for (const tag of sortedTags) {
      // Add text before the tag
      if (tag.startIndex > lastIndex) {
        html += escapeHtml(value.substring(lastIndex, tag.startIndex));
      }

      // Add highlighted tag with subtle background
      const tagText = value.substring(tag.startIndex, tag.endIndex);
      const color = tag.color || '#3b82f6';
      
      // Create a more sophisticated highlight style
      html += `<mark class="smart-highlight" style="background-color: ${color}20; color: inherit; padding: 0; border-radius: 2px; box-shadow: 0 0 0 1px ${color}30;">${escapeHtml(tagText)}</mark>`;
      
      lastIndex = tag.endIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      html += escapeHtml(value.substring(lastIndex));
    }

    return html;
  }, [value, tags]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyPress?.(e);
  };

  return (
    <div className="relative">
      {/* Background highlight layer - must match Input component styling exactly */}
      {tags.length > 0 && (
        <div
          ref={highlightRef}
          className={cn(
            // Copy exact Input component classes for perfect alignment
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            // Override for highlight-specific behavior
            'absolute inset-0 pointer-events-none overflow-hidden whitespace-pre',
            'text-transparent select-none border-transparent shadow-none',
            // Remove focus and interaction styles
            '!ring-0 !ring-offset-0'
          )}
          style={{
            // Remove any focus/interaction styling that might offset positioning
            boxShadow: 'none',
            outline: 'none',
            border: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
      )}

      {/* Main input */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          className,
          tags.length > 0 && 'bg-transparent relative z-10'
        )}
        id="highlighted-task-input"
        name="highlighted-task-input"
        aria-label="Smart task input with highlighting"
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