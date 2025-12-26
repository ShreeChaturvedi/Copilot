import { useRef, useCallback, useState, useEffect } from 'react';
// Import FullCalendar core & plugin styles so grid lines and headers render correctly

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventChangeArg, EventInput } from '@fullcalendar/core';
import { clsx } from 'clsx';

import './calendar.css';

import { useEvents, useUpdateEvent, useSwipeDetection } from '../../hooks';
import { useCalendars } from '../../hooks';
import type { CalendarEvent } from "@shared/types";
import { toLocal } from '../../utils/date';
import { expandOccurrences } from '@/utils/recurrence';
import { useSidebar } from '@/components/ui/sidebar';
import { useCalendarSettingsStore } from '@/stores/calendarSettingsStore';

/**
 * Calendar view types
 */
export type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export interface CalendarViewProps {
  /** Optional class name for custom styling */
  className?: string;
  /** Callback when event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Callback when creating a new event */
  onEventCreate?: (event: Partial<CalendarEvent>) => void;
  /** Height of the calendar */
  height?: string | number;
  /** Current calendar view */
  currentView?: CalendarViewType;
  /** Callback when view changes */
  onViewChange?: (view: CalendarViewType) => void;
  /** Callback for today navigation */
  onTodayClick?: () => void;
  /** Callback for previous navigation */
  onPrevClick?: () => void;
  /** Callback for next navigation */
  onNextClick?: () => void;
  /** Ref to the FullCalendar instance */
  calendarRef?: React.RefObject<FullCalendar | null>;
}

