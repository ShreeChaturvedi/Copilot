import React, { memo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useCalendars } from '@/hooks/useCalendars';
import { type CalendarEvent } from '@shared/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { groupItemsByDate, filterUpcomingItems } from '@/utils/dateGrouping';
import { expandOccurrences } from '@/utils/recurrence';
import { UpcomingEmptyState } from '@/components/tasks/UpcomingTasksEmpty';

// How far ahead the sidebar expands recurring series to surface their next
// occurrences, in days.
const UPCOMING_EXPANSION_DAYS = 90;

// Stable empty filters reference so useEvents' internal filter memo isn't
// busted by a fresh `{}` literal on every render (#34).
const EMPTY_FILTERS = {} as const;

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
  const {
    data: allEvents = [],
    isLoading,
    error,
    refetch,
  } = useEvents(EMPTY_FILTERS, { enabled: true });

  // Filter events to get visible calendar events only. Memoized so a fresh
  // array identity never busts the recurring-expansion memo below every render.
  const visibleCalendarNames = React.useMemo(
    () => calendars.filter((cal) => cal.visible).map((cal) => cal.name),
    [calendars]
  );

  // Compute all upcoming events (not truncated) for accurate totals
  const upcomingEventsAll = React.useMemo(() => {
    const visible = allEvents.filter((event) =>
      visibleCalendarNames.includes(event.calendarName || '')
    );
    // Expand recurring series into their occurrences within the window so a
    // series whose master start is in the past still shows upcoming instances
    // (#40). Non-recurring events pass through unchanged.
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + UPCOMING_EXPANSION_DAYS * 24 * 60 * 60 * 1000
    );
    const expanded: CalendarEvent[] = [];
    for (const event of visible) {
      if (event.recurrence) {
        for (const occ of expandOccurrences(event, now, windowEnd)) {
          expanded.push({
            ...event,
            id: `${event.id}::${occ.start.toISOString()}`,
            start: occ.start,
            end: occ.end,
          });
        }
      } else {
        expanded.push(event);
      }
    }
    return filterUpcomingItems(
      expanded,
      (e: CalendarEvent) => new Date(e.start)
    );
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
    const totals = groupItemsByDate(
      upcomingEventsAll,
      (e) => new Date(e.start)
    );
    return Object.keys(totals).reduce<Record<string, number>>((acc, key) => {
      acc[key] = totals[key].length;
      return acc;
    }, {});
  }, [upcomingEventsAll]);

  // Get calendar color for an event. An unresolved calendar is a genuinely
  // different state than "no color chosen" (foundation-spec §5C) — it falls
  // back to neutral ink, not a stale brand hue.
  const getEventColor = (calendarName: string) => {
    const calendar = calendars.find((cal) => cal.name === calendarName);
    return calendar?.color || 'var(--ink-muted)';
  };

  // Loading: skeleton rows shaped like the real anatomy (dot / time / title)
  // so a cold load never flashes the empty state before the fetch resolves.
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-btn px-3 py-2"
          >
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  // A failed fetch must never read as a calm "all clear" — surface a distinct
  // error state with a retry path instead of the aqua caught-up art (#5/#13).
  if (error) {
    return (
      <div className={cn('space-y-3 px-3 py-4 text-center', className)}>
        <p className="text-sm font-medium text-sidebar-foreground">
          Couldn&apos;t load events.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            'inline-flex items-center rounded-btn border border-sidebar-border px-3 py-1.5',
            'text-xs font-medium text-sidebar-foreground',
            'transition-colors duration-150 ease-out hover:bg-surface-hover',
            'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'
          )}
        >
          Try again
        </button>
      </div>
    );
  }

  // If no events, show the shared §4.7 schedule-empty state (matches the
  // upcoming tasks list so the two sidebar lists read as one system).
  if (upcomingEvents.length === 0) {
    return (
      <div className={cn(className)}>
        <UpcomingEmptyState
          voice="The calendar's clear."
          note="Upcoming events appear here once you add them."
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="flex items-center gap-2 pb-1">
          <CalendarIcon className="w-4 h-4 text-sidebar-foreground" />
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
              <Badge
                variant="outline"
                className="text-xs h-5 font-mono tabular-nums"
              >
                {groupedEventTotals[dayKey] ?? events.length}
              </Badge>
            </div>

            {/* Events for this day. A real <button>: keyboard-focusable and
                honestly inert (no onClick — no sidebar context currently
                owns an event-display surface to open on click, see
                calendar.md §2.2/§5 item 5). Hover/focus read as "scannable
                row", not "this navigates". */}
            <div className="space-y-1">
              {events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-btn py-2 pl-3 pr-3 text-left',
                    'transition-colors duration-150 ease-out',
                    'hover:bg-surface-hover',
                    'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'
                  )}
                  style={
                    {
                      '--chip-c': getEventColor(event.calendarName || ''),
                    } as React.CSSProperties
                  }
                  title={`${event.title}${event.description ? `\n${event.description}` : ''}${event.location ? `\n📍 ${event.location}` : ''}`}
                >
                  {/* Calendar color indicator — the same --chip-c convention
                      CalendarView's eventDidMount uses, one mechanism for
                      "this event's color" across the whole area. */}
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--chip-c)' }}
                    aria-hidden="true"
                  />

                  {/* Event time — mono + tabular-nums, matching calendar.css's
                      own .chip-time treatment of the identical data. */}
                  <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                    {event.allDay
                      ? 'All day'
                      : format(new Date(event.start), 'h:mm a')}
                  </span>

                  {/* Event title */}
                  <span className="flex-1 truncate text-sm font-medium text-sidebar-foreground/90 group-hover:text-sidebar-foreground">
                    {event.title}
                  </span>

                  {/* Optional location indicator */}
                  {event.location && (
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-faint transition-colors group-hover:bg-ink-muted"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Show count if there are more events */}
        {upcomingEventsAll.length > maxEvents && (
          <div className="text-center pt-3 mt-4 border-t border-sidebar-border/50">
            <span className="text-xs font-medium text-ink-muted tracking-wide tabular-nums">
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
