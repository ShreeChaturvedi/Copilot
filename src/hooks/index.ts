// Custom hooks exports
export {
  useTasks,
  useAllTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
  useScheduleTask,
  taskQueryKeys,
} from './useTasks';

export {
  useEvents,
  useAllEvents,
  useEvent,
  useEventsByCalendar,
  useEventsByDateRange,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  eventQueryKeys,
} from './useEvents';

export {
  useCalendars,
  useAllCalendars,
  useVisibleCalendars,
  useCalendar,
  useDefaultCalendar,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  useToggleCalendarVisibility,
  useSetDefaultCalendar,
  calendarQueryKeys,
  DEFAULT_CALENDAR_COLORS,
} from './useCalendars';

export type {
  TaskFilters,
} from './useTasks';

export type {
  EventFilters,
} from './useEvents';

export type {
  CalendarFilters,
} from './useCalendars';

export {
  useSwipeDetection,
} from './useSwipeDetection';

// Re-export API types
export type {
  CreateTaskData,
  UpdateTaskData,
  CreateEventData,
  UpdateEventData,
  CreateCalendarData,
  UpdateCalendarData,
} from '../services/api';
