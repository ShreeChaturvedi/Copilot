/**
 * SmartParsingToggle - Toggle component for smart parsing functionality
 *
 * Replaces the three-dot dropdown menu with a proper shadcn Toggle component.
 * Shows Brain/Zap icon and "Autotag" label when pressed (on state).
 * On state uses the aqua film + rim tokens (design-brief 2.3).
 */

import React from 'react';
import { Tag } from 'lucide-react';
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
 * - Uses Tag icon from Lucide
 * - Shows "Autotag" label when toggle is pressed (on state)
 * - Aqua film + rim on-state, hover raises the rim to full aqua
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
        // Base styling - same as file upload button
        'h-8 px-2 text-muted-foreground hover:text-foreground',
        // Always have a border to prevent layout shift
        'border',
        // Ghost button hover background (same as file upload button)
        'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        // Off state - transparent background and border
        'data-[state=off]:bg-transparent data-[state=off]:border-transparent',
        // On state - aqua film + rim (retired today-green is gone; aqua
        // means live, design-brief 2.3)
        'data-[state=on]:bg-aqua-film-08 data-[state=on]:text-foreground',
        'data-[state=on]:border-aqua-rim',
        'hover:data-[state=on]:border-aqua',
        className
      )}
      aria-label={pressed ? 'Disable smart parsing' : 'Enable smart parsing'}
    >
      <Tag className="w-4 h-4" />
      {pressed && <span className="text-xs font-medium ml-1">Autotag</span>}
    </Toggle>
  );
};

export default SmartParsingToggle;
