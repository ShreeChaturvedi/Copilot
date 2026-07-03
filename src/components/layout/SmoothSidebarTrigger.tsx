import React from 'react';
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

  // The wrapping <div> (a native element, ref-safe) is the Tooltip's asChild
  // anchor rather than <SidebarTrigger/> itself — SidebarTrigger is a plain
  // function component, not React.forwardRef, so Radix's Slot ref-cloning
  // can't reach through it to the real button node.
  if (isMobile) {
    return position === 'rightPane' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn('transition-all duration-150 ease-out', className)}
          >
            <SidebarTrigger />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <ShortcutHint />
        </TooltipContent>
      </Tooltip>
    ) : null;
  }

  // Desktop: show based on current sidebar state
  const shouldShow =
    position === 'sidebar' ? state === 'expanded' : state === 'collapsed';

  if (!shouldShow) return null;

  // Animation direction based on position - both slide in from left for smooth transition
  const slideDirection = 'slide-in-from-left-2';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'animate-in fade-in-0 duration-[240ms] ease-settle',
            slideDirection,
            className
          )}
        >
          <SidebarTrigger />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <ShortcutHint />
      </TooltipContent>
    </Tooltip>
  );
};
