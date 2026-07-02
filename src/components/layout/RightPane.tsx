import { ReactNode, useCallback, useState, useRef, useEffect } from 'react';
import { CalendarView, CalendarViewType } from '../calendar';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import {
  useKeyboardShortcuts,
  type CalendarViewKey,
} from '@/hooks/useKeyboardShortcuts';
import { APP_EVENT_CALENDAR_TODAY } from '@/components/command/actions';
import { lazy, Suspense } from 'react';
const LazyConsolidatedCalendarHeader = lazy(async () => ({
  default: (await import('../calendar/ConsolidatedCalendarHeader'))
    .ConsolidatedCalendarHeader,
}));
const LazyEventCreationDialog = lazy(async () => ({
  default: (await import('../dialogs/EventCreationDialog')).EventCreationDialog,
}));
const LazyEventDisplayDialog = lazy(async () => ({
  default: (await import('../dialogs/EventDisplayDialog')).EventDisplayDialog,
}));
import type { CalendarEvent } from '@shared/types';
import type FullCalendar from '@fullcalendar/react';

interface RightPaneProps {
  children?: ReactNode;
  calendarRef?: React.RefObject<FullCalendar | null>;
}

export const RightPane = ({
  children,
  calendarRef: externalCalendarRef,
}: RightPaneProps) => {
  const internalCalendarRef = useRef<FullCalendar>(null);
  const calendarRef = externalCalendarRef || internalCalendarRef;
  const [currentView, setCurrentView] =
    useState<CalendarViewType>('timeGridWeek');
  const { calendarSubView, setCalendarSubView } = useSettingsStore();

  // Initialize calendar sub-view from settings on mount and when settings change
  useEffect(() => {
    if (calendarSubView && calendarSubView !== currentView) {
      setCurrentView(calendarSubView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarSubView]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [displayDialogOpen, setDisplayDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [initialEventData, setInitialEventData] = useState<
    Partial<CalendarEvent> | undefined
  >();

  // Cmd+K / global-shortcut bridges (design-brief §4.6):
  // uiStore.openEventModal() opens the create dialog even when this pane
  // mounts after the command ran; the today event jumps a live calendar.
  const eventModalOpen = useUIStore((s) => s.eventModalOpen);
  const closeEventModal = useUIStore((s) => s.closeEventModal);
  useEffect(() => {
    if (eventModalOpen) {
      setInitialEventData(undefined);
      setCreateDialogOpen(true);
      closeEventModal();
    }
  }, [eventModalOpen, closeEventModal]);

  useEffect(() => {
    const onToday = () => {
      calendarRef.current?.getApi()?.today();
    };
    window.addEventListener(APP_EVENT_CALENDAR_TODAY, onToday);
    return () => window.removeEventListener(APP_EVENT_CALENDAR_TODAY, onToday);
  }, [calendarRef]);

  /**
   * Handle event click from calendar
   */
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setDisplayDialogOpen(true);
  }, []);

  /**
   * Handle event creation from calendar (when user clicks on a date/time slot)
   */
  const handleEventCreate = useCallback((event: Partial<CalendarEvent>) => {
    setInitialEventData(event);
    setCreateDialogOpen(true);
  }, []);

  /**
   * Handle create event button click from header
   */
  const handleCreateEvent = useCallback(() => {
    setInitialEventData(undefined);
    setCreateDialogOpen(true);
  }, []);

  /**
   * Handle editing an event from the display dialog
   */
  const handleEditEvent = useCallback(
    (event: CalendarEvent) => {
      setInitialEventData(event);
      setDisplayDialogOpen(false);
      setCreateDialogOpen(true);
    },
    [setCreateDialogOpen, setDisplayDialogOpen, setInitialEventData]
  );

  /**
   * Handle calendar view change
   */
  const handleViewChange = useCallback(
    (view: CalendarViewType) => {
      setCurrentView(view);
      try {
        setCalendarSubView(view);
      } catch {
        // Ignore settings persistence failures
      }
    },
    [setCalendarSubView, setCurrentView]
  );

  /**
   * Navigate to today
   */
  const handleTodayClick = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.today();
  }, [calendarRef]);

  /**
   * Navigate to previous period
   */
  const handlePrevClick = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.prev();
  }, [calendarRef]);

  /**
   * Navigate to next period
   */
  const handleNextClick = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.next();
  }, [calendarRef]);

  /**
   * Single-key calendar shortcuts: T today, D/W/M/L views, arrows navigate
   * (design-brief §4.4). Keyboard nav never animates (§5).
   */
  const handleViewKey = useCallback(
    (key: CalendarViewKey) => {
      const viewByKey: Record<CalendarViewKey, CalendarViewType> = {
        D: 'timeGridDay',
        W: 'timeGridWeek',
        M: 'dayGridMonth',
        L: 'listWeek',
      };
      handleViewChange(viewByKey[key]);
    },
    [handleViewChange]
  );

  useKeyboardShortcuts({
    onToday: handleTodayClick,
    onViewKey: handleViewKey,
    onPrev: handlePrevClick,
    onNext: handleNextClick,
  });

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden right-pane-container">
      {/* Consolidated Calendar Header */}
      <Suspense fallback={null}>
        <LazyConsolidatedCalendarHeader
          currentView={currentView}
          onViewChange={handleViewChange}
          onTodayClick={handleTodayClick}
          onPrevClick={handlePrevClick}
          onNextClick={handleNextClick}
          onCreateEvent={handleCreateEvent}
          calendarRef={calendarRef}
        />
      </Suspense>

      {/* Calendar Content - Full Integration */}
      <div className="flex-1 min-h-0" style={{ overscrollBehavior: 'none' }}>
        <CalendarView
          onEventClick={handleEventClick}
          onEventCreate={handleEventCreate}
          currentView={currentView}
          onViewChange={handleViewChange}
          onTodayClick={handleTodayClick}
          onPrevClick={handlePrevClick}
          onNextClick={handleNextClick}
          calendarRef={calendarRef}
          className="h-full"
        />
      </div>

      {/* Custom children content */}
      {children}

      {/* Event Creation Dialog */}
      <Suspense fallback={null}>
        <LazyEventCreationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          initialEventData={initialEventData}
        />
      </Suspense>

      {/* Event Display Dialog */}
      <Suspense fallback={null}>
        <LazyEventDisplayDialog
          open={displayDialogOpen}
          onOpenChange={setDisplayDialogOpen}
          event={selectedEvent}
          onEdit={handleEditEvent}
        />
      </Suspense>
    </div>
  );
};
