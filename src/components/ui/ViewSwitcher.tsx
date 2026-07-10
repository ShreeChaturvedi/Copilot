/**
 * ViewSwitcher Component
 * A reusable segmented control with sliding background indicator
 * Matches the app's visual design language (used in CalendarHeader, Analytics, etc.)
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface ViewSwitcherOption<T extends string = string> {
  value: T;
  label: string;
  shortLabel?: string;
  disabled?: boolean;
  /** Single-key shortcut shown as a keycap tooltip (e.g. 'W') */
  shortcut?: string;
}

export interface ViewSwitcherProps<T extends string = string> {
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Available options */
  options: ViewSwitcherOption<T>[];
  /** Additional className for the container */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * ViewSwitcher - A segmented control with an animated sliding indicator,
 * built on the SETTLE tokens (surface well, surface-1 pill, hairline).
 * Keyboard-initiated view changes suppress the slide via [data-kbd-nav]
 * (design-brief §5: never animate keyboard-initiated actions).
 */
export function ViewSwitcher<T extends string = string>({
  value,
  onChange,
  options,
  className,
  size = 'sm',
}: ViewSwitcherProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  // Update slider position when value changes
  useEffect(() => {
    const updateSliderPosition = () => {
      const currentIndex = options.findIndex(
        (option) => option.value === value
      );
      const currentButton = buttonRefs.current[currentIndex];
      const container = containerRef.current;

      if (currentButton && container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = currentButton.getBoundingClientRect();

        setSliderStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
          height: buttonRect.height,
          top: '50%',
          transform: 'translateY(-50%)',
        });
      }
    };

    const timeoutId = setTimeout(updateSliderPosition, 0);

    // Also update on window resize
    window.addEventListener('resize', updateSliderPosition);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSliderPosition);
    };
  }, [value, options]);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex rounded-lg border border-hairline bg-surface-2',
        'p-0.5',
        className
      )}
      role="group"
      aria-label="View selection"
    >
      {/* Sliding background indicator */}
      <div
        className={cn(
          'view-switcher-slider absolute rounded-md bg-surface-1 [box-shadow:var(--shadow-control)]',
          'transition-[left,width] duration-[var(--dur-3)] ease-settle',
          '[[data-kbd-nav]_&]:transition-none'
        )}
        style={sliderStyle}
        aria-hidden="true"
      />

      {options.map(
        ({ value: optValue, label, shortLabel, disabled, shortcut }, index) => {
          const button = (
            <button
              key={optValue}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => !disabled && onChange(optValue)}
              disabled={disabled}
              className={cn(
                'relative z-10 rounded-md text-xs font-medium transition-colors duration-150',
                sizeClasses[size],
                value === optValue
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'cursor-pointer'
              )}
              aria-pressed={value === optValue}
              aria-label={label}
            >
              {shortLabel ? (
                <>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{shortLabel}</span>
                </>
              ) : (
                label
              )}
            </button>
          );
          if (!shortcut) return button;
          return (
            <Tooltip key={optValue}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent className="flex items-center gap-1.5">
                {label}
                <kbd
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-surface-2 px-1 font-mono text-[11px] leading-none text-muted-foreground"
                  style={{ boxShadow: 'var(--edge-machined)' }}
                >
                  {shortcut}
                </kbd>
              </TooltipContent>
            </Tooltip>
          );
        }
      )}
    </div>
  );
}

export default ViewSwitcher;