export const CalendarView = ({
  className,
  onEventClick,
  onEventCreate,
  height = '100%',
  currentView: externalCurrentView,
  onPrevClick,
  onNextClick,
  calendarRef: externalCalendarRef,
}: CalendarViewProps) => {
  const internalCalendarRef = useRef<FullCalendar>(null);
  const [internalCurrentView] = useState<CalendarViewType>('timeGridWeek');
  const [isMobile, setIsMobile] = useState(false);

  // Use external refs and state if provided, otherwise use internal ones
  const calendarRef = externalCalendarRef ?? internalCalendarRef;
  const currentView = externalCurrentView ?? internalCurrentView;

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get sidebar state to trigger calendar resize when sidebar expands/collapses
  const { state: sidebarState } = useSidebar();

  // Handle sidebar state changes - continuously update calendar size during transition
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;

    // Immediately start updating size
    requestAnimationFrame(() => calendarApi.updateSize());

    // Continue updating size during the sidebar transition for smooth resizing
    const intervalId = setInterval(() => {
      requestAnimationFrame(() => calendarApi.updateSize());
    }, 7); // ~60fps for smooth animation

    // Stop updating after the sidebar transition is complete
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      // Final update to ensure we're perfectly sized
      requestAnimationFrame(() => calendarApi.updateSize());
    }, 210); // Slightly longer than sidebar transition duration (200ms)

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [sidebarState, calendarRef]);


  // Handle view changes - update FullCalendar when currentView prop changes
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi && calendarApi.view.type !== currentView) {
      // Defer to animation frame to avoid calling during render
      requestAnimationFrame(() => {
        const api = calendarRef.current?.getApi();
        if (api && api.view.type !== currentView) {
          api.changeView(currentView);
        }
      });
    }
  }, [currentView, calendarRef]);

  // Hooks for data management
  const { data: calendars = [], isLoading: calendarsLoading } = useCalendars();
  const visibleCalendars = calendars.filter(cal => cal.visible);
  const visibleCalendarNames = visibleCalendars.map(cal => cal.name);
  // Track default calendar color for consistent preview styling
  const defaultCalendar = calendars.find(cal => cal.isDefault) || visibleCalendars[0];

  const { data: events = [] } = useEvents(
    {
      calendarNames: visibleCalendarNames,
    },
    { enabled: visibleCalendarNames.length > 0 && !calendarsLoading }
  );

  const updateEventMutation = useUpdateEvent();

  // Combined ref for both drag & drop and gesture handling
  const combinedRef = useRef<HTMLDivElement>(null);

  // Expose CSS var for default calendar color to use across components
  useEffect(() => {
    const root = document.documentElement;
    if (defaultCalendar?.color) {
      root.style.setProperty('--default-calendar-color', defaultCalendar.color);
    } else {
      root.style.removeProperty('--default-calendar-color');
    }
  }, [defaultCalendar?.color]);

  // Handle external drag and drop from tasks  
  const handleEventReceive = useCallback((info: { event: { start: Date | null; extendedProps: { isFromTask?: boolean; originalTask?: { id?: string; title: string; scheduledDate?: Date } }; remove: () => void } }) => {
    // Get the drop date/time from FullCalendar
    const dropDate = info.event.start;
    const eventData = info.event.extendedProps;

    if (dropDate && eventData?.isFromTask && eventData?.originalTask && onEventCreate) {
      // Find default calendar or first visible calendar
      const defaultCalendar = calendars.find(cal => cal.isDefault) || visibleCalendars[0];

      if (defaultCalendar) {
        const newEvent = {
          title: eventData.originalTask.title,
          start: dropDate,
          end: new Date(dropDate.getTime() + 60 * 60 * 1000), // 1 hour duration
          allDay: false,
          calendarName: defaultCalendar.name,
          color: defaultCalendar.color,
        };

        // Remove the temporary event since we'll create it through the dialog
        info.event.remove();

        // Trigger create event dialog with correct date/time
        onEventCreate(newEvent);
      }
    }
  }, [calendars, visibleCalendars, onEventCreate]);

  /**
   * Convert CalendarEvent to FullCalendar EventInput format
   */
  const transformEventsForCalendar = useCallback((events: CalendarEvent[]): EventInput[] => {
    return events.map(event => {
      const calendar = calendars.find(cal => cal.name === event.calendarName);

      const occurrenceStart = event.occurrenceInstanceStart ?? event.start;
      const occurrenceEnd = event.occurrenceInstanceEnd ?? event.end;

      // Ensure each rendered occurrence gets a unique id to avoid identity collisions in FullCalendar
      const instanceKey = new Date(occurrenceStart).toISOString();
      const eventId = `${event.id}::${instanceKey}`;

      return {
        id: eventId,
        groupId: event.id, // stable master/series id
        title: event.title,
        start: toLocal(occurrenceStart),
        end: toLocal(occurrenceEnd),
        allDay: event.allDay || false,
        // Disable drag/resize for optimistic temp events to avoid 404 updates
        editable: !String(event.id).startsWith('temp-'),
        backgroundColor: event.color || calendar?.color || '#3788d8',
        borderColor: event.color || calendar?.color || '#3788d8',
        textColor: '#ffffff',
        extendedProps: {
          description: event.description,
          location: event.location,
          notes: event.notes,
          calendarName: event.calendarName,
          originalEvent: event,
        },
      };
    });
  }, [calendars]);



  /**
   * Handle date selection for creating new events
   */
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const { start, end, allDay } = selectInfo;
    const viewType = selectInfo.view?.type ?? '';
    const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();

    // Enforce: timed selections in time grid must remain within a single day
    if (viewType.startsWith('timeGrid') && !allDay && !sameDay) {
      selectInfo.view.calendar.unselect();
      return;
    }

    // Find default calendar or first visible calendar
    const defaultCalendar = calendars.find(cal => cal.isDefault) || visibleCalendars[0];

    if (!defaultCalendar) {
      console.warn('No calendar available for creating events');
      return;
    }

    const newEvent: Partial<CalendarEvent> = {
      title: '',
      // Don't convert to UTC here - FullCalendar provides dates in local time
      // The conversion to UTC happens in the API layer when storing
      start: start,
      end: end,
      allDay,
      calendarName: defaultCalendar.name,
      color: defaultCalendar.color,
    };

    // Clear selection
    selectInfo.view.calendar.unselect();

    // Trigger create event callback
    onEventCreate?.(newEvent);
  }, [calendars, visibleCalendars, onEventCreate]);

  /**
   * Handle event click
   */
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const originalEvent = clickInfo.event.extendedProps.originalEvent as CalendarEvent;
    // If this is a recurring occurrence, preserve the instance times on the object we pass
    // Don't convert - FullCalendar already provides the correct times
    const instanceStart = clickInfo.event.start ?? undefined;
    const instanceEnd = clickInfo.event.end ?? undefined;
    const enriched: CalendarEvent = {
      ...originalEvent,
      occurrenceInstanceStart: instanceStart,
      occurrenceInstanceEnd: instanceEnd,
    };
    onEventClick?.(enriched);
  }, [onEventClick]);

  /**
   * Handle event drag/resize
   */
  const handleEventChange = useCallback(async (changeInfo: EventChangeArg) => {
    const { event } = changeInfo;
    const originalEvent = event.extendedProps.originalEvent as CalendarEvent;

    try {
      // For recurring series occurrence, revert and encourage editing via dialog
      if (originalEvent.recurrence) {
        changeInfo.revert();
        return;
      }
      // Enforce: timed events cannot span multiple days
      const start = event.start!;
      const end = event.end!;
      const allDay = event.allDay;
      const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
      if (!allDay && !sameDay) {
        changeInfo.revert();
        return;
      }
      // Optimistic update is handled by the hook; ensure visual revert on error
      updateEventMutation.mutate(
        {
          id: originalEvent.id,
          data: {
            // Pass dates directly - API layer handles UTC conversion
            start: event.start!,
            end: event.end!,
            allDay: event.allDay,
          },
        },
        {
          onError: () => {
            changeInfo.revert();
          },
        }
      );
    } catch (error) {
      // Revert the change on error
      changeInfo.revert();
      console.error('Failed to update event:', error);
    }
  }, [updateEventMutation]);

  // Setup simple swipe detection
  const swipeHandlers = useSwipeDetection({
    onSwipedLeft: () => {
      // Swipe left = next page
      if (onNextClick) {
        onNextClick();
      } else {
        const calendarApi = calendarRef.current?.getApi();
        calendarApi?.next();
      }
    },
    onSwipedRight: () => {
      // Swipe right = previous page
      if (onPrevClick) {
        onPrevClick();
      } else {
        const calendarApi = calendarRef.current?.getApi();
        calendarApi?.prev();
      }
    }
  });

  // Connect refs and apply wheel listener
  useEffect(() => {
    if (combinedRef.current) {
      // Add wheel event listener for trackpad
      const element = combinedRef.current;
      element.addEventListener('wheel', swipeHandlers.onWheel, { passive: false });

      return () => {
        element.removeEventListener('wheel', swipeHandlers.onWheel);
      };
    }
  }, [swipeHandlers.onWheel]);

  // Range-bounded expansion of recurring series
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);

  const expandedEvents: CalendarEvent[] = (() => {
    if (!visibleRange) return events;
    const rangeStart = visibleRange.start;
    const rangeEnd = visibleRange.end;
    const out: CalendarEvent[] = [];
    for (const ev of events) {
      if (ev.recurrence) {
        const occ = expandOccurrences(
          {
            id: ev.id,
            start: ev.start,
            end: ev.end,
            recurrence: ev.recurrence,
            exceptions: ev.exceptions || [],
            allDay: ev.allDay || false,
          },
          rangeStart,
          rangeEnd
        );
        if (occ.length === 0) continue;
        for (const o of occ) {
          out.push({
            ...ev,
            occurrenceInstanceStart: o.start,
            occurrenceInstanceEnd: o.end,
          });
        }
      } else {
        out.push(ev);
      }
    }
    return out;
  })();

  const calendarEvents = transformEventsForCalendar(expandedEvents);
  const { getSlotTimes } = useCalendarSettingsStore();
  const { slotMinTime, slotMaxTime } = getSlotTimes();

  // Force calendar to re-render when slot times change by keying the component
  const calendarKey = `${slotMinTime}-${slotMaxTime}`;

  return (
    <div className={clsx('h-full flex flex-col bg-card', className)} style={{ overscrollBehavior: 'none' }}>
      {/* Calendar Content */}
      <div
        ref={combinedRef}
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        className={clsx(
          "flex-1 relative bg-card transition-all duration-200"
        )}
        style={{ overscrollBehavior: 'none' }}
      >

        <div className="h-full" style={{ overscrollBehavior: 'none' }}>
          <FullCalendar
            key={calendarKey}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={currentView}
            headerToolbar={false}
            height={height}
            events={calendarEvents}
            selectable={true}
            selectMirror={true}
            editable={true}
            droppable={true}
            dayMaxEvents={true}
            weekends={true}
            nowIndicator={true}
            allDayText="ALL DAY"
            /* Disable header/nav link navigation to avoid random view jumps & underline */
            navLinks={false}
            /* Allow any selection/drag/drop/resize; we'll accept the shape and open dialog */
            selectAllow={() => true}
            eventAllow={() => true}
            /* Ensure time axis is visible and labels are clear */
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
            slotLabelContent={(arg) => {
              const hours24 = arg.date.getHours();
              const minutes = arg.date.getMinutes();
              const isNoon = hours24 === 12 && minutes === 0;
              // Replace 12:00 PM with NOON in week view
              if (arg.view?.type?.startsWith('timeGrid') && isNoon) {
                return 'NOON';
              }
              // For whole hours (minutes === 0): show "H AM/PM" and style hour/meridiem separately
              if (minutes === 0) {
                const hour12 = ((hours24 % 12) || 12).toString();
                const meridiem = hours24 < 12 ? 'AM' : 'PM';
                return { html: `<span class="fc-slot-hour">${hour12}</span><span class="fc-slot-meridiem"> ${meridiem}</span>` };
              }
              // Otherwise, use the default generated label
              return arg.text;
            }}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventChange={handleEventChange}
            eventReceive={handleEventReceive}
            datesSet={(arg) => {
              // Track the active visible range for expansion and memoization
              setVisibleRange({ start: arg.start, end: arg.end });
            }}
            themeSystem="standard"
            dayCellClassNames="hover:bg-accent/50 cursor-pointer transition-colors duration-200"
            eventClassNames={(arg) => {
              const classes = ['cursor-pointer', 'transition-all', 'duration-200'];
              // Only mark external task mirrors as preview to style with default calendar color
              const isExternalTask = Boolean((arg.event as unknown as { extendedProps?: { isFromTask?: boolean } }).extendedProps?.isFromTask);
              if (arg.isMirror && isExternalTask) {
                classes.push('fc-event-preview');
              }
              return classes;
            }}
            eventBackgroundColor={defaultCalendar?.color}
            eventBorderColor={defaultCalendar?.color}
            aspectRatio={isMobile ? 1.0 : undefined}
            handleWindowResize={true}
            contentHeight="100%"
            dayMaxEventRows={isMobile ? 2 : 3}
            moreLinkClick="popover"
            locale="en"
            buttonText={{
              today: 'Today',
              month: 'Month',
              week: 'Week',
              day: 'Day',
              list: 'List',
            }}
            windowResizeDelay={0}
            eventDisplay="block"
            displayEventTime={true}
            displayEventEnd={true}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              omitZeroMinute: false,
              hour12: true
            }}
            dayHeaderContent={(args) => {
              const viewType = args.view?.type ?? '';
              const isMonthOrWeek = viewType === 'dayGridMonth' || viewType === 'timeGridWeek';
              const shortWeekdayUpper = args.date
                .toLocaleDateString('en-US', { weekday: 'short' })
                .toUpperCase();
              const labelText = isMonthOrWeek ? shortWeekdayUpper : args.text;
              const dayNumber = args.date.getDate();
              const isToday = args.isToday;
              return (
                <div className="day-header-container">
                  <span className="day-header-name">{labelText}</span>
                  <span className={`day-header-number ${isToday ? 'today' : ''}`}>{dayNumber}</span>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}; 