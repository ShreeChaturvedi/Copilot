import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
// Import FullCalendar core & plugin styles so grid lines and headers render correctly

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  DateSelectArg,
  EventClickArg,
  EventChangeArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core';
import { clsx } from 'clsx';

import './calendar.css';

import { useEvents, useUpdateEvent, useSwipeDetection } from '../../hooks';
import { useCalendars } from '../../hooks';
import type { CalendarEvent } from '@shared/types';
import { toLocal } from '../../utils/date';
import { chipTextPasses } from '../../utils/chipColor';
import { expandOccurrences } from '@/utils/recurrence';
import { useSidebar } from '@/components/ui/sidebar';
import { useCalendarSettingsStore } from '@/stores/calendarSettingsStore';
import { useThemeStore } from '@/stores/themeStore';
import { UpcomingEmptyState } from '@/components/tasks/UpcomingTasksEmpty';
import { Button } from '@/components/ui/Button';
import { toUserMessage } from '@/utils/errorMessages';

/** Mono chip time, 24h zero-padded per the §3 numeral law ("09:30"). */
const fmtChipTime = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * New-chip tracking for the §4.4 enter animation (scale .97 + fade + rim
 * flash). Module-level so the `key={slotMinTime}` remounts and view unmounts
 * never replay it: only events created AFTER the initial load animate.
 * Seen-ness is keyed on the MASTER event id (not per-occurrence ids) and
 * seeded from every fetched event, so recurring occurrences first revealed
 * by date navigation never read as "new" — the flash fires once, at create.
 * Optimistic temp events register a title+start signature so the real event
 * that replaces them does not flash twice.
 */
const seenMasterIds = new Set<string>();
const seenChipSigs = new Set<string>();
let chipsPrimed = false;

/**
 * Calendar view types
 */
