import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "./button-variants"

import { cn } from "@/lib/utils"

// buttonVariants moved to a separate file to satisfy react-refresh rule

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// Export in a single statement to satisfy react-refresh rule while exposing variants
export { Button }
