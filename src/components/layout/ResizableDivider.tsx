import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface ResizableDividerProps {
  onResize: (newWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export const ResizableDivider = ({
  onResize,
  minWidth = 200,
  maxWidth = 600,
  className,
}: ResizableDividerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(true);
    
    // Add cursor style to body during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging) return;

      const newWidth = Math.max(minWidth, Math.min(maxWidth, event.clientX));
      onResize(newWidth);
    },
    [isDragging, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Remove cursor style from body
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Handle mouse events during drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard support for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 50 : 10;
    let newWidth: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newWidth = Math.max(minWidth, (dividerRef.current?.offsetLeft || 300) - step);
        break;
      case 'ArrowRight':
        event.preventDefault();
        newWidth = Math.min(maxWidth, (dividerRef.current?.offsetLeft || 300) + step);
        break;
      case 'Home':
        event.preventDefault();
        newWidth = minWidth;
        break;
      case 'End':
        event.preventDefault();
        newWidth = maxWidth;
        break;
    }

    if (newWidth !== null) {
      onResize(newWidth);
    }
  };

  return (
    <div
      ref={dividerRef}
      className={clsx(
        'relative flex-shrink-0 w-3 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700',
        'hover:bg-gradient-to-r hover:from-green-500/80 hover:via-green-400 hover:to-green-500/80',
        'transition-all duration-300 ease-out cursor-col-resize group',
        'shadow-2xl shadow-black/20',
        isDragging && 'bg-gradient-to-r from-green-400 via-green-300 to-green-400 shadow-2xl shadow-green-400/50 scale-x-150',
        // Professional depth and material design
        'backdrop-blur-sm border-l border-r border-gray-600/30',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={dividerRef.current?.offsetLeft}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
    >
      {/* Sophisticated visual indicator with premium styling */}
      <div
        className={clsx(
          'absolute inset-y-0 left-1/2 transform -translate-x-1/2',
          'w-px bg-gradient-to-b from-transparent via-green-400 to-transparent',
          'opacity-0 transition-all duration-300 ease-out',
          (isHovered || isDragging) && 'opacity-100 w-0.5 shadow-2xl shadow-green-400/60'
        )}
      />
      
      {/* Enhanced hover area for better UX */}
      <div className="absolute inset-y-0 -left-4 -right-4" />
      
      {/* Premium drag indicator dots with glow effect */}
      <div className={clsx(
        'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
        'opacity-0 transition-all duration-300 ease-out',
        (isHovered || isDragging) && 'opacity-100 scale-125'
      )}>
        <div className="flex flex-col space-y-2 items-center">
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full transition-all duration-300',
            (isHovered || isDragging) 
              ? 'bg-green-300 shadow-lg shadow-green-400/60' 
              : 'bg-green-400'
          )} />
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full transition-all duration-300',
            (isHovered || isDragging) 
              ? 'bg-green-300 shadow-lg shadow-green-400/60' 
              : 'bg-green-400'
          )} />
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full transition-all duration-300',
            (isHovered || isDragging) 
              ? 'bg-green-300 shadow-lg shadow-green-400/60' 
              : 'bg-green-400'
          )} />
        </div>
      </div>
      
      {/* Professional focus indicator with ring effects */}
      <div
        className={clsx(
          'absolute inset-0 rounded-sm ring-2 ring-green-400 ring-opacity-0',
          'transition-all duration-300 ease-out',
          'focus-within:ring-opacity-80 focus-within:ring-4 focus-within:shadow-2xl focus-within:shadow-green-400/40'
        )}
      />
    </div>
  );
};