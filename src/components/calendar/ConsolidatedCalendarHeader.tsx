import React, { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type FullCalendar from '@fullcalendar/react';
import { Button } from '@/components/ui/Button';
import { Keycap } from '@/components/ui/Keycap';
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
export type CalendarViewType =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek';

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

// Define view options outside component to avoid recreating on every render.
// Shortcuts are the real single-key bindings from useKeyboardShortcuts.
const VIEW_OPTIONS = [
  {
    value: 'dayGridMonth' as const,
    label: 'Month',
    shortLabel: 'M',
    shortcut: 'M',
  },
  {
    value: 'timeGridWeek' as const,
    label: 'Week',
    shortLabel: 'W',
    shortcut: 'W',
  },
  {
    value: 'timeGridDay' as const,
    label: 'Day',
    shortLabel: 'D',
    shortcut: 'D',
  },
  { value: 'listWeek' as const, label: 'List', shortLabel: 'L', shortcut: 'L' },
];

/**
 * CalendarViewSwitcher - Uses shared ViewSwitcher component
 */
interface CalendarViewSwitcherProps {
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
}

const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({
  currentView,
  onViewChange,
}) => {
  return (
    <ViewSwitcher
      value={currentView}
      onChange={onViewChange}
      options={VIEW_OPTIONS}
    />
  );
};

/**
 * Get the calendar title based on current view and date
 */
const getCalendarTitle = (
  currentView: CalendarViewType,
  calendarRef?: React.RefObject<FullCalendar | null>,
  fallbackDate?: Date
): string => {
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
const isTodayDisabled = (
  currentView: CalendarViewType,
  calendarRef?: React.RefObject<FullCalendar | null>
): boolean => {
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
        return (
          format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
        );
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
export const ConsolidatedCalendarHeader: React.FC<
  ConsolidatedCalendarHeaderProps
> = ({
  currentView,
  onViewChange,
  onTodayClick,
  onPrevClick,
  onNextClick,
  onCreateEvent,
  className,
  calendarRef,
}) => {
  const [calendarTitle, setCalendarTitle] = useState(() =>
    getCalendarTitle(currentView, calendarRef)
  );
  const [todayDisabled, setTodayDisabled] = useState(() =>
    isTodayDisabled(currentView, calendarRef)
  );

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
    <div
      className={cn(
        'flex-shrink-0 p-4 border-b border-border bg-background',
        'transition-all duration-200 ease-out',
        className
      )}
    >
      {/* Three-section layout: Left, Center, Right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left Section: Sidebar trigger and title.
            Month name is Sentient (serif = time at rest, never a digit);
            the numerals stay Inter muted, baseline-aligned (§4.4). */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-start">
          <SmoothSidebarTrigger position="rightPane" />
          <h2 className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-serif text-lg font-normal leading-none text-foreground">
              {calendarTitle.split(' ')[0]}
            </span>
            {calendarTitle.includes(' ') && (
              <span className="text-[13px] leading-none text-muted-foreground">
                {calendarTitle.split(' ').slice(1).join(' ')}
              </span>
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

        {/* Right Section: three legible clusters — Prev·Today·Next, a
            hairline divider, then the one primary CTA this header earns
            (design-brief §2.1). */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-end">
          <div className="flex items-center gap-0.5">
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

            <Button
              variant="outline"
              size="sm"
              onClick={onTodayClick}
              disabled={todayDisabled}
              className={cn(
                'font-medium transition-all duration-200',
                todayDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              Today
              <Keycap className="ml-0.5 hidden sm:inline-flex">T</Keycap>
            </Button>

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
          </div>

          <div className="h-4 w-px bg-hairline" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onCreateEvent}
                aria-label="New event"
                className="h-7 gap-1.5 px-2.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">New event</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>New event</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
