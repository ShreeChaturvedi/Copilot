import React, { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import FullCalendar from '@fullcalendar/react';
import { Button } from '@/components/ui/Button';
import { SmoothSidebarTrigger } from '@/components/layout/SmoothSidebarTrigger';
import { cn } from '@/lib/utils';
import { toLocal } from '@/utils/date';

/**
 * Calendar view types
 */
export type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export interface ConsolidatedCalendarHeaderProps {
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onTodayClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onCreateEvent: () => void;
  className?: string;
  calendarRef?: React.RefObject<FullCalendar | null>;
}

/**
 * ViewSwitcher component with sliding animation and proper theming
 */
interface ViewSwitcherProps {
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
}

// Define view options outside component to avoid recreating on every render
const VIEW_OPTIONS = [
  { value: 'dayGridMonth', label: 'Month', shortLabel: 'M' },
  { value: 'timeGridWeek', label: 'Week', shortLabel: 'W' },
  { value: 'timeGridDay', label: 'Day', shortLabel: 'D' },
  { value: 'listWeek', label: 'List', shortLabel: 'L' }
] as const;

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = React.useState<React.CSSProperties>({});

  const handleViewClick = (view: CalendarViewType) => {
    onViewChange(view);
  };

  // Update slider position when current view changes
  React.useEffect(() => {
    const updateSliderPosition = () => {
      const currentIndex = VIEW_OPTIONS.findIndex(option => option.value === currentView);
      const currentButton = buttonRefs.current[currentIndex];
      const container = containerRef.current;

      if (currentButton && container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = currentButton.getBoundingClientRect();
        
        setSliderStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
          height: buttonRect.height,
          top: '50%',
          transform: 'translateY(-50%)',
        });
      }
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(updateSliderPosition, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentView]); // Remove viewOptions from dependencies

  return (
    <div 
      ref={containerRef}
      className="relative inline-flex rounded-lg border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 p-1 transition-all duration-200" 
      role="group"
    >
      {/* Sliding background indicator */}
      <div 
        className="absolute bg-background rounded-md shadow-sm transition-all duration-200 ease-out"
        style={sliderStyle}
      />
      
      {VIEW_OPTIONS.map(({ value, label, shortLabel }, index) => (
        <Button
          key={value}
          ref={(el) => { buttonRefs.current[index] = el; }}
          variant="ghost"
          size="sm"
          onClick={() => handleViewClick(value as CalendarViewType)}
          className={cn(
            'relative z-10 h-7 px-3 text-xs font-medium',
            currentView === value 
              ? 'text-foreground hover:!bg-transparent hover:!text-foreground' 
              : 'text-muted-foreground'
          )}
        >
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </Button>
      ))}
    </div>
  );
};

/**
 * Get the calendar title based on current view and date
 */
const getCalendarTitle = (currentView: CalendarViewType, calendarRef?: React.RefObject<FullCalendar | null>, fallbackDate?: Date): string => {
  let currentDate = fallbackDate || new Date();
  
  // Try to get the current date from the calendar API
  if (calendarRef?.current) {
    try {
      const calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        currentDate = calendarApi.getDate();
      }
    } catch {
      // Fallback to current date
      currentDate = new Date();
    }
  }
  
  const localDate = toLocal(currentDate);
  
  switch (currentView) {
    case 'dayGridMonth':
      return format(localDate, 'MMMM yyyy');
    case 'timeGridWeek':
      return format(localDate, 'MMMM yyyy');
    case 'timeGridDay':
      return format(localDate, 'MMMM d, yyyy');
    case 'listWeek':
      return format(localDate, 'MMMM d, yyyy');
    default:
      return format(localDate, 'MMMM yyyy');
  }
};

/**
 * Check if today button should be disabled/grayed
 */
