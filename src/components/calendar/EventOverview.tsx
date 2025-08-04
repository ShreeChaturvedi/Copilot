import React from 'react';
import { format, isToday, isTomorrow, isThisWeek, isAfter, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useCalendars } from '@/hooks/useCalendars';
import { type CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';

interface EventOverviewProps {
  maxEvents?: number;
  showCurrentWeekOnly?: boolean;
  className?: string;
}

interface GroupedEvents {
  [key: string]: CalendarEvent[];
}

export const EventOverview: React.FC<EventOverviewProps> = ({
  maxEvents = 5,
  showCurrentWeekOnly = true,
  className
}) => {
  const { data: calendars = [] } = useCalendars();
  const { data: allEvents = [] } = useEvents();

  // Filter events for current week and get visible calendar events only
  const visibleCalendarNames = calendars
    .filter(cal => cal.visible)
    .map(cal => cal.name);

  const currentWeekEvents = React.useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

    return allEvents
      .filter(event => {
        // Only show events from visible calendars
        if (!visibleCalendarNames.includes(event.calendarName)) {
          return false;
        }

        const eventStart = new Date(event.start);
        
        if (showCurrentWeekOnly) {
          // Event must be within current week
          return eventStart >= weekStart && eventStart <= weekEnd;
        }
        
        // Otherwise, show future events
        return isAfter(eventStart, now);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, maxEvents);
  }, [allEvents, visibleCalendarNames, showCurrentWeekOnly, maxEvents]);

  // Group events by day
  const groupedEvents: GroupedEvents = React.useMemo(() => {
    const groups: GroupedEvents = {};

    currentWeekEvents.forEach(event => {
      const eventDate = new Date(event.start);
      let dayKey: string;

      if (isToday(eventDate)) {
        dayKey = 'Today';
      } else if (isTomorrow(eventDate)) {
        dayKey = 'Tomorrow';
      } else if (isThisWeek(eventDate, { weekStartsOn: 1 })) {
        dayKey = format(eventDate, 'EEEE'); // Wednesday, Thursday, etc.
      } else {
        dayKey = format(eventDate, 'MMM d'); // Jan 15, etc.
      }

      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(event);
    });

    return groups;
  }, [currentWeekEvents]);

  // Get calendar color for an event
  const getEventColor = (calendarName: string) => {
    const calendar = calendars.find(cal => cal.name === calendarName);
    return calendar?.color || '#6366f1';
  };

  // If no events, show empty state
  if (currentWeekEvents.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-sidebar-foreground" />
          <h3 className="text-sm font-semibold text-sidebar-foreground">
            Upcoming Events
          </h3>
        </div>
        
        <div className="text-center py-4 text-muted-foreground">
          <CalendarIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No events this week</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-sidebar-foreground" />
        <h3 className="text-sm font-semibold text-sidebar-foreground">
          Upcoming Events
        </h3>
      </div>
      
      <div className="space-y-3">
        {Object.entries(groupedEvents).map(([dayKey, events]) => (
          <div key={dayKey}>
            {/* Day heading */}
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {dayKey}
            </div>
            
            {/* Events for this day */}
            <div className="space-y-1">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-2 py-1 px-2 rounded-sm',
                    'hover:bg-sidebar-accent/50 transition-colors',
                    'group cursor-default'
                  )}
                  title={`${event.title}${event.description ? `\n${event.description}` : ''}`}
                >
                  {/* Calendar color indicator */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getEventColor(event.calendarName) }}
                  />
                  
                  {/* Event time */}
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {event.allDay ? 'All day' : format(new Date(event.start), 'h:mm a')}
                  </span>
                  
                  {/* Event title */}
                  <span className="text-sm truncate flex-1 group-hover:text-sidebar-accent-foreground transition-colors">
                    {event.title}
                  </span>
                  
                  {/* Optional location indicator */}
                  {event.location && (
                    <div className="w-1 h-1 bg-muted-foreground/40 rounded-full flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Show count if there are more events */}
        {allEvents.length > maxEvents && (
          <div className="text-center pt-2">
            <span className="text-xs text-muted-foreground">
              +{allEvents.length - maxEvents} more events
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventOverview;