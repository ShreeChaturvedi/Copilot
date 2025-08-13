/**
 * FlexInputGroup - Proper flexbox input group implementation
 * 
 * Based on React Bootstrap Input Groups and industry best practices.
 * Uses flexbox layout instead of absolute positioning for proper inline layout.
 * 
 * Research sources:
 * - React Bootstrap Input Groups: https://react-bootstrap.github.io/docs/forms/input-group/
 * - Ant Design Input: https://github.com/ant-design/ant-design
 * - Stack Overflow flexbox input solutions
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface FlexInputGroupProps {
  /** Element to display before the input (e.g., dropdown, icon) */
  prefix?: React.ReactNode;
  /** Element to display after the input (e.g., button, icon) */
  suffix?: React.ReactNode;
  /** The main input component */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether the input group is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Hide focus outline/ring on focus-within */
  hideFocusOutline?: boolean;
}

/**
 * FlexInputGroup component implementing proper input group pattern
 * 
 * Structure:
 * <div className="input-group flex">
 *   <div className="prefix-container">
 *     {prefix}
 *   </div>
 *   <div className="input-container flex-1 relative">
 *     {children}
 *   </div>
 *   <div className="suffix-container">
 *     {suffix}
 *   </div>
 * </div>
 */
export const FlexInputGroup: React.FC<FlexInputGroupProps> = ({
  prefix,
  suffix,
  children,
  className,
  disabled = false,
  size = 'default',
  hideFocusOutline = false,
}) => {
  const sizeClasses = {
    sm: 'h-8',
    default: 'h-9',
    lg: 'h-10',
  };

  return (
    <div
      className={cn(
        // Base input group styles - flexbox container with uniform padding
        'flex items-stretch w-full p-2',
        // Border and radius - single border around entire group
        'border border-input rounded-md overflow-hidden',
        // Background and transitions
        'bg-background transition-[border-color,ring]',
        // Focus state - highlights entire group when any child is focused
        !hideFocusOutline && 'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        // Size variants
        sizeClasses[size],
        className
      )}
    >
      {/* Prefix container - appears before input */}
      {prefix && (
        <div className={cn(
          // Flex item that doesn't grow/shrink
          'flex items-center shrink-0',
          // Seamless styling - same background as input, no border, no padding
          'bg-transparent',
          // Ensure proper alignment
          'text-muted-foreground',
          // Disabled state
          disabled && 'pointer-events-none'
        )}>
          {prefix}
        </div>
      )}

      {/* Input container - main content area */}
      <div className={cn(
        // Flex item that grows to fill space
        'flex-1 relative',
        // Allow shrinking for mobile responsiveness
        'min-w-0',
        // Center children vertically and use MARGINS for button spacing (not padding!)
        'flex items-center mx-2'
      )}>
        {children}
      </div>

      {/* Suffix container - appears after input */}
      {suffix && (
        <div className={cn(
          // Flex item that doesn't grow/shrink
          'flex items-center shrink-0',
          // Seamless styling - same background as input, no border, no padding
          'bg-transparent',
          // Ensure proper alignment
          'text-muted-foreground',
          // Disabled state
          disabled && 'pointer-events-none'
        )}>
          {suffix}
        </div>
      )}
    </div>
  );
};

export default FlexInputGroup;