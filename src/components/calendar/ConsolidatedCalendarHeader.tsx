import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type FullCalendar from '@fullcalendar/react';
import { Button } from '@/components/ui/Button';
import { SmoothSidebarTrigger } from '@/components/layout/SmoothSidebarTrigger';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

// Define view options outside component to avoid recreating on every render
const VIEW_OPTIONS = [
  { value: 'dayGridMonth' as const, label: 'Month', shortLabel: 'M' },
  { value: 'timeGridWeek' as const, label: 'Week', shortLabel: 'W' },
  { value: 'timeGridDay' as const, label: 'Day', shortLabel: 'D' },
  { value: 'listWeek' as const, label: 'List', shortLabel: 'L' }
];

/**
 * CalendarViewSwitcher - Uses shared ViewSwitcher component
 */
interface CalendarViewSwitcherProps {
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
}

const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({ currentView, onViewChange }) => {
  return (
    <ViewSwitcher
      value={currentView}
      onChange={onViewChange}
      options={VIEW_OPTIONS}
    />
  );
};

/**
 * Animated Search Component for Calendar with Keyboard Shortcuts
 */
interface AnimatedSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const AnimatedSearch: React.FC<AnimatedSearchProps> = ({ value, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to activate search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        handleSearchClick();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleSearchClick = () => {
    setIsExpanded(true);
    // Focus input after animation completes
    setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
  };

  const handleClose = () => {
    setIsExpanded(false);
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div className="relative">
      <motion.div
        className="flex items-center"
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Search Icon/Button */}
        <motion.div layout>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={isExpanded ? undefined : handleSearchClick}
            title={isExpanded ? undefined : 'Search events (Ctrl+F)'}
            aria-label={isExpanded ? undefined : 'Open search input'}
            aria-expanded={isExpanded}
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </motion.div>

        {/* Expandable Search Input */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '200px', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative overflow-hidden"
              role="search"
              aria-label="Event search"
            >
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search events..."
                className="w-full h-7 px-3 pr-8 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-0 focus:border-border focus-visible:ring-0 focus-visible:outline-none"
                aria-label="Search events by title or content"
                aria-describedby="search-help"
              />
              {/* Screen reader helper text */}
              <div id="search-help" className="sr-only">
                Press Escape to close search, or use Ctrl+F to open
              </div>
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-0.5 h-6 w-6 p-0"
                onClick={handleClose}
                title="Close search (Escape)"
                aria-label="Close search input"
              >
                <X className="w-3 h-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

/**
 * CalendarToolbar component with navigation and action buttons
 */
interface CalendarToolbarProps {
  onPrevClick: () => void;
  onNextClick: () => void;
  onCreateEvent: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  onPrevClick,
  onNextClick,
  onCreateEvent,
  searchValue = '',
  onSearchChange,
}) => {
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-md p-1">
      {/* Animated Search */}
      <AnimatedSearch
        value={searchValue}
        onChange={onSearchChange || (() => { })}
      />

      {/* Filter Button (Future Enhancement) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled // Disabled for now
          >
            <Filter className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Filter events</p>
        </TooltipContent>
      </Tooltip>

      {/* Back Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevClick}
            aria-label="Previous period"
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Previous period</p>
        </TooltipContent>
      </Tooltip>

      {/* Forward Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextClick}
            aria-label="Next period"
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Next period</p>
        </TooltipContent>
      </Tooltip>

      {/* New Event Plus Button with glisten effect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onCreateEvent}
            size="sm"
            className={cn(
              "h-7 w-7 p-0 relative overflow-hidden transition-all duration-300 ease-out",
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
              "before:translate-x-[-150%] before:skew-x-12 before:transition-transform before:duration-[480ms]",
              "hover:before:translate-x-[150%]",
              // Active state
              "active:scale-[1.02] active:shadow-md"
            )}
            aria-label="New Event"
          >
            <Plus className="h-3.5 w-3.5 relative z-10" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>New Event</p>
        </TooltipContent>
      </Tooltip>
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
  calendarRef,
  searchValue = '',
  onSearchChange
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left Section: Sidebar trigger and title */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-start">
          <SmoothSidebarTrigger position="rightPane" />
          <h2 className="text-lg font-semibold text-foreground">
            {calendarTitle.includes(' ') ? (
              <>
                <span className="font-bold">{calendarTitle.split(' ')[0]}</span>
                <span className="font-normal"> {calendarTitle.split(' ').slice(1).join(' ')}</span>
              </>
            ) : (
              calendarTitle
            )}
          </h2>
        </div>

        {/* Center Section: View Switcher (dead center of header) */}
        <div className="justify-self-center">
          <CalendarViewSwitcher
            currentView={currentView}
            onViewChange={onViewChange}
          />
        </div>

        {/* Right Section: Today Button and Toolbar */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-end">
          {/* Today Button */}
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

          {/* Calendar Toolbar */}
          <CalendarToolbar
            onPrevClick={onPrevClick}
            onNextClick={onNextClick}
            onCreateEvent={onCreateEvent}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
          />
        </div>
      </div>
    </div>
  );
};