const isTodayDisabled = (currentView: CalendarViewType, calendarRef?: React.RefObject<FullCalendar | null>): boolean => {
  if (!calendarRef?.current) return false;
  
  try {
    const calendarApi = calendarRef.current.getApi();
    if (!calendarApi) return false;
    
    const currentDate = calendarApi.getDate();
    const today = new Date();
    
    switch (currentView) {
      case 'dayGridMonth': {
        return format(currentDate, 'yyyy-MM') === format(today, 'yyyy-MM');
      }
      case 'timeGridWeek': {
        // Check if today is in the current week view
        const weekStart = calendarApi.view.activeStart;
        const weekEnd = calendarApi.view.activeEnd;
        return today >= weekStart && today < weekEnd;
      }
      case 'timeGridDay': {
        return format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      }
      case 'listWeek': {
        const weekStart = calendarApi.view.activeStart;
        const weekEnd = calendarApi.view.activeEnd;
        return today >= weekStart && today < weekEnd;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
};

/**
 * ConsolidatedCalendarHeader component that combines sidebar toggle, title, navigation, view switcher, and new event button
 */
export const ConsolidatedCalendarHeader: React.FC<ConsolidatedCalendarHeaderProps> = ({
  currentView,
  onViewChange,
  onTodayClick,
  onPrevClick,
  onNextClick,
  onCreateEvent,
  className,
  calendarRef
}) => {
  const [calendarTitle, setCalendarTitle] = useState(() => getCalendarTitle(currentView, calendarRef));
  const [todayDisabled, setTodayDisabled] = useState(() => isTodayDisabled(currentView, calendarRef));
  
  // Update title and today button state when view or calendar changes
  useEffect(() => {
    const updateTitle = () => {
      setCalendarTitle(getCalendarTitle(currentView, calendarRef));
      setTodayDisabled(isTodayDisabled(currentView, calendarRef));
    };
    
    updateTitle();
    
    // Listen for calendar date changes via FullCalendar API
    const calendarApi = calendarRef?.current?.getApi();
    if (calendarApi) {
      const handleDateChange = () => {
        // Use a small timeout to ensure FullCalendar has updated
        setTimeout(updateTitle, 10);
      };
      
      // Listen for view changes and date navigation
      calendarApi.on('datesSet', handleDateChange);
      
      return () => {
        calendarApi.off('datesSet', handleDateChange);
      };
    }
  }, [currentView, calendarRef]);
  
  return (
    <div className={cn(
      "flex-shrink-0 p-4 border-b border-border bg-background",
      "transition-all duration-200 ease-out",
      className
    )}>
      {/* Three-section layout: Left, Center, Right */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Section: Sidebar trigger and title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <SmoothSidebarTrigger position="rightPane" />
          <h2 className="text-lg font-semibold text-foreground">
            {calendarTitle.includes(' ') && (currentView === 'dayGridMonth' || currentView === 'timeGridWeek') ? (
              <>
                <span className="font-bold">{calendarTitle.split(' ')[0]}</span>
                <span className="font-normal"> {calendarTitle.split(' ').slice(1).join(' ')}</span>
              </>
            ) : (
              calendarTitle
            )}
          </h2>
        </div>
        
        {/* Center Section: View Switcher (dead center) */}
        <div className="flex justify-center flex-1">
          <ViewSwitcher
            currentView={currentView}
            onViewChange={onViewChange}
          />
        </div>
        
        {/* Right Section: Navigation and New Event */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Calendar Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTodayClick}
              disabled={todayDisabled}
              className={cn(
                "font-medium transition-all duration-200",
                todayDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevClick}
                aria-label="Previous period"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNextClick}
                aria-label="Next period"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* New Event Button with subtle diagonal gradient and shine */}
          <Button 
            onClick={onCreateEvent} 
            size="sm"
            className={cn(
              "gap-2 font-medium relative overflow-hidden transition-all duration-300 ease-out",
              // Base secondary color with subtle diagonal gradient
              "bg-gradient-to-br from-secondary/98 via-secondary to-secondary/95",
              "text-secondary-foreground shadow-xs border border-border/20",
              // Hover effects - subtle scaling and enhanced gradient
              "hover:scale-105 hover:shadow-lg hover:shadow-secondary/20",
              "hover:from-secondary/95 hover:via-secondary/98 hover:to-secondary/90",
              // Enhanced shimmer effect for visibility
              "before:absolute before:inset-0 before:bg-gradient-to-r",
              "before:from-transparent before:via-black/15 before:to-transparent",
              "dark:before:via-white/15",
              "before:translate-x-[-150%] before:skew-x-12 before:transition-transform before:duration-600",
              "hover:before:translate-x-[150%]",
              // Active state
              "active:scale-[1.02] active:shadow-md"
            )}
          >
            <Plus className="h-4 w-4 relative z-10" />
            <span className="relative z-10">New Event</span>
          </Button>
        </div>
      </div>
    </div>
  );
};