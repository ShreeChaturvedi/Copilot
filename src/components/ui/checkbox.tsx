'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  customColor?: string;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, customColor, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Rest ring is the quiet hairline in BOTH themes (fixes #54: the old
      // border-primary read as a bright ring on the dark canvas). Checked
      // fills with the accent; aqua appears only on the focus outline.
      'peer h-4 w-4 shrink-0 rounded-sm border border-hairline-strong outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40',
      !customColor &&
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
      // Reset styles without overriding checked state
      '!p-0 !m-0 !border-box !box-border',
      '!min-w-4 !min-h-4 !max-w-4 !max-h-4 !w-4 !h-4',
      '!font-normal !text-base !leading-none',
      '!flex !items-center !justify-center',
      className
    )}
    style={
      customColor && props.checked
        ? {
            backgroundColor: customColor,
            borderColor: customColor,
            color: 'white',
          }
        : undefined
    }
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        'flex items-center justify-center text-current',
        '!w-full !h-full !p-0 !m-0'
      )}
    >
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
