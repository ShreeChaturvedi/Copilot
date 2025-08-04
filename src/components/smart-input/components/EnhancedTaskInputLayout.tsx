import React from 'react';
import { EnhancedLayoutWrapper } from './EnhancedLayoutWrapper';
import { HighlightedTextareaField } from './HighlightedTextareaField';
import { ParsedTag } from '@/types';
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
  onKeyPress?: (e: React.KeyboardEvent) => void;
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
}

export const EnhancedTaskInputLayout: React.FC<EnhancedTaskInputLayoutProps> = ({
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
}) => {
  const controls = (
    <>
      <div className={cn('flex items-center gap-2', disabled && 'pointer-events-none opacity-50')}>
        {leftControls}
      </div>
      <div className={cn('flex items-center gap-2', disabled && 'pointer-events-none opacity-50')}>
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
          <div className="border-b border-border/50 pb-2">
            {filePreview}
          </div>
        )}
        <div className="relative">
        {enableSmartParsing ? (
          <HighlightedTextareaField
            value={value}
            onChange={onChange}
            tags={tags}
            placeholder={placeholder}
            disabled={disabled}
            onKeyPress={onKeyPress}
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
              'font-[inherit]',
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
        </div>
      </div>
    </EnhancedLayoutWrapper>
  );
};