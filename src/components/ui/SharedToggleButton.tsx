import React from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ToggleOption<T = string> {
  value: T;
  label: string;
  shortLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SharedToggleButtonProps<T = string> {
  currentValue: T;
  options: ToggleOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  showShortLabelsOnMobile?: boolean;
}

/**
 * Segmented control with sliding indicator (ViewSwitcher pattern).
 * Default visual is dense charcoal — hairline track, quiet slider, no accent wash.
 */
export const SharedToggleButton = <T extends string | number = string>({
  currentValue,
  options,
  onValueChange,
  className,
  disabled = false,
  size = 'sm',
  showLabels = true,
  showShortLabelsOnMobile = true,
}: SharedToggleButtonProps<T>) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = React.useState<React.CSSProperties>({});

  const handleValueClick = (value: T) => {
    if (!disabled) onValueChange(value);
  };

  React.useEffect(() => {
    const updateSliderPosition = () => {
      const currentIndex = options.findIndex(
        (option) => option.value === currentValue
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
    return () => clearTimeout(timeoutId);
  }, [currentValue, options]);

  // Dense by default. md/lg only for rare large contexts.
  const sizeClasses = {
    sm: {
      container: 'p-0.5 gap-0',
      button: 'h-6 min-w-0 px-2 text-[11px] leading-none tracking-[-0.01em]',
      icon: 'size-3',
      gap: 'gap-1',
      radius: 'rounded-[7px]',
      slider: 'rounded-[5px]',
    },
    md: {
      container: 'p-0.5',
      button: 'h-7 px-2.5 text-xs leading-none',
      icon: 'size-3.5',
      gap: 'gap-1',
      radius: 'rounded-btn',
      slider: 'rounded-[6px]',
    },
    lg: {
      container: 'p-1',
      button: 'h-8 px-3 text-[13px]',
      icon: 'size-4',
      gap: 'gap-1.5',
      radius: 'rounded-btn',
      slider: 'rounded-md',
    },
  };

  const s = sizeClasses[size];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex items-center border border-hairline bg-surface-2',
        'shadow-none transition-colors duration-150 ease-out',
        s.radius,
        s.container,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      role="group"
    >
      <div
        className={cn(
          'absolute bg-surface-1 border border-hairline-strong/40 shadow-1',
          'transition-[left,width] duration-[var(--dur-3)] ease-settle',
          s.slider
        )}
        style={sliderStyle}
        aria-hidden
      />

      {options.map((option, index) => {
        const isActive = currentValue === option.value;
        const IconComponent = option.icon;

        return (
          <Button
            key={String(option.value)}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            variant="ghost"
            size="sm"
            onClick={() => handleValueClick(option.value)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={!showLabels ? option.label : undefined}
            className={cn(
              'relative z-10 shrink-0 font-medium rounded-none',
              'hover:!bg-transparent active:!bg-transparent',
              'focus-visible:ring-0 focus-visible:outline-none',
              s.button,
              IconComponent && showLabels && s.gap,
              isActive
                ? 'text-foreground'
                : 'text-ink-muted hover:text-foreground'
            )}
          >
            {IconComponent && (
              <IconComponent className={cn(s.icon, 'shrink-0 opacity-80')} />
            )}

            {showLabels && (
              <>
                <span
                  className={cn(
                    showShortLabelsOnMobile && option.shortLabel
                      ? 'hidden sm:inline'
                      : 'inline'
                  )}
                >
                  {option.label}
                </span>
                {showShortLabelsOnMobile && option.shortLabel && (
                  <span className="sm:hidden">{option.shortLabel}</span>
                )}
              </>
            )}
          </Button>
        );
      })}
    </div>
  );
};

export default SharedToggleButton;
