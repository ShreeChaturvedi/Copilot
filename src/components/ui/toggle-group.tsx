import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { cn } from "@/lib/utils"

export function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("inline-flex", className)}
      {...props}
    />
  )
}

export function ToggleGroupItem({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  size?: "sm" | "default" | "lg"
}) {
  const sizeClasses =
    size === "sm"
      ? "h-8 min-w-8 px-1.5 text-xs"
      : size === "lg"
      ? "h-10 min-w-10 px-2.5 text-sm"
      : "h-9 min-w-9 px-2 text-sm"

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        // Base/default shadcn-like styles
        "inline-flex select-none items-center justify-center whitespace-nowrap border border-muted bg-transparent font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        // Hover (keep default)
        "hover:bg-muted hover:text-muted-foreground",
        // Selected state: opposite background using theme tokens (light: black bg/white text, dark: white bg/black text)
        "data-[state=on]:bg-foreground data-[state=on]:text-background",
        // Icon sizing fallback
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        // Segment join + borders
        "first:rounded-l-md last:rounded-r-md -ml-px first:ml-0",
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}
