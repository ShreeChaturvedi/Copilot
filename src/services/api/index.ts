// API service exports
export { taskApi } from './tasks';
export { eventApi } from './events';
export { calendarApi, DEFAULT_CALENDAR_COLORS } from './calendars';
export { attachmentsApi } from './attachments';
export { userAPI } from './user';

export type {
  CreateTaskData,
  UpdateTaskData,
} from './tasks';

export type {
  UserProfileData,
  UpdateProfileData,
  UserPreferences,
} from './user';

export type {
  CreateEventData,
  UpdateEventData,
  EventConflict,
} from './events';

export type {
  CreateCalendarData,
  UpdateCalendarData,
} from './calendars';
