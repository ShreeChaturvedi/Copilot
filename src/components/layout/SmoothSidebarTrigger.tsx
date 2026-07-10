import React, { useEffect, useRef } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Keycap } from '@/components/ui/Keycap';
import { cn } from '@/lib/utils';

interface SmoothSidebarTriggerProps {
  position: 'sidebar' | 'rightPane';
  className?: string;
}

// Same OS-detection expression as hooks/useKeyboardShortcuts.ts's
// getKeyboardShortcuts() — that helper doesn't export `isMac` itself, so this
// mirrors the literal check rather than introducing a third copy elsewhere.
const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Shared across both trigger instances (sidebar + rightPane). Clicking a
// trigger to toggle the sidebar unmounts that trigger and mounts its
// counterpart in a different subtree; this flag lets the newly-visible trigger
// claim focus so a keyboard user isn't dropped to <body>. Only set on an actual
// trigger click, so unrelated renders (initial mount, Cmd+B) never steal focus.
let pendingTriggerFocus = false;

const ShortcutHint = () => (
  <span className="flex items-center gap-2">
    Toggle sidebar
    <span className="flex items-center gap-1">
      <Keycap>{isMac ? '⌘' : 'Ctrl'}</Keycap>
      <Keycap>B</Keycap>
    </span>
  </span>
);

export const SmoothSidebarTrigger: React.FC<SmoothSidebarTriggerProps> = ({
  position,
  className = '',
}) => {
  const { state, isMobile } = useSidebar();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Desktop: the two triggers are mutually exclusive by sidebar state.
  const desktopShouldShow =
    position === 'sidebar' ? state === 'expanded' : state === 'collapsed';
  // Mobile: only the rightPane trigger renders (the in-drawer one is null).
  const visible = isMobile ? position === 'rightPane' : desktopShouldShow;

  // When this trigger becomes visible right after a toggle click, move focus to
  // it so focus follows the control across the unmount/remount swap.
  useEffect(() => {
    if (visible && pendingTriggerFocus) {
      pendingTriggerFocus = false;
      wrapperRef.current?.querySelector('button')?.focus();
    }
  }, [visible]);

  const handleTriggerClick = () => {
    pendingTriggerFocus = true;
  };

  // The wrapping <div> (a native element, ref-safe) is the Tooltip's asChild
  // anchor rather than <SidebarTrigger/> itself — SidebarTrigger is a plain
  // function component, not React.forwardRef, so Radix's Slot ref-cloning
  // can't reach through it to the real button node.
  if (isMobile) {
    return position === 'rightPane' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={wrapperRef}
            className={cn(
              'transition-[opacity,transform] duration-150 ease-out',
              className
            )}
          >
            <SidebarTrigger onClick={handleTriggerClick} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <ShortcutHint />
        </TooltipContent>
      </Tooltip>
    ) : null;
  }

  if (!desktopShouldShow) return null;

  // Animation direction based on position - both slide in from left for smooth transition
  const slideDirection = 'slide-in-from-left-2';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={wrapperRef}
          className={cn(
            'animate-in fade-in-0 duration-[240ms] ease-settle',
            slideDirection,
            className
          )}
        >
          <SidebarTrigger onClick={handleTriggerClick} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <ShortcutHint />
      </TooltipContent>
    </Tooltip>
  );
};
