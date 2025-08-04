"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  customColor?: string;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, customColor, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Base shadcn styles with proper checked state
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      !customColor && "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
      // Reset styles without overriding checked state
      "!p-0 !m-0 !border-box !box-border",
      "!min-w-4 !min-h-4 !max-w-4 !max-h-4 !w-4 !h-4",
      "!font-normal !text-base !leading-none",
      "!flex !items-center !justify-center",
      // Override any button/focus styles but preserve background for checked state
      "focus:!outline-none focus-visible:!outline-none",
      "hover:!border-primary",
      className
    )}
    style={customColor && props.checked ? {
      backgroundColor: customColor,
      borderColor: customColor,
      color: 'white'
    } : undefined}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current",
        "!w-full !h-full !p-0 !m-0"
      )}
    >
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
