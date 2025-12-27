/**
 * ViewSwitcher Component
 * A reusable segmented control with sliding background indicator
 * Matches the app's visual design language (used in CalendarHeader, Analytics, etc.)
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ViewSwitcherOption<T extends string = string> {
  value: T;
  label: string;
  shortLabel?: string;
  disabled?: boolean;
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
 * ViewSwitcher - A premium segmented control with animated sliding indicator
 *
 * Features:
 * - Smooth sliding background animation
 * - Dark mode support with subtle transparency
 * - Responsive short labels for mobile
 * - Disabled state support
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
        'relative inline-flex rounded-lg border bg-background shadow-xs',
        'hover:bg-accent/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        'p-0.5 transition-all duration-200',
        className
      )}
      role="group"
      aria-label="View selection"
    >
      {/* Sliding background indicator */}
      <div
        className="absolute bg-background dark:bg-background rounded-md shadow-sm transition-all duration-200 ease-out"
        style={sliderStyle}
        aria-hidden="true"
      />

      {options.map(
        ({ value: optValue, label, shortLabel, disabled }, index) => (
          <button
            key={optValue}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => !disabled && onChange(optValue)}
            disabled={disabled}
            className={cn(
              'relative z-10 font-medium rounded-md transition-colors duration-150',
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
        )
      )}
    </div>
  );
}

export default ViewSwitcher;
