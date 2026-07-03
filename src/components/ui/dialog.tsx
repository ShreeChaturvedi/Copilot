import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { cn } from '@/lib/utils';

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-50', className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeButtonClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeButtonClassName?: string;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // SETTLE material (design-brief §4.5): surface-3, radius 12, machined
          // edge, 20px padding. Motion lives in index.css on the data-slot.
          'bg-surface-3 fixed z-50 grid w-full gap-4 p-5 rounded-dialog [box-shadow:var(--shadow-dialog)]',
          'top-[50%] left-[50%] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] sm:max-w-lg overflow-hidden',
          // Below 640px every dialog is a bottom sheet (#46): pinned to the
          // bottom edge, radius 16 16 0 0, max-h 92vh, scrollable.
          'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0',
          'max-sm:rounded-t-sheet max-sm:rounded-b-none max-sm:max-h-[92vh] max-sm:overflow-y-auto max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          className
        )}
        {...props}
      >
        {/* Bottom-sheet drag handle, mobile only */}
        <div
          aria-hidden="true"
          className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-9 rounded-full bg-hairline-strong"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild data-slot="dialog-close">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close"
              onMouseDown={(e) => {
                // Prevent focus from being applied on pointer interactions
                e.preventDefault();
              }}
              onClick={(e) => {
                // Remove focus immediately to prevent any outline flash during exit animations
                (e.currentTarget as HTMLButtonElement).blur();
              }}
              className={cn(
                "absolute top-4 right-4 p-2 hover:bg-surface-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                closeButtonClassName
              )}
            >
              <XIcon />
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Footer sits over a hairline, actions right-aligned (§4.5)
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-hairline pt-4 -mx-5 px-5',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'text-base leading-none font-semibold tracking-[-0.01em]',
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
