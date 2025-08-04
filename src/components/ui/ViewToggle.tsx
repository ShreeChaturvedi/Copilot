import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type ViewMode = 'calendar' | 'task';

interface ViewToggleProps {
  currentView: ViewMode;
  onToggle: (view: ViewMode) => void;
  className?: string;
  disabled?: boolean;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  currentView,
  onToggle,
  className,
  disabled = false
}) => {

  return (
    <div className={cn('flex items-center gap-1 p-1 bg-muted rounded-md', className)}>
      <Button
        variant={currentView === 'calendar' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => !disabled && onToggle('calendar')}
        disabled={disabled}
        className={cn(
          'h-7 px-2 text-xs transition-all duration-200',
          currentView === 'calendar' && 'shadow-sm'
        )}
        aria-label="Calendar view"
      >
        <Calendar className="w-3 h-3 mr-1" />
        Calendar
      </Button>
      
      <Button
        variant={currentView === 'task' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => !disabled && onToggle('task')}
        disabled={disabled}
        className={cn(
          'h-7 px-2 text-xs transition-all duration-200',
          currentView === 'task' && 'shadow-sm'
        )}
        aria-label="Task view"
      >
        <CheckSquare className="w-3 h-3 mr-1" />
        Tasks
      </Button>
    </div>
  );
};

export default ViewToggle;