/**
 * CursorTooltip - A tooltip that follows the cursor and uses shadcn styling
 */

import React, { useState, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface CursorTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const CursorTooltip: React.FC<CursorTooltipProps> = ({
  children,
  content,
  className,
  containerClassName,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Position tooltip to top-right of cursor
      const offsetX = 12;
      const offsetY = -8;

      setPosition({
        x: x + offsetX,
        y: y + offsetY,
      });
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    // Touch support for mobile devices
    const handleTouchStart = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      setPosition({ x: x + 12, y: y - 8 });
      setIsVisible(true);
    };

    const handleTouchEnd = () => {
      // Add small delay before hiding on mobile
      setTimeout(() => setIsVisible(false), 1500);
    };

    // Keyboard focus support: show when a focusable child receives focus.
    // focusin/focusout bubble, so descendant focus is captured here.
    const handleFocusIn = () => {
      const rect = container.getBoundingClientRect();
      // Anchor to the top-right of the container for keyboard users.
      setPosition({ x: rect.width + 12, y: -8 });
      setIsVisible(true);
    };

    const handleFocusOut = () => {
      setIsVisible(false);
    };

    // Mouse events for desktop
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousemove', handleMouseMove);

    // Keyboard events
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    // Touch events for mobile
    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative', containerClassName)}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-popover-foreground bg-popover border border-border rounded-md [box-shadow:var(--shadow-popover)] pointer-events-none',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'max-w-xs sm:max-w-sm', // Mobile responsive max width
            className
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default CursorTooltip;
