import React, { ReactNode } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { CalendarSummaryPane } from './CalendarSummaryPane';
import { TaskFocusPane } from './TaskFocusPane';
import { cn } from '@/lib/utils';

interface TaskFocusLayoutProps {
  children?: ReactNode;
  className?: string;
}

export const TaskFocusLayout: React.FC<TaskFocusLayoutProps> = ({
  children,
  className
}) => {
  const { currentView, dragState } = useUIStore();

  return (
    <div 
      className={cn(
        'h-screen flex bg-background',
        'transition-all duration-500 ease-out',
        dragState.isDragging && 'select-none',
        className
      )}
      data-view={currentView}
      data-dragging={dragState.isDragging}
    >
      {/* Calendar Summary Pane - Left Side */}
      <CalendarSummaryPane 
        className={cn(
          'flex-shrink-0 transition-all duration-300 ease-out',
          'w-80 border-r border-border'
        )}
      />
      
      {/* Task Focus Pane - Right Side */}
      <TaskFocusPane 
        className={cn(
          'flex-1 min-w-0 transition-all duration-300 ease-out',
          'flex flex-col'
        )}
      />
      
      {/* Optional children for modals, overlays, etc. */}
      {children}
    </div>
  );
};

export default TaskFocusLayout;