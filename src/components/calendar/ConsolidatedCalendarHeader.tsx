import React, { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
import { useCommandBarStore } from '@/stores/commandBarStore';

// Platform hint for the ⌘/Ctrl keycap (navigator.platform mirrors the other
// header/sidebar triggers; guarded for SSR/non-browser test envs).
const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toUpperCase().indexOf('MAC') >= 0;

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
/**
 * Format the active week/list range from the view bounds. activeEnd is
 * exclusive, so the last visible day is activeEnd - 1. Same-month weeks
 * collapse the trailing month ("July 28 – August 3" only when they differ).
 * The leading month stays the first whitespace-delimited token so the header's
 * Sentient month / Inter numeral split keeps working.
 */
const formatWeekRange = (activeStart: Date, activeEnd: Date): string => {
  const lastDay = new Date(activeEnd.getTime() - 24 * 60 * 60 * 1000);
  const sameMonth =
    activeStart.getFullYear() === lastDay.getFullYear() &&
    activeStart.getMonth() === lastDay.getMonth();
  const year = format(lastDay, 'yyyy');
  if (sameMonth) {
    return `${format(activeStart, 'MMMM')} ${format(activeStart, 'd')} – ${format(lastDay, 'd')}, ${year}`;
  }
  return `${format(activeStart, 'MMM')} ${format(activeStart, 'd')} – ${format(lastDay, 'MMM d')}, ${year}`;
};

const getCalendarTitle = (
  currentView: CalendarViewType,
  calendarRef?: React.RefObject<FullCalendar | null>,
  fallbackDate?: Date
): string => {
  let currentDate = fallbackDate || new Date();
  let calendarApi: ReturnType<FullCalendar['getApi']> | null = null;

  // Try to get the current date from the calendar API
  if (calendarRef?.current) {
    try {
      calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        currentDate = calendarApi.getDate();
      }
    } catch {
      // Fallback to current date
      currentDate = new Date();
      calendarApi = null;
    }
  }

  const localDate = toLocal(currentDate);

  switch (currentView) {
    case 'dayGridMonth':
      return format(localDate, 'MMMM yyyy');
    case 'timeGridWeek':
    case 'listWeek':
      // Show the actual visible span so navigating weeks within a month reads
      // as movement and cross-month weeks aren't mislabeled (#28/#30/#33).
      if (calendarApi) {
        try {
          return formatWeekRange(
            calendarApi.view.activeStart,
            calendarApi.view.activeEnd
          );
        } catch {
          return format(localDate, 'MMMM yyyy');
        }
      }
      return format(localDate, 'MMMM yyyy');
    case 'timeGridDay':
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
        'transition-colors duration-[var(--dur-3)] ease-out',
        className
      )}
    >
      {/* Three-section layout: Left, Center, Right. On phones it reflows to
          two rows — title + nav/CTA share row one, the view switcher drops to a
          full-width row two — mirroring TaskControls so the two primary headers
          behave consistently under 768px (#3). */}
      <div
        className={cn(
          'grid grid-cols-[1fr_auto_1fr] items-center gap-4',
          "max-md:gap-2 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:[grid-template-areas:'left_right'_'center_center']"
        )}
      >
        {/* Left Section: Sidebar trigger and title.
            Month name is Sentient (serif = time at rest, never a digit);
            the numerals stay Inter muted, baseline-aligned (§4.4). */}
        <div className="flex min-w-0 items-center gap-3 justify-self-start max-md:[grid-area:left]">
          <SmoothSidebarTrigger position="rightPane" />
          <h2 className="flex items-baseline gap-2 truncate">
            <span className="font-serif text-lg font-normal leading-none text-foreground">
              {calendarTitle.split(' ')[0]}
            </span>
            {calendarTitle.includes(' ') && (
              <span className="truncate text-[13px] leading-none text-muted-foreground">
                {calendarTitle.split(' ').slice(1).join(' ')}
              </span>
            )}
          </h2>
        </div>

        {/* Center Section: View Switcher (dead center of header) */}
        <div className="justify-self-center max-md:[grid-area:center] max-md:justify-self-stretch">
          <CalendarViewSwitcher
            currentView={currentView}
            onViewChange={onViewChange}
          />
        </div>

        {/* Right Section: three legible clusters — Prev·Today·Next, a
            hairline divider, then the one primary CTA this header earns
            (design-brief §2.1). */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-end max-md:[grid-area:right]">
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
                'font-medium transition-opacity duration-[var(--dur-3)]',
                todayDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              Today
              {/* Decorative shortcut hint: keep it out of the button's
                  accessible name (which must stay exactly "Today"). */}
              <span aria-hidden="true" className="contents">
                <Keycap className="ml-0.5 hidden sm:inline-flex">T</Keycap>
              </span>
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

          {/* Command palette trigger — the only non-keyboard entry point, so
              the palette (and its date-grammar quick-add) is reachable on
              touch and discoverable on desktop (#4). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useCommandBarStore.getState().setOpen(true)}
                aria-label="Open command palette"
                className="h-7 w-7 p-0"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="flex items-center gap-1.5">
                Search
                <span className="hidden sm:inline-flex items-center gap-0.5">
                  <Keycap>{isMac ? '⌘' : 'Ctrl'}</Keycap>
                  <Keycap>K</Keycap>
                </span>
              </p>
            </TooltipContent>
          </Tooltip>

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
