/**
 * EnhancedLayoutWrapper - Transforms FlexInputGroup layout into Claude AI pattern
 *
 * This component wraps the existing SmartTaskInput functionality and transforms
 * the horizontal FlexInputGroup layout into a vertical Claude AI-inspired layout:
 * - Large textarea at the top
 * - All controls positioned below the input
 * - Real floating-tier material with a permanent focus-within ring
 * - Multi-line textarea support with highlighting
 *
 * Compose is a `position: absolute` panel floating over page content
 * (TaskFocusPane) -- it *is* a floating surface by function, so it gets the
 * same material as dialog/sheet/command-palette (`--shadow-dialog` +
 * `--edge-machined` via the token, `rounded-dialog`), not the generic `Card`
 * primitive's resting-tier `shadow-sm`, which read as a barely-there
 * rectangle in light mode (surface-1 and background are both near-white).
 */

import React from 'react';
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
}

/**
 * Enhanced layout wrapper that implements the Claude AI pattern
 *
 * Structure:
 * <div className="enhanced-input-card">
 *   <div className="input-area">
 *     {children} // HighlightedInputField or textarea
 *   </div>
 *   <div className="controls-area">
 *     {controls} // All buttons and selectors
 *   </div>
 * </div>
 */
export const EnhancedLayoutWrapper: React.FC<EnhancedLayoutWrapperProps> = ({
  children,
  controls,
  className,
  minHeight,
  disabled = false,
}) => {
  return (
    <div
      data-slot="card"
      className={cn(
        'relative overflow-hidden w-full',
        // Floating tier (§1.4): surface-3 + machined edge + shadow-3, the
        // same material dialog/sheet/command-palette use, via the named
        // --shadow-dialog composite token.
        'bg-surface-3 border border-hairline rounded-dialog',
        '[box-shadow:var(--shadow-dialog)]',
        // Focus state: a real, permanent ring on top of the floating shadow
        // -- never suppressed. This is the primary "start typing" surface of
        // the task-focus view; it must always have a focus affordance.
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        'transition-[border-color,box-shadow] duration-150 ease-out',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Input Area - Top section with textarea */}
      <div
        className={cn(
          // Container for the input with reduced bottom padding
          'relative p-4 pb-0'
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
          // Visual separator between input and controls (hairline, not a
          // third ad hoc opacity cut of --border)
          'border-t border-hairline',
          // Disabled state
          disabled && 'pointer-events-none'
        )}
      >
        {controls}
      </div>
    </div>
  );
};

export default EnhancedLayoutWrapper;