export type CalendarViewType =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek';

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

  // Handle sidebar state changes. FullCalendar's liquid layout already tracks
  // its container as CSS animates the width; forcing updateSize() ~30x via a
  // 7ms interval was pure layout thrash (#21/#26). One settle as the transition
  // begins and one after it completes (timeout ~= the 200ms sidebar duration)
  // is enough. The now-overlay is re-anchored by its own effect below (#19).
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;

    // Immediately update size as the transition begins
    requestAnimationFrame(() => calendarApi.updateSize());

    // Final settle once the sidebar transition completes
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => calendarApi.updateSize());
    }, 230);

    return () => {
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
  const visibleCalendars = useMemo(
    () => calendars.filter((cal) => cal.visible),
    [calendars]
  );
  const visibleCalendarNames = useMemo(
    () => visibleCalendars.map((cal) => cal.name),
    [visibleCalendars]
  );
  // Track default calendar color for consistent preview styling
  const defaultCalendar = useMemo(
    () => calendars.find((cal) => cal.isDefault) || visibleCalendars[0],
    [calendars, visibleCalendars]
  );

  // Stable filters reference so useEvents' internal filter memo only busts when
  // the visible calendar set actually changes (#8/#23/#34).
  const eventFilters = useMemo(
    () => ({ calendarNames: visibleCalendarNames }),
    [visibleCalendarNames]
  );

  const {
    data: events = [],
    isSuccess: eventsFetched,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents(eventFilters, {
    enabled: visibleCalendarNames.length > 0 && !calendarsLoading,
  });

  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const updateEventMutation = useUpdateEvent();

  // Combined ref for both drag & drop and gesture handling
  const combinedRef = useRef<HTMLDivElement>(null);

  // Debounce revert explanations so a rapid drag doesn't stack toasts.
  const lastRevertToast = useRef(0);
  const noteRevert = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastRevertToast.current < 1200) return;
    lastRevertToast.current = now;
    toast.info(message);
  }, []);

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
  const handleEventReceive = useCallback(
    (info: {
      event: {
        start: Date | null;
        extendedProps: {
          isFromTask?: boolean;
          originalTask?: { id?: string; title: string; scheduledDate?: Date };
        };
        remove: () => void;
      };
    }) => {
      // Get the drop date/time from FullCalendar
      const dropDate = info.event.start;
      const eventData = info.event.extendedProps;

      if (
        dropDate &&
        eventData?.isFromTask &&
        eventData?.originalTask &&
        onEventCreate
      ) {
        // Find default calendar or first visible calendar
        const defaultCalendar =
          calendars.find((cal) => cal.isDefault) || visibleCalendars[0];

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
    },
    [calendars, visibleCalendars, onEventCreate]
  );

  /**
   * Convert CalendarEvent to FullCalendar EventInput format
   */
  const transformEventsForCalendar = useCallback(
    (events: CalendarEvent[]): EventInput[] => {
      // One Map lookup per event instead of an O(events x calendars) find.
      const calendarByName = new Map(calendars.map((cal) => [cal.name, cal]));
      return events.map((event) => {
        const calendar = calendarByName.get(event.calendarName || '');

        const occurrenceStart = event.occurrenceInstanceStart ?? event.start;
        const occurrenceEnd = event.occurrenceInstanceEnd ?? event.end;

        // Ensure each rendered occurrence gets a unique id to avoid identity collisions in FullCalendar
        const instanceKey = new Date(occurrenceStart).toISOString();
        const eventId = `${event.id}::${instanceKey}`;

        // §4.4 enter flash: only events created this session. Keyed on the
        // master id so range-revealed recurring occurrences never re-flash.
        const chipSig = `${event.title}|${instanceKey}`;
        const isNewChip =
          chipsPrimed &&
          !seenMasterIds.has(event.id) &&
          !seenChipSigs.has(chipSig);

        return {
          id: eventId,
          groupId: event.id, // stable master/series id
          title: event.title,
          start: toLocal(occurrenceStart),
          end: toLocal(occurrenceEnd),
          allDay: event.allDay || false,
          // Disable drag/resize for optimistic temp events to avoid 404 updates
          editable: !String(event.id).startsWith('temp-'),
          // Chip visuals are token-driven (§2.4 alpha-film formula in
          // calendar.css keyed off --chip-c) — no inline colors here.
          extendedProps: {
            description: event.description,
            location: event.location,
            notes: event.notes,
            calendarName: event.calendarName,
            originalEvent: event,
            chipColor: event.color || calendar?.color || undefined,
            isNewChip,
          },
        };
      });
    },
    [calendars]
  );

  /**
   * §4.4 now-line assembly (JS-positioned parts). FullCalendar draws the 2px
   * aqua line in today's column; this overlay adds the live gutter time chip
   * and the 1px 20% ghost across the other visible days. One interval, and
   * per-minute updates drive `transform: translateY` only.
   */
  const nowOverlayRef = useRef<HTMLDivElement | null>(null);

  const updateNowOverlay = useCallback(() => {
    const root = combinedRef.current;
    if (!root) return;
    const body = root.querySelector<HTMLElement>('.fc-timegrid-body');
    const line = root.querySelector<HTMLElement>(
      '.fc-timegrid-now-indicator-line'
    );
    if (!body || !line) {
      nowOverlayRef.current?.remove();
      nowOverlayRef.current = null;
      // Clear any hour label the overlay was occluding on the previous range.
      // FullCalendar reuses the static time-axis DOM across navigation, so a
      // label hidden while today was visible would otherwise stay hidden on a
      // range that has no now-line (#22). Query from root — body is null here.
      root
        .querySelectorAll<HTMLElement>('.fc-timegrid-slot-label-cushion')
        .forEach((el) => {
          el.style.visibility = '';
        });
      return;
    }
    let overlay = nowOverlayRef.current;
    if (!overlay || !overlay.isConnected || overlay.parentElement !== body) {
      overlay?.remove();
      overlay = document.createElement('div');
      overlay.className = 'now-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML =
        '<div class="now-ghost"></div><div class="now-chip"><span></span></div>';
      body.appendChild(overlay);
      nowOverlayRef.current = overlay;
    }
    const ghost = overlay.firstElementChild as HTMLElement;
    const chip = overlay.lastElementChild as HTMLElement;
    const bodyRect = body.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const y = lineRect.top - bodyRect.top + 1; // center of the 2px line
    const axis = body.querySelector<HTMLElement>('td.fc-timegrid-slot-label');
    const axisW = axis ? axis.offsetWidth : 48;
    ghost.style.left = `${axisW}px`;
    ghost.style.transform = `translateY(${y}px)`;
    chip.style.width = `${axisW}px`;
    chip.style.transform = `translateY(${y}px) translateY(-50%)`;
    (chip.firstElementChild as HTMLElement).textContent = fmtChipTime(
      new Date()
    );
    // The chip occludes the nearest hour label instead of colliding with it.
    body
      .querySelectorAll<HTMLElement>('.fc-timegrid-slot-label-cushion')
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        const centerY = r.top + r.height / 2 - bodyRect.top;
        el.style.visibility = Math.abs(centerY - y) < 14 ? 'hidden' : '';
      });
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(updateNowOverlay);
    const id = setInterval(updateNowOverlay, 60_000);
    // Re-anchor on window resize so the gutter chip/ghost don't sit at a stale
    // x/y offset until the next minute tick (#19).
    const onResize = () => requestAnimationFrame(updateNowOverlay);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      window.removeEventListener('resize', onResize);
      nowOverlayRef.current?.remove();
      nowOverlayRef.current = null;
    };
  }, [updateNowOverlay, currentView]);

  // Re-anchor the now-overlay after a sidebar collapse/expand settles (the
  // container width animates over ~200ms, so run just past that) — #19.
  useEffect(() => {
    const id = setTimeout(() => requestAnimationFrame(updateNowOverlay), 240);
    return () => clearTimeout(id);
  }, [sidebarState, updateNowOverlay]);

  /**
   * Handle date selection for creating new events
   */
  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      const { start, end, allDay } = selectInfo;
      const viewType = selectInfo.view?.type ?? '';
      const sameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();

      // Enforce: timed selections in time grid must remain within a single day
      if (viewType.startsWith('timeGrid') && !allDay && !sameDay) {
        noteRevert('Timed events must stay within one day.');
        selectInfo.view.calendar.unselect();
        return;
      }

      // Find default calendar or first visible calendar
      const defaultCalendar =
        calendars.find((cal) => cal.isDefault) || visibleCalendars[0];

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
    },
    [calendars, visibleCalendars, onEventCreate, noteRevert]
  );

  /**
   * Handle event click
   */
  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const originalEvent = clickInfo.event.extendedProps
        .originalEvent as CalendarEvent;
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
    },
    [onEventClick]
  );

  /**
   * Handle event drag/resize
   */
  const handleEventChange = useCallback(
    async (changeInfo: EventChangeArg) => {
      const { event } = changeInfo;
      const originalEvent = event.extendedProps.originalEvent as CalendarEvent;

      try {
        // For recurring series occurrence, revert and encourage editing via dialog
        if (originalEvent.recurrence) {
          noteRevert('Edit recurring events from the event details.');
          changeInfo.revert();
          return;
        }
        // Enforce: timed events cannot span multiple days
        const start = event.start!;
        const end = event.end!;
        const allDay = event.allDay;
        const sameDay =
          start.getFullYear() === end.getFullYear() &&
          start.getMonth() === end.getMonth() &&
          start.getDate() === end.getDate();
        if (!allDay && !sameDay) {
          noteRevert('Timed events must stay within one day.');
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
    },
    [updateEventMutation, noteRevert]
  );

  // Setup simple swipe detection. Memoize the input so onWheel keeps a stable
  // identity and the wheel listener effect binds once instead of every render
  // (#1/#7).
  const swipeInput = useMemo(
    () => ({
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
      },
    }),
    [onNextClick, onPrevClick, calendarRef]
  );
  const swipeHandlers = useSwipeDetection(swipeInput);

  // Connect refs and apply wheel listener
  useEffect(() => {
    if (combinedRef.current) {
      // Add wheel event listener for trackpad
      const element = combinedRef.current;
      element.addEventListener('wheel', swipeHandlers.onWheel, {
        passive: false,
      });

      return () => {
        element.removeEventListener('wheel', swipeHandlers.onWheel);
      };
    }
  }, [swipeHandlers.onWheel]);

  // Range-bounded expansion of recurring series
  const [visibleRange, setVisibleRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Recurrence expansion is memoized on [events, visibleRange] so it only
  // re-runs when data or the visible window actually changes — not on every
  // sidebar/theme/isMobile re-render (#1/#6/#11/#15/#25).
  const expandedEvents: CalendarEvent[] = useMemo(() => {
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
  }, [events, visibleRange]);

  // Stable events reference for FullCalendar: only re-diffs when the expanded
  // set or the transform (calendars) changes, not on unrelated re-renders.
  const calendarEvents = useMemo(
    () => transformEventsForCalendar(expandedEvents),
    [transformEventsForCalendar, expandedEvents]
  );

  // Mark events as seen AFTER commit (keeps the transform pure and survives
  // StrictMode double-renders). Master ids are seeded from the FULL fetched
  // list — not just rendered occurrences — so navigating to a range that
  // reveals fresh occurrence ids never replays the §4.4 enter flash; prime
  // once the first fetch lands so the initial event load never animates.
  useEffect(() => {
    for (const ev of events) seenMasterIds.add(ev.id);
    for (const ev of calendarEvents) {
      const sig = `${ev.title}|${ev.id?.split('::')[1] ?? ''}`;
      if (String(ev.id).startsWith('temp-')) seenChipSigs.add(sig);
    }
    if (eventsFetched) chipsPrimed = true;
  }, [events, calendarEvents, eventsFetched]);

  const { getSlotTimes, weekStartsOn } = useCalendarSettingsStore();
  const { slotMinTime, slotMaxTime } = getSlotTimes();

  // Force calendar to re-render when slot times change by keying the component
  const calendarKey = `${slotMinTime}-${slotMaxTime}`;

  return (
    <div
      className={clsx('h-full flex flex-col bg-card', className)}
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Calendar Content */}
      <div
        ref={combinedRef}
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        className={clsx(
          'flex-1 relative bg-card transition-colors duration-[var(--dur-3)]'
        )}
        style={{ overscrollBehavior: 'none' }}
      >
        <div className="h-full" style={{ overscrollBehavior: 'none' }}>
          <FullCalendar
            key={calendarKey}
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              listPlugin,
              interactionPlugin,
            ]}
            initialView={currentView}
            firstDay={weekStartsOn}
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
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }}
            slotLabelContent={(arg) => {
              const hours24 = arg.date.getHours();
              const minutes = arg.date.getMinutes();
              const isNoon = hours24 === 12 && minutes === 0;
              // Replace 12:00 PM with NOON in week view
              if (arg.view?.type?.startsWith('timeGrid') && isNoon) {
                return 'NOON';
              }
              // Whole hours read `9 AM` — one register, 11px mono --faint
              // (§4.4 gutter); styling lives in calendar.css.
              if (minutes === 0) {
                const hour12 = (hours24 % 12 || 12).toString();
                return `${hour12} ${hours24 < 12 ? 'AM' : 'PM'}`;
              }
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
              // Re-anchor the now-line overlay once the new view DOM exists
              setTimeout(updateNowOverlay, 50);
            }}
            themeSystem="standard"
            dayCellClassNames="cursor-pointer"
            eventClassNames={(arg) => {
              const classes = ['cursor-pointer'];
              const xp = (
                arg.event as unknown as {
                  extendedProps?: {
                    isFromTask?: boolean;
                    chipColor?: string;
                    isNewChip?: boolean;
                  };
                }
              ).extendedProps;
              // Only mark external task mirrors as preview to style with default calendar color
              if (arg.isMirror && xp?.isFromTask) {
                classes.push('fc-event-preview');
              }
              // §4.4 settle-in for chips created this session
              if (xp?.isNewChip && !arg.isMirror) {
                classes.push('chip-enter');
              }
              // §9.3.3 contrast guard for legacy stored colors
              if (
                xp?.chipColor &&
                !chipTextPasses(xp.chipColor, resolvedTheme)
              ) {
                classes.push('chip-guard');
              }
              return classes;
            }}
            eventDidMount={(info) => {
              // Feed the stored calendar/event color into the §2.4 film
              // formula; CSS falls back to --default-calendar-color.
              const c = (
                info.event.extendedProps as { chipColor?: string } | undefined
              )?.chipColor;
              if (c) info.el.style.setProperty('--chip-c', c);

              // Make chips keyboard-operable (#10): FullCalendar renders them
              // as non-interactive elements, so Tab/Enter never reached them
              // and the .fc-event:focus-visible ring in calendar.css was dead.
              const el = info.el;
              el.tabIndex = 0;
              el.setAttribute('role', 'button');
              const title = info.event.title || 'Untitled event';
              el.setAttribute(
                'aria-label',
                info.event.allDay || !info.event.start
                  ? title
                  : `${title}, ${fmtChipTime(info.event.start)}`
              );
              const onKey = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  // Reuse the exact eventClick path (opens the detail view).
                  el.click();
                }
              };
              el.addEventListener('keydown', onKey);
            }}
            eventContent={(arg: EventContentArg) => {
              const viewType = arg.view?.type ?? '';
              // List view keeps FullCalendar's row anatomy (time and dot
              // cells render outside this hook); only the title is ours.
              if (viewType.startsWith('list')) {
                return (
                  <span className="chip-list-title">
                    {arg.event.title || '(untitled)'}
                  </span>
                );
              }
              const { start, end, allDay } = arg.event;
              const durationMin =
                start && end
                  ? Math.round((end.getTime() - start.getTime()) / 60000)
                  : null;
              const isShort =
                !allDay && durationMin !== null && durationMin < 30;
              const oneLine = isShort || viewType === 'dayGridMonth';
              return (
                <div className={clsx('chip-body', oneLine && 'chip-oneline')}>
                  {!allDay && start && (
                    <span className="chip-time">{fmtChipTime(start)}</span>
                  )}
                  <span className="chip-title">
                    {arg.event.title || '(untitled)'}
                  </span>
                  {/* §4.4 dimension annotations: the data model drawn under
                      the cursor. Drag = duration beside the chip; resize =
                      live start/end pinned to the chip edges. */}
                  {arg.isMirror && arg.isDragging && !allDay && durationMin ? (
                    <span className="dim-note" aria-hidden="true">
                      {durationMin} MIN
                    </span>
                  ) : null}
                  {arg.isResizing && !allDay && start && end ? (
                    <>
                      <span
                        className="dim-time dim-time-start"
                        aria-hidden="true"
                      >
                        {fmtChipTime(start)}
                      </span>
                      <span
                        className="dim-time dim-time-end"
                        aria-hidden="true"
                      >
                        {fmtChipTime(end)}
                      </span>
                    </>
                  ) : null}
                </div>
              );
            }}
            noEventsContent={() => (
              <UpcomingEmptyState
                voice="The list is clear."
                note="No events in this range."
              />
            )}
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
            displayEventEnd={false}
            /* Grid chips encode duration by height, so they stay start-only;
               the list view is a scannable agenda and shows the full start–end
               range so a 30-min sync reads differently from a 3-hour block. */
            views={{ listWeek: { displayEventEnd: true } }}
            eventTimeFormat={{
              // List-view time cells (grid chips format their own time):
              // 24h mono per the §3 numeral law.
              hour: '2-digit',
              minute: '2-digit',
              omitZeroMinute: false,
              hour12: false,
            }}
            dayHeaderContent={(args) => {
              const viewType = args.view?.type ?? '';
              // Month view: FullCalendar passes SYNTHETIC reference dates for
              // dayGridMonth headers (their UTC weekday matches the column but
              // local getters shift them, mislabeling every column and
              // printing meaningless day numbers — issue #43). Render only
              // FC's own per-column weekday text; the grid cells carry dates.
              if (viewType === 'dayGridMonth') {
                return (
                  <div className="day-header-container">
                    <span className="day-header-name">
                      {args.text.toUpperCase()}
                    </span>
                  </div>
                );
              }
              // timeGrid views pass real column dates; local getters are safe.
              const shortWeekdayUpper = args.date
                .toLocaleDateString('en-US', { weekday: 'short' })
                .toUpperCase();
              const dayNumber = args.date.getDate();
              const isToday = args.isToday;
              return (
                <div className="day-header-container">
                  <span className="day-header-name">{shortWeekdayUpper}</span>
                  <span
                    className={`day-header-number ${isToday ? 'today' : ''}`}
                  >
                    {dayNumber}
                  </span>
                </div>
              );
            }}
          />
        </div>

        {/* A failed events fetch must never read as an empty calendar. Surface
            a tokenized error panel with a retry path over the grid (#2/#5/#12/
            #13). Takes precedence over the empty/loading affordances. */}
        {eventsError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div
              className="flex max-w-xs flex-col items-center gap-3 border border-border bg-popover px-6 py-5 text-center"
              style={{
                borderRadius: 'var(--radius-card, 10px)',
                boxShadow: 'var(--shadow-2)',
              }}
            >
              <p className="font-serif text-base text-foreground">
                Couldn&apos;t load events.
              </p>
              <p className="text-sm text-muted-foreground">
                {toUserMessage(eventsError, 'Something went wrong.')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchEvents()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : !calendarsLoading && visibleCalendars.length === 0 ? (
          /* Every calendar toggled off — say so instead of a blank grid (#29). */
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              All calendars are hidden. Enable one in the sidebar to see your
              events.
            </p>
          </div>
        ) : eventsLoading && events.length === 0 ? (
          /* Cold fetch: a quiet loading cue so the empty grid doesn't read as
             "no events" before the data lands (#12). */
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <p className="animate-pulse text-sm text-muted-foreground">
              Loading events…
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
