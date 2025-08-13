// API service exports
export { taskApi } from './tasks';
export { eventApi } from './events';
export { calendarApi, DEFAULT_CALENDAR_COLORS } from './calendars';
export { attachmentsApi } from './attachments';

export type {
  CreateTaskData,
  UpdateTaskData,
} from './tasks';

export type {
  CreateEventData,
  UpdateEventData,
} from './events';

export type {
  CreateCalendarData,
  UpdateCalendarData,
} from './calendars';
