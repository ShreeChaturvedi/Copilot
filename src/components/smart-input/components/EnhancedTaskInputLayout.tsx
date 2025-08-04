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
  /** Interim voice transcript for real-time feedback */
  voiceTranscript?: string;
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
  voiceTranscript = '',
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
            }}
            aria-label="Task input"
          />
        )}
        
        {/* Voice transcript overlay for interim results */}
        {voiceTranscript && (
          <div className="absolute bottom-2 right-2 z-20">
            <div className="bg-primary/10 border border-primary/20 rounded-md px-2 py-1 text-xs text-primary animate-pulse">
              <span className="opacity-70">🎤</span> {voiceTranscript}
            </div>
          </div>
        )}
      </div>
    </EnhancedLayoutWrapper>
  );
};

export default EnhancedTaskInputLayout;