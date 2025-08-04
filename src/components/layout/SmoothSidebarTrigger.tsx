import React from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface SmoothSidebarTriggerProps {
  position: 'sidebar' | 'rightPane';
  className?: string;
}

export const SmoothSidebarTrigger: React.FC<SmoothSidebarTriggerProps> = ({
  position,
  className = ''
}) => {
  const { state, isMobile } = useSidebar();

  // Mobile: always show in right pane
  if (isMobile) {
    return position === 'rightPane' ? (
      <div className={cn('transition-all duration-200 ease-linear', className)}>
        <SidebarTrigger />
      </div>
    ) : null;
  }

  // Desktop: show based on current sidebar state
  const shouldShow = position === 'sidebar' ? state === 'expanded' : state === 'collapsed';
  
  if (!shouldShow) return null;

  // Animation direction based on position - both slide in from left for smooth transition
  const slideDirection = 'slide-in-from-left-2';

  return (
    <div className={cn(
      'animate-in fade-in-0 duration-200 ease-linear',
      slideDirection,
      className
    )}>
      <SidebarTrigger />
    </div>
  );
};