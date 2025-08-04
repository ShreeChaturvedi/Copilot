/**
 * SmartParsingToggle - Toggle component for smart parsing functionality
 * 
 * Replaces the three-dot dropdown menu with a proper shadcn Toggle component.
 * Shows Brain/Zap icon and "Autotag" label when pressed (on state).
 * Uses calendar's today background green color system for theme consistency.
 */

import React from 'react';
import { Brain } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export interface SmartParsingToggleProps {
  /** Whether smart parsing is enabled */
  pressed: boolean;
  /** Handler for toggle state changes */
  onPressedChange: (pressed: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Smart parsing toggle component using shadcn Toggle
 * 
 * Features:
 * - Uses Brain icon from Lucide
 * - Shows "Autotag" label when toggle is pressed (on state)
 * - Calendar green color system with subtle border and transparency
 * - Theme responsive (light/dark mode support)
 * - Connects to existing enableSmartParsing prop
 */
export const SmartParsingToggle: React.FC<SmartParsingToggleProps> = ({
  pressed,
  onPressedChange,
  disabled = false,
  className,
}) => {
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      size="sm"
      className={cn(
        // Base styling
        'h-8 px-2 text-muted-foreground hover:text-foreground',
        // Off state - default shadcn styling
        'data-[state=off]:bg-transparent data-[state=off]:border-transparent',
        // On state - calendar green with subtle border and transparency
        'data-[state=on]:bg-[oklch(0.7_0.15_140_/_0.15)] data-[state=on]:text-foreground',
        'data-[state=on]:border data-[state=on]:border-[oklch(0.7_0.15_140)]',
        // Dark mode adjustments
        'dark:data-[state=on]:bg-[oklch(0.7_0.15_140_/_0.1)]',
        'dark:data-[state=on]:border-[oklch(0.7_0.15_140)]',
        // Hover states
        'hover:data-[state=on]:bg-[oklch(0.7_0.15_140_/_0.2)]',
        'dark:hover:data-[state=on]:bg-[oklch(0.7_0.15_140_/_0.15)]',
        className
      )}
      aria-label={pressed ? 'Disable smart parsing' : 'Enable smart parsing'}
    >
      <Brain className="w-4 h-4" />
      {pressed && (
        <span className="text-xs font-medium ml-1">Autotag</span>
      )}
    </Toggle>
  );
};

export default SmartParsingToggle;