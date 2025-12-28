/**
 * EnhancedLayoutWrapper - Transforms FlexInputGroup layout into Claude AI pattern
 *
 * This component wraps the existing SmartTaskInput functionality and transforms
 * the horizontal FlexInputGroup layout into a vertical Claude AI-inspired layout:
 * - Large textarea at the top
 * - All controls positioned below the input
 * - Card container with proper focus states
 * - Multi-line textarea support with highlighting
 */

import React, { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface EnhancedLayoutWrapperProps {
  /** The main input component (HighlightedInputField or textarea) */
  children: React.ReactNode;
  /** Controls to display below the input (prefix and suffix from FlexInputGroup) */
  controls: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Minimum height for the input area */
  minHeight?: string;
  /** Whether the wrapper is disabled */
  disabled?: boolean;
  /** Whether to show focus states */
  showFocusStates?: boolean;
}

/**
 * Enhanced layout wrapper that implements the Claude AI pattern
 *
 * Structure:
 * <Card className="enhanced-input-card">
 *   <div className="input-area">
 *     {children} // HighlightedInputField or textarea
 *   </div>
 *   <div className="controls-area">
 *     {controls} // All buttons and selectors
 *   </div>
 * </Card>
 */
export const EnhancedLayoutWrapper: React.FC<EnhancedLayoutWrapperProps> = ({
  children,
  controls,
  className,
  minHeight,
  disabled = false,
  showFocusStates = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle focus events from child input
  const handleFocusIn = useCallback((e: React.FocusEvent) => {
    // Only set focus if the focus is coming from within the input area
    if (wrapperRef.current?.contains(e.target as Node)) {
      setIsFocused(true);
    }
  }, []);

  const handleFocusOut = useCallback((e: React.FocusEvent) => {
    // Only remove focus if focus is leaving the entire wrapper
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  }, []);

  return (
    <Card
      ref={wrapperRef}
      onFocusCapture={handleFocusIn}
      onBlurCapture={handleFocusOut}
      className={cn(
        // Base card styling with enhanced input specific adjustments
        'relative overflow-hidden transition-all duration-200',
        // Remove default card padding to control it precisely
        'p-0',
        // Constrain width for better proportions
        'w-full',
        // Focus states - highlight entire card when input is focused
        // Remove outline/ring when the inner input is focused
        showFocusStates && isFocused && ['outline-none ring-0'],
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Input Area - Top section with textarea */}
      <div
        className={cn(
          // Container for the input with reduced bottom padding
          'relative p-4 pb-0',
          // Explicit background to match controls area
          'bg-card'
        )}
        style={
          minHeight
            ? ({ '--min-height': minHeight, minHeight } as React.CSSProperties)
            : undefined
        }
      >
        {/* Input wrapper - provides the container for HighlightedInputField */}
        <div className="relative">{children}</div>
      </div>

      {/* Controls Area - Bottom section with all buttons and selectors */}
      <div
        className={cn(
          // Horizontal layout for controls
          'flex items-center justify-between',
          // Reduced padding for tighter gap
          'px-4 pt-2 pb-3',
          // Unified background - match input area exactly using bg-card
          'bg-card',
          // Visual separator between input and controls
          'border-t border-border/50',
          // Disabled state
          disabled && 'pointer-events-none'
        )}
      >
        {controls}
      </div>
    </Card>
  );
};

export default EnhancedLayoutWrapper;
