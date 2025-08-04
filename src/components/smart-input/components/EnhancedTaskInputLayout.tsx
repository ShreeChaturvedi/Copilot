/**
 * EnhancedTaskInputLayout - Integrates EnhancedLayoutWrapper with SmartTaskInput
 * 
 * This component takes the existing SmartTaskInput props and renders them
 * using the enhanced Claude AI layout pattern. It transforms the horizontal
 * FlexInputGroup layout into a vertical card-based layout with textarea.
 */

import React from 'react';
import { EnhancedLayoutWrapper } from './EnhancedLayoutWrapper';
import { HighlightedTextareaField } from './HighlightedTextareaField';
import { ParsedTag } from '@/types';
import { cn } from '@/lib/utils';

export interface EnhancedTaskInputLayoutProps {
  /** Display value (input + interim transcript) */
  value: string;
  /** Actual input value (without interim transcript) */
  inputValue: string;
  /** Interim transcript for styling */
  interimTranscript?: string;
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

/**
 * Enhanced task input layout using Claude AI pattern
 * 
 * Structure:
 * <EnhancedLayoutWrapper>
 *   <HighlightedTextareaField /> // Multi-line input with highlighting
 *   <controls>
 *     <leftControls /> // Task selector, file upload, voice, toggle
 *     <rightControls /> // Submit button
 *   </controls>
 * </EnhancedLayoutWrapper>
 */
export const EnhancedTaskInputLayout: React.FC<EnhancedTaskInputLayoutProps> = ({
  value,
  inputValue,
  interimTranscript = '',
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
  minHeight = '60px', // Reduced to ~2-3 lines
  maxHeight = '150px', // Reduced max height as well
  leftControls,
  rightControls,
  isRecording = false,
  filePreview,
}) => {
  // Controls layout - left and right groups
  const controls = (
    <>
      {/* Left side controls */}
      <div className={cn(
        'flex items-center gap-2',
        disabled && 'pointer-events-none opacity-50'
      )}>
        {leftControls}
      </div>

      {/* Right side controls */}
      <div className={cn(
        'flex items-center gap-2',
        disabled && 'pointer-events-none opacity-50'
      )}>
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
        {/* File Preview Area */}
        {filePreview && (
          <div className="border-b border-border/50 pb-2">
            {filePreview}
          </div>
        )}
        
        {/* Input Area */}
        <div className="relative">
        {enableSmartParsing ? (
          <HighlightedTextareaField
            value={inputValue}
            displayValue={value}
            interimTranscript={interimTranscript}
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
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              // Base textarea styles - natural sizing instead of h-full
              'w-full border-none outline-none bg-transparent resize-none',
              // Typography - EXACT match with HighlightedTextareaField
              'text-base md:text-sm leading-relaxed',
              // Placeholder styling
              'placeholder:text-muted-foreground',
              // Focus styles handled by parent EnhancedLayoutWrapper
              'focus:outline-none',
              // Disabled state
              disabled && 'cursor-not-allowed',
              // Remove default padding - container handles spacing
              'p-0',
              // Ensure consistent font properties
              'font-[inherit]',
            )}
            style={{
              // Set minimum and maximum heights
              minHeight,
              maxHeight,
              // Prevent horizontal scrolling
              overflowX: 'hidden',
              overflowY: 'auto',
              // Ensure exact font matching
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit',
              // Blue blinking cursor when recording
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

export default EnhancedTaskInputLayout;