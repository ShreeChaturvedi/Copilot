/**
 * CircularCheckbox - Custom circular checkbox to match screenshot exactly
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CircularCheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const CircularCheckbox: React.FC<CircularCheckboxProps> = ({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}) => {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'relative w-5 h-5 border-2 transition-all duration-200 flex items-center justify-center',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'rounded-full', // ACTUALLY MAKE IT CIRCULAR
        checked
          ? 'bg-primary border-primary'
          : 'border-border hover:border-primary bg-background',
        className
      )}
    >
      {checked && (
        <Check 
          className={cn(
            'w-3 h-3 text-primary-foreground',
            'animate-in zoom-in-50 duration-200'
          )} 
          strokeWidth={2.5}
        />
      )}
    </button>
  );
};

export default CircularCheckbox; 