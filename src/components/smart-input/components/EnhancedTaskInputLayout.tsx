import React from 'react';
import { EnhancedLayoutWrapper } from './EnhancedLayoutWrapper';
import { HighlightedTextareaField } from './HighlightedTextareaField';
import { ParsedTags } from './ParsedTags';
import { ParsedTag } from '@shared/types';
import { cn } from '@/lib/utils';

export interface EnhancedTaskInputLayoutProps {
  /** The value of the input field */
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
  onKeyPress?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Parsing confidence (0-1) */
  confidence?: number;
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  /** Whether smart parsing is enabled */
  enableSmartParsing?: boolean;
  /** Minimum height for the input area */
  minHeight?: string;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Left side controls (task group selector, file upload, voice, etc.) */
  leftControls?: React.ReactNode;
  /** Right side controls (submit button, etc.) */
  rightControls?: React.ReactNode;
  /** Whether recording is active */
  isRecording?: boolean;
  /** File previews to display above the input */
  filePreview?: React.ReactNode;
  /** Whether to show parsed tags inside the card, under the textarea */
  showInlineTags?: boolean;
  /** Whether inline tags are removable */
  inlineTagsRemovable?: boolean;
  /** Remove handler for inline tags */
  onInlineTagRemove?: (tagId: string) => void;
  /** Maximum number of inline tags to show (ignored for enhanced input; tags wrap) */
  maxInlineTags?: number;
  /** Optional secondary input below the main title input (visual-only description) */
  secondaryValue?: string;
  onSecondaryChange?: (value: string) => void;
  secondaryPlaceholder?: string;
  /** Key handler for secondary input */
  onSecondaryKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Optional ref to focus description programmatically */
  secondaryInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Whether the secondary input should be visible and interactive */
  secondaryEnabled?: boolean;
  /** Optional custom inline tag row content to always show under inputs */
  customTagRow?: React.ReactNode;
}

export const EnhancedTaskInputLayout: React.FC<
  EnhancedTaskInputLayoutProps
> = ({
  value,
  onChange,
  tags,
  placeholder = 'Enter a new task...',
  disabled = false,
  className,
  onKeyPress,
  onBlur,
  onFocus,
  confidence = 1,
  showConfidence = false,
  enableSmartParsing = true,
  minHeight = '60px',
  maxHeight = '150px',
  leftControls,
  rightControls,
  isRecording = false,
  filePreview,
  showInlineTags = false,
  inlineTagsRemovable = false,
  onInlineTagRemove,
  // maxInlineTags,
  secondaryValue,
  onSecondaryChange,
  secondaryPlaceholder,
  onSecondaryKeyDown,
  secondaryInputRef,
  secondaryEnabled = false,
  customTagRow,
}) => {
  const controls = (
    <>
      <div
        className={cn(
          'flex items-center gap-2',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        {leftControls}
      </div>
      <div
        className={cn(
          'flex items-center gap-2',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        {rightControls}
      </div>
    </>
  );

  return (
    <EnhancedLayoutWrapper
      controls={controls}
      className={className}
      minHeight={minHeight}
      disabled={disabled}
      showFocusStates={true}
    >
      <div className="space-y-2">
        {filePreview && (
          <div className="border-b border-border/50 pb-2">{filePreview}</div>
        )}
        <div className="relative">
          {enableSmartParsing ? (
            <HighlightedTextareaField
              id="enhanced-task-input-textarea"
              name="enhanced-task-input-textarea"
              value={value}
              onChange={onChange}
              tags={tags}
              placeholder={placeholder}
              disabled={disabled}
              onKeyPress={onKeyPress}
              onKeyDown={onKeyPress}
              onBlur={onBlur}
              onFocus={onFocus}
              confidence={confidence}
              showConfidence={showConfidence}
              minHeight={minHeight}
              maxHeight={maxHeight}
              isRecording={isRecording}
            />
          ) : (
            <textarea
              id="enhanced-task-input-textarea-fallback"
              name="enhanced-task-input-textarea-fallback"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={onKeyPress}
              onBlur={onBlur}
              onFocus={onFocus}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'w-full border-none outline-none bg-transparent resize-none',
                'text-base md:text-sm leading-relaxed',
                'placeholder:text-muted-foreground',
                'focus:outline-none',
                disabled && 'cursor-not-allowed',
                'p-0',
                'font-[inherit]'
              )}
              style={{
                minHeight,
                maxHeight,
                overflowX: 'hidden',
                overflowY: 'auto',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                letterSpacing: 'inherit',
                caretColor: isRecording ? '#3b82f6' : 'inherit',
              }}
              aria-label="Task input"
            />
          )}

          {/* Optional description input below the title field (visual-only) */}
          {typeof secondaryValue !== 'undefined' && onSecondaryChange && (
            <input
              ref={secondaryInputRef}
              type="text"
              id="enhanced-task-input-description"
              name="enhanced-task-input-description"
              value={secondaryValue}
              onChange={(e) => onSecondaryChange(e.target.value)}
              onKeyDown={onSecondaryKeyDown}
              placeholder={secondaryEnabled ? secondaryPlaceholder : ''}
              disabled={disabled}
              className={cn(
                // Base single-line input styling matching the title field's transparent look
                'mt-1 w-full bg-transparent border-none outline-none p-0',
                // Slightly smaller, secondary typography consistent with app standards
                'text-sm leading-5',
                // Placeholder + disabled treatments
                'placeholder:text-muted-foreground',
                // Reserve space from the beginning; hide and disable pointer events until enabled
                !secondaryEnabled &&
                  'opacity-0 pointer-events-none select-none',
                disabled && 'cursor-not-allowed'
              )}
              aria-hidden={!secondaryEnabled}
              tabIndex={secondaryEnabled ? 0 : -1}
              aria-label="Task description"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </div>

        {/* Tag row: always visible; due date + other tags on the same line */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {customTagRow}
          {showInlineTags && tags.length > 0 && (
            <ParsedTags
              tags={tags}
              removable={inlineTagsRemovable}
              onRemoveTag={onInlineTagRemove}
              className="mt-0"
            />
          )}
        </div>
      </div>
    </EnhancedLayoutWrapper>
  );
};
