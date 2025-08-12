import React, { memo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useCalendars } from '@/hooks/useCalendars';
import { type CalendarEvent } from "@shared/types";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { groupItemsByDate, filterUpcomingItems } from '@/utils/dateGrouping';

interface EventOverviewProps {
  maxEvents?: number;
  className?: string;
  showHeader?: boolean;
}

interface GroupedEvents {
  [key: string]: CalendarEvent[];
}

const EventOverviewComponent: React.FC<EventOverviewProps> = ({
  maxEvents = 5,
  className,
  showHeader = true,
}) => {
  const { data: calendars = [] } = useCalendars();
  const { data: allEvents = [] } = useEvents({}, { enabled: true });

  // Filter events to get visible calendar events only
  const visibleCalendarNames = calendars
    .filter((cal) => cal.visible)
    .map((cal) => cal.name);

  // Compute all upcoming events (not truncated) for accurate totals
  const upcomingEventsAll = React.useMemo(() => {
    const visible = allEvents.filter((event) =>
      visibleCalendarNames.includes(event.calendarName || '')
    );
    return filterUpcomingItems(visible, (e: CalendarEvent) => new Date(e.start));
  }, [allEvents, visibleCalendarNames]);

  // Apply display limit for the overview list
  const upcomingEvents = React.useMemo(() => {
    return upcomingEventsAll.slice(0, maxEvents);
  }, [upcomingEventsAll, maxEvents]);

  // Group events by day
  // Group displayed events for rendering (preserve chronological insertion order)
  const groupedEvents: GroupedEvents = React.useMemo(() => {
    return groupItemsByDate(upcomingEvents, (e) => new Date(e.start));
  }, [upcomingEvents]);

  // Group all upcoming events to compute accurate totals per day key
  const groupedEventTotals: Record<string, number> = React.useMemo(() => {
    const totals = groupItemsByDate(upcomingEventsAll, (e) => new Date(e.start));
    return Object.keys(totals).reduce<Record<string, number>>((acc, key) => {
      acc[key] = totals[key].length;
      return acc;
    }, {});
  }, [upcomingEventsAll]);

  // Get calendar color for an event
  const getEventColor = (calendarName: string) => {
    const calendar = calendars.find((cal) => cal.name === calendarName);
    return calendar?.color || '#6366f1';
  };

  // If no events, show empty state
  if (upcomingEvents.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {showHeader && (
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-sidebar-foreground" />
            <h3 className="text-sm font-semibold text-sidebar-foreground">
              Upcoming Events
            </h3>
          </div>
        )}

        <div className="text-center py-4 text-muted-foreground">
          <CalendarIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No upcoming events</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="flex items-center gap-2 pb-1">
          <CalendarIcon className="w-4 h-4 text-sidebar-foreground opacity-80" />
          <h3 className="text-sm font-semibold text-sidebar-foreground tracking-wide">
            Upcoming Events
          </h3>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedEvents).map(([dayKey, events]) => (
          <div key={dayKey} className="space-y-2">
            {/* Day heading with improved styling */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {dayKey}
              </span>
              <Badge variant="outline" className="text-xs h-5">
                {groupedEventTotals[dayKey] ?? events.length}
              </Badge>
            </div>

            {/* Events for this day */}
            <div className="space-y-1">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-3 py-2 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200 ease-out group cursor-pointer',
                  )}
                  style={{
                    backgroundColor: `${getEventColor(event.calendarName || '')}1A`,
                    borderColor: `${getEventColor(event.calendarName || '')}30`,
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                  title={`${event.title}${event.description ? `\n${event.description}` : ''}${event.location ? `\n📍 ${event.location}` : ''}`}
                >
                  {/* Calendar color indicator with enhanced styling */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getEventColor(event.calendarName || '') }}
                    />
                  </div>

                  {/* Event time with better typography */}
                  <span className="text-xs font-medium text-muted-foreground flex-shrink-0 tracking-wide">
                    {event.allDay
                      ? 'All day'
                      : format(new Date(event.start), 'h:mm a')}
                  </span>

                  {/* Event title with improved hover effects */}
                  <span
                    className={cn(
                      'text-sm truncate flex-1 font-medium transition-colors duration-200',
                      'group-hover:text-sidebar-accent-foreground',
                      'text-sidebar-foreground/90 group-hover:text-sidebar-foreground'
                    )}
                  >
                    {event.title}
                  </span>

                  {/* Optional location indicator with modern styling */}
                  {event.location && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 bg-muted-foreground/50 rounded-full flex-shrink-0',
                        'group-hover:bg-sidebar-accent-foreground/60 transition-colors duration-200'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Show count if there are more events */}
        {upcomingEventsAll.length > maxEvents && (
          <div className="text-center pt-3 mt-4 border-t border-sidebar-border/50">
            <span className="text-xs font-medium text-muted-foreground/80 tracking-wide">
              +{upcomingEventsAll.length - maxEvents} more upcoming events
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom comparison function for EventOverview
const EventOverviewMemoComparison = (
  prevProps: EventOverviewProps,
  nextProps: EventOverviewProps
) => {
  // Compare primitive props
  if (prevProps.maxEvents !== nextProps.maxEvents) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (prevProps.showHeader !== nextProps.showHeader) return false;

  return true; // Props are equal, skip re-render
};

// Memoized EventOverview component - relies on TanStack Query cache invalidation
// for data changes rather than prop changes
export const EventOverview = memo(
  EventOverviewComponent,
  EventOverviewMemoComparison
);

export default EventOverview;
