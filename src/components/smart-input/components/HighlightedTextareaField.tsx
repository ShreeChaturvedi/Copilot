import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { ParsedTag } from '@shared/types';
import { cn } from '@/lib/utils';

export interface HighlightedTextareaFieldProps {
  /** Current input value */
  value: string;
  /** Whether recording is active */
  isRecording?: boolean;
  /** Change handler */
  onChange: (value: string) => void;
  /** Parsed tags for highlighting */
  tags: ParsedTag[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Additional CSS classes for the textarea */
  className?: string;
  /** Key press handler */
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Key down handler */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Parsing confidence (0-1) */
  confidence?: number;
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  /** Minimum height for the textarea */
  minHeight?: string;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Textarea ID for accessibility */
  id?: string;
  /** Textarea name for form compatibility */
  name?: string;
}

export const HighlightedTextareaField: React.FC<
  HighlightedTextareaFieldProps
> = ({
  value,
  isRecording = false,
  onChange,
  tags,
  placeholder = '',
  disabled = false,
  className = '',
  onKeyPress,
  onKeyDown,
  onBlur,
  onFocus,
  confidence = 1,
  showConfidence = false,
  minHeight = '120px',
  maxHeight = '300px',
  id,
  name,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (textarea && overlay) {
      requestAnimationFrame(() => {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
      });
    }
  }, []);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, parseInt(minHeight)),
        parseInt(maxHeight)
      );
      textarea.style.height = `${newHeight}px`;
      if (overlayRef.current) {
        overlayRef.current.style.height = `${newHeight}px`;
      }
    }
  }, [minHeight, maxHeight]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const scrollEvents = ['scroll', 'input', 'focus', 'keydown', 'keyup'];
      const resizeEvents = ['input', 'focus', 'blur'];
      scrollEvents.forEach((event) =>
        textarea.addEventListener(event, syncScroll)
      );
      resizeEvents.forEach((event) =>
        textarea.addEventListener(event, autoResize)
      );
      syncScroll();
      autoResize();
      return () => {
        scrollEvents.forEach((event) =>
          textarea.removeEventListener(event, syncScroll)
        );
        resizeEvents.forEach((event) =>
          textarea.removeEventListener(event, autoResize)
        );
      };
    }
  }, [syncScroll, autoResize]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const highlightedHTML = useMemo(() => {
    if (!value || tags.length === 0) {
      return escapeHtml(value || '').replace(/\n/g, '<br>');
    }

    const sortedTags = [...tags].sort((a, b) => a.startIndex - b.startIndex);
    let html = '';
    let lastIndex = 0;

    for (const tag of sortedTags) {
      if (tag.startIndex > lastIndex) {
        html += escapeHtml(value.substring(lastIndex, tag.startIndex)).replace(
          /\n/g,
          '<br>'
        );
      }
      const tagText = value.substring(tag.startIndex, tag.endIndex);
      const color = tag.color || '#3b82f6';
      html += `<mark class="inline-highlight-span" style="--tag-color: ${color}; background-color: ${color}20; border: 1px solid ${color}30; color: inherit; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(tagText)}</mark>`;
      lastIndex = tag.endIndex;
    }

    if (lastIndex < value.length) {
      html += escapeHtml(value.substring(lastIndex)).replace(/\n/g, '<br>');
    }

    return html;
  }, [value, tags]);

  // Handle textarea changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Trigger scroll sync and resize after state update
      requestAnimationFrame(() => {
        syncScroll();
        autoResize();
      });
    },
    [onChange, syncScroll, autoResize]
  );

  // Handle key press events
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyPress?.(e);
      // Sync after key events
      requestAnimationFrame(() => {
        syncScroll();
        autoResize();
      });
    },
    [onKeyPress, syncScroll, autoResize]
  );

  // Handle key down events (for reliable Enter/Shift+Enter detection)
  const handleKeyDownInternal = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      requestAnimationFrame(() => {
        syncScroll();
        autoResize();
      });
    },
    [onKeyDown, syncScroll, autoResize]
  );

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    // Sync on focus
    requestAnimationFrame(() => {
      syncScroll();
      autoResize();
    });
  }, [onFocus, syncScroll, autoResize]);

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
    <div className="relative">
      {/* Real textarea element - handles all interaction */}
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onKeyDown={handleKeyDownInternal}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          // Base textarea styles - fill container completely
          'w-full border-none outline-none bg-transparent resize-none',
          // Make text transparent but keep cursor visible
          'text-transparent placeholder:text-muted-foreground',
          // Typography - EXACT match with regular textarea
          'text-base md:text-sm leading-relaxed',
          // Ensure proper z-index for interaction
          'relative z-10',
          // Focus styles handled by parent EnhancedLayoutWrapper
          'focus:outline-none',
          // Disabled state
          disabled && 'cursor-not-allowed',
          // Remove default padding - container handles spacing
          'p-0',
          // Ensure consistent font properties
          'font-[inherit]',
          className
        )}
        style={{
          // Blue cursor when recording, otherwise normal
          caretColor: isRecording
            ? '#3b82f6'
            : isFocused
              ? 'var(--foreground)'
              : 'transparent',
          // Perfect font matching for overlay alignment
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          // Set minimum and maximum heights
          minHeight,
          maxHeight,
          // Prevent horizontal scrolling
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
        aria-label="Smart task input with highlighting"
      />

      {/* Overlay div - shows visual highlighting */}
      <div
        ref={overlayRef}
        className={cn(
          // Position within textarea container
          'absolute inset-0 pointer-events-none',
          // Match textarea styling exactly
          'w-full',
          // Typography matching
          'text-foreground leading-relaxed',
          // Scrolling and overflow
          'overflow-hidden',
          // Ensure it's behind the textarea
          'z-0',
          // Typography - match textarea
          'text-base md:text-sm',
          // Remove padding - container handles spacing
          'p-0'
        )}
        style={{
          // Critical: Match textarea font properties exactly
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          // Match text rendering
          textRendering: 'optimizeLegibility',
          // Ensure exact alignment
          boxSizing: 'border-box',
          // Match textarea dimensions
          minHeight,
          maxHeight,
          // Prevent scrollbars on overlay
          overflowX: 'hidden',
          overflowY: 'hidden',
        }}
        aria-hidden="true"
      />

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

export default HighlightedTextareaField;
