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
 * SharedToggleButton - Reusable toggle button component with sliding indicator
 * Based on the ViewSwitcher pattern from ConsolidatedCalendarHeader
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
    if (!disabled) {
      onValueChange(value);
    }
  };

  // Update slider position when current value changes
  React.useEffect(() => {
    const updateSliderPosition = () => {
      const currentIndex = options.findIndex(option => option.value === currentValue);
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

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(updateSliderPosition, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentValue, options]);

  // Size-based styling
  const sizeClasses = {
    sm: {
      container: 'p-1',
      button: 'h-7 px-3 text-xs',
    },
    md: {
      container: 'p-1.5',
      button: 'h-8 px-4 text-sm',
    },
    lg: {
      container: 'p-2',
      button: 'h-9 px-5 text-base',
    },
  };

  const currentSizeClasses = sizeClasses[size];

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative inline-flex rounded-lg border bg-background shadow-xs',
        'hover:bg-accent hover:text-accent-foreground',
        'dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        'transition-all duration-200',
        disabled && 'opacity-50 cursor-not-allowed',
        currentSizeClasses.container,
        className
      )}
      role="group"
    >
      {/* Sliding background indicator */}
      <div 
        className="absolute bg-background rounded-md shadow-sm transition-[left,width] duration-200 ease-out"
        style={sliderStyle}
      />
      
      {options.map((option, index) => {
        const isActive = currentValue === option.value;
        const IconComponent = option.icon;
        
        return (
          <Button
            key={String(option.value)}
            ref={(el) => { buttonRefs.current[index] = el; }}
            variant="ghost"
            size={size === 'md' ? 'default' : size}
            onClick={() => handleValueClick(option.value)}
            disabled={disabled}
            className={cn(
              'relative z-10 font-medium transition-colors duration-200',
              currentSizeClasses.button,
              isActive 
                ? 'text-foreground hover:!bg-transparent hover:!text-foreground' 
                : 'text-muted-foreground hover:text-foreground',
              // Icon spacing when both icon and label are present
              IconComponent && showLabels && 'gap-1.5'
            )}
          >
            {/* Icon */}
            {IconComponent && (
              <IconComponent className={cn(
                size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
              )} />
            )}
            
            {/* Labels */}
            {showLabels && (
              <>
                {/* Full label on larger screens */}
                <span className={cn(
                  showShortLabelsOnMobile ? 'hidden sm:inline' : 'inline'
                )}>
                  {option.label}
                </span>
                
                {/* Short label on mobile if available */}
                {showShortLabelsOnMobile && option.shortLabel && (
                  <span className="sm:hidden">
                    {option.shortLabel}
                  </span>
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