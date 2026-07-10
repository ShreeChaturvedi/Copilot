import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  // Disabled primaries stay 40% aqua, never gray (design-brief §4.5); focus is
  // the system outline ring (2px aqua, offset 1) on every focusable surface.
  // Resting buttons are FLAT (§1.4): no ambient shadow. Radius is the role
  // token --radius-btn (8px), not Tailwind's generic 6px. Non-ghost/link
  // variants get an active:scale-[0.97] press beat (§6 Button checklist).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn text-sm font-medium transition-[background-color,color,transform] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Hover always moves toward higher contrast with its background (§2.3)
        default:
          'bg-primary text-primary-foreground hover:bg-aqua-hover active:scale-[0.97]',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-destructive dark:bg-destructive/60 active:scale-[0.97]',
        outline:
          'border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 active:scale-[0.97]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.97]',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-btn gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-btn px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
