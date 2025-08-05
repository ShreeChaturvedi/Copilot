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
import type { CalendarEvent } from '../../types';
import { toLocal, toUTC } from '../../utils/date';
import { useSidebar } from '@/components/ui/sidebar';

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
  const [isLoading] = useState(false);
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
      calendarApi.changeView(currentView);
    }
  }, [currentView, calendarRef]);

  // Hooks for data management
  const { data: calendars = [] } = useCalendars();
  const visibleCalendars = calendars.filter(cal => cal.visible);
  const visibleCalendarNames = visibleCalendars.map(cal => cal.name);

  const { data: events = [], isLoading: eventsLoading } = useEvents({
    calendarNames: visibleCalendarNames,
  });

  const updateEventMutation = useUpdateEvent();

  // Combined ref for both drag & drop and gesture handling
  const combinedRef = useRef<HTMLDivElement>(null);

  // Handle external drag and drop from tasks  
  const handleEventReceive = useCallback((info: { event: { start: Date | null; extendedProps: { isFromTask?: boolean; originalTask?: { title: string } }; remove: () => void } }) => {
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

      return {
        id: event.id,
        title: event.title,
        start: toLocal(event.start),
        end: toLocal(event.end),
        allDay: event.allDay || false,
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

    // Find default calendar or first visible calendar
    const defaultCalendar = calendars.find(cal => cal.isDefault) || visibleCalendars[0];

    if (!defaultCalendar) {
      console.warn('No calendar available for creating events');
      return;
    }

    const newEvent: Partial<CalendarEvent> = {
      title: '',
      start: toUTC(start),
      end: toUTC(end),
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
    onEventClick?.(originalEvent);
  }, [onEventClick]);

  /**
   * Handle event drag/resize
   */
  const handleEventChange = useCallback(async (changeInfo: EventChangeArg) => {
    const { event } = changeInfo;
    const originalEvent = event.extendedProps.originalEvent as CalendarEvent;

    try {
      const updatedEvent: CalendarEvent = {
        ...originalEvent,
        start: toUTC(event.start!),
        end: toUTC(event.end!),
        allDay: event.allDay,
      };

      await updateEventMutation.mutateAsync({
        id: originalEvent.id,
        data: {
          start: updatedEvent.start,
          end: updatedEvent.end,
          allDay: updatedEvent.allDay,
        },
      });
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

  const calendarEvents = transformEventsForCalendar(events);

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
        {(isLoading || eventsLoading) && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}

        <div className="h-full" style={{ overscrollBehavior: 'none' }}>
          <FullCalendar
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
            navLinks={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventChange={handleEventChange}
            eventReceive={handleEventReceive}
            themeSystem="standard"
            dayCellClassNames="hover:bg-accent/50 cursor-pointer transition-colors duration-200"
            eventClassNames="cursor-pointer transition-all duration-200"
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
              const dayName = args.date.toLocaleDateString('en-US', { weekday: 'short' });
              const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
              const dayNumber = args.date.getDate();
              const isToday = args.isToday;
              
              return (
                <div className="day-header-container">
                  <span className="day-header-name">
                    {capitalizedDayName}
                  </span>
                  <span className={`day-header-number ${isToday ? 'today' : ''}`}>
                    {dayNumber}
                  </span>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}; 