/**
 * Inline Smart Input - ContentEditable with true inline highlighting
 * Replaces overlay-based highlighting with proper inline spans for accurate positioning
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ParsedTag } from "@shared/types";
import { cn } from '@/lib/utils';

export interface InlineHighlightedInputProps {
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
  /** Input ID for accessibility */
  id?: string;
  /** Input name for form compatibility */
  name?: string;
}


/**
 * ContentEditable input with inline highlighting
 */
export const InlineHighlightedInput: React.FC<InlineHighlightedInputProps> = ({
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
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);


  // Extract plain text from HTML content
  const extractPlainText = useCallback((element: HTMLElement): string => {
    return element.textContent || '';
  }, []);

  // PersistentSpanManager for surgical DOM updates
  const spanManagerRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const lastTagsRef = useRef<ParsedTag[]>([]);

  // Calculate differences between old and new tags
  const calculateTagDiff = useCallback((oldTags: ParsedTag[], newTags: ParsedTag[]) => {
    const oldTagMap = new Map(oldTags.map(tag => [tag.id, tag]));
    const newTagMap = new Map(newTags.map(tag => [tag.id, tag]));
    
    const toAdd = newTags.filter(tag => !oldTagMap.has(tag.id));
    const toRemove = oldTags.filter(tag => !newTagMap.has(tag.id));
    const toUpdate = newTags.filter(tag => {
      const oldTag = oldTagMap.get(tag.id);
      return oldTag && (
        oldTag.startIndex !== tag.startIndex ||
        oldTag.endIndex !== tag.endIndex ||
        oldTag.displayText !== tag.displayText ||
        oldTag.color !== tag.color
      );
    });

    return { toAdd, toRemove, toUpdate };
  }, []);

  // Create a span element for a tag
  const createSpanForTag = useCallback((tag: ParsedTag): HTMLSpanElement => {
    const span = document.createElement('span');
    span.className = `smart-highlight-inline tag-${tag.type}`;
    span.style.setProperty('--tag-color', tag.color || '#3b82f6');
    span.textContent = tag.displayText;
    span.setAttribute('data-tag-id', tag.id);
    return span;
  }, []);

  // Insert a span at the correct position in the DOM
  const insertSpanAtPosition = useCallback((span: HTMLSpanElement, tag: ParsedTag) => {
    if (!contentEditableRef.current) return;

    const element = contentEditableRef.current;
    
    // Find the text node that contains the tag
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentPos = 0;
    let node = walker.nextNode();
    
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      
      if (currentPos <= tag.startIndex && currentPos + nodeLength > tag.startIndex) {
        // This text node contains the start of our tag
        const relativeStart = tag.startIndex - currentPos;
        const relativeEnd = Math.min(tag.endIndex - currentPos, nodeLength);
        
        // Split the text node to insert our span
        const textNode = node as Text;
        const beforeText = textNode.textContent?.substring(0, relativeStart) || '';
        const tagText = textNode.textContent?.substring(relativeStart, relativeEnd) || '';
        const afterText = textNode.textContent?.substring(relativeEnd) || '';
        
        // Create new text nodes
        if (beforeText) {
          const beforeNode = document.createTextNode(beforeText);
          textNode.parentNode?.insertBefore(beforeNode, textNode);
        }
        
        // Insert the span
        span.textContent = tagText;
        textNode.parentNode?.insertBefore(span, textNode);
        
        if (afterText) {
          const afterNode = document.createTextNode(afterText);
          textNode.parentNode?.insertBefore(afterNode, textNode);
        }
        
        // Remove the original text node
        textNode.remove();
        break;
      }
      
      currentPos += nodeLength;
      node = walker.nextNode();
    }
  }, []);

  // Update spans based on tag changes
  const updateSpans = useCallback((newTags: ParsedTag[]) => {
    if (!contentEditableRef.current) return;

    const spanManager = spanManagerRef.current;
    const lastTags = lastTagsRef.current;
    const diff = calculateTagDiff(lastTags, newTags);

    // Remove old spans
    diff.toRemove.forEach(tag => {
      const span = spanManager.get(tag.id);
      if (span && span.parentNode) {
        // Replace span with its text content
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode.insertBefore(textNode, span);
        span.remove();
        spanManager.delete(tag.id);
      }
    });

    // Add new spans
    diff.toAdd.forEach(tag => {
      const span = createSpanForTag(tag);
      insertSpanAtPosition(span, tag);
      spanManager.set(tag.id, span);
    });

    // Update existing spans
    diff.toUpdate.forEach(tag => {
      const span = spanManager.get(tag.id);
      if (span) {
        span.textContent = tag.displayText;
        span.style.setProperty('--tag-color', tag.color || '#3b82f6');
        span.className = `smart-highlight-inline tag-${tag.type}`;
      }
    });

    // Update reference
    lastTagsRef.current = [...newTags];
  }, [calculateTagDiff, createSpanForTag, insertSpanAtPosition]);

  // Handle contentEditable input changes
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    let plainText = extractPlainText(element);
    
    // Clean up zero-width space placeholder if it exists
    if (plainText.includes('\u200B')) {
      plainText = plainText.replace(/\u200B/g, '');
      // Remove the zero-width space from the DOM as well
      const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
      textNodes.forEach(node => {
        if (node.textContent && node.textContent.includes('\u200B')) {
          node.textContent = node.textContent.replace(/\u200B/g, '');
          if (node.textContent === '') {
            node.remove();
          }
        }
      });
    }
    
    // No need to save selection with persistent spans - cursor position is naturally preserved
    
    // Update hidden input and trigger onChange
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = plainText;
    }
    onChange(plainText);
  }, [extractPlainText, onChange]);

  // Handle key down events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle key events first
    onKeyPress?.(e);
    
    // Prevent Enter key for single-line input (after handling key press)
    if (e.key === 'Enter') {
      e.preventDefault();
      return;
    }
  }, [onKeyPress]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    
    // Fix cursor positioning when contentEditable is empty
    if (!contentEditableRef.current) return;
    
    const element = contentEditableRef.current;
    const selection = window.getSelection();
    
    // If element is empty, create a temporary text node to position cursor correctly
    if (!element.textContent || element.textContent.trim() === '') {
      // Create a zero-width space as a placeholder for cursor positioning
      const textNode = document.createTextNode('\u200B'); // Zero-width space
      element.appendChild(textNode);
      
      // Position cursor at the beginning of this text node
      if (selection) {
        try {
          const range = document.createRange();
          range.setStart(textNode, 0);
          range.setEnd(textNode, 0);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (error) {
          console.debug('Cursor positioning failed:', error);
        }
      }
    }
  }, [onFocus]);

  // Handle blur events
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Update spans when tags change (not on every text change)
  useEffect(() => {
    if (!contentEditableRef.current) return;

    // Only update spans when tags actually change
    updateSpans(tags);
  }, [tags, updateSpans]);

  // Sync contentEditable with value when it changes externally
  useEffect(() => {
    if (!contentEditableRef.current) return;

    const element = contentEditableRef.current;
    const currentText = extractPlainText(element);
    
    // Only update if the text content differs (avoid infinite loops)
    if (currentText !== value) {
      // Clear existing content and spans
      element.innerHTML = '';
      spanManagerRef.current.clear();
      lastTagsRef.current = [];
      
      // Set plain text content
      if (value) {
        element.textContent = value;
        // Spans will be added by the tags effect
      }
    }
  }, [value, extractPlainText]);

  // Sync hidden input value
  useEffect(() => {
    if (hiddenInputRef.current && hiddenInputRef.current.value !== value) {
      hiddenInputRef.current.value = value;
    }
  }, [value]);

  return (
    <div className="relative">
      {/* Hidden input for form compatibility and React controlled behavior */}
      <input
        ref={hiddenInputRef}
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={() => {}} // Controlled by contentEditable
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* ContentEditable input with inline highlighting - using container approach */}
      <div
        className={cn(
          // Base input styling to match shadcn Input component exactly
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          // Container styling - handles padding and layout
          'relative overflow-hidden',
          // Focus styles
          isFocused && 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          // Disabled styles
          disabled && 'cursor-not-allowed opacity-50',
          // Apply the padding classes that were passed from parent
          className
        )}
      >
        <div
          ref={contentEditableRef}
          contentEditable={!disabled}
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            // ContentEditable-specific styles
            'inline-highlighted-input cursor-text whitespace-nowrap overflow-x-auto',
            // Inner content area - fills parent but respects its padding
            'h-full w-full py-0 flex items-center',
            // NO padding here - let parent container handle all spacing
            // Disabled styles
            disabled && 'cursor-not-allowed opacity-50'
          )}
          data-placeholder={!value ? placeholder : undefined}
          id="inline-highlighted-input"
          role="textbox"
          aria-label="Smart task input with highlighting"
          aria-multiline="false"
          spellCheck="false"
        />
      </div>

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

