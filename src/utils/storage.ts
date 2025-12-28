/**
 * Local storage utility functions with proper TypeScript typing
 */

import type {
  StorageSchema,
  Task,
  CalendarEvent,
  Calendar,
  AppSettings,
  GoogleAuthState,
} from '@shared/types';
import { parseISOToDate } from './date';

/**
 * Storage keys for different data types
 */
export const STORAGE_KEYS = {
  TASKS: 'calendar-app-tasks',
  EVENTS: 'calendar-app-events',
  CALENDARS: 'calendar-app-calendars',
  SETTINGS: 'calendar-app-settings',
  GOOGLE_AUTH: 'calendar-app-google-auth',
} as const;

/**
 * Default application settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  leftPaneWidth: 300,
  showCompletedTasks: true,
  defaultCalendar: 'Personal',
  showNotesEditor: false,
  dateDisplayMode: 'relative',
};

/**
 * Default calendars
 */
export const DEFAULT_CALENDARS: Calendar[] = [
  {
    name: 'Personal',
    color: '#3B82F6',
    visible: true,
    isDefault: true,
    description: 'Personal events and appointments',
  },
  {
    name: 'Work',
    color: '#EF4444',
    visible: true,
    isDefault: false,
    description: 'Work-related events and meetings',
  },
];

const cloneDefaultCalendars = (): Calendar[] =>
  DEFAULT_CALENDARS.map((calendar) => ({ ...calendar }));

/**
 * Check if localStorage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Safely parse JSON from localStorage
 */
const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from localStorage:', error);
    return fallback;
  }
};

/**
 * Safely stringify and store data
 */
const safeJsonStringify = (key: string, data: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Failed to save data to localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Convert stored date strings back to Date objects
 */
const reviveDates = <T>(obj: T, dateFields: (keyof T)[]): T => {
  const revived = { ...obj };

  for (const field of dateFields) {
    if (revived[field] && typeof revived[field] === 'string') {
      try {
        revived[field] = parseISOToDate(revived[field] as string) as T[keyof T];
      } catch (error) {
        console.warn(`Failed to parse date field ${String(field)}:`, error);
        delete revived[field];
      }
    }
  }

  return revived;
};

/**
 * Task storage functions
 */
export const taskStorage = {
  /**
   * Get all tasks from localStorage
   */
  getTasks: (): Task[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks = safeJsonParse(stored, [] as Task[]);

    // Convert date strings back to Date objects
    return tasks.map((task) =>
      reviveDates(task, ['createdAt', 'scheduledDate'])
    );
  },

  /**
   * Save tasks to localStorage
   */
  saveTasks: (tasks: Task[]): boolean => {
    return safeJsonStringify(STORAGE_KEYS.TASKS, tasks);
  },

  /**
   * Add a new task
   */
  addTask: (task: Task): boolean => {
    const tasks = taskStorage.getTasks();
    tasks.push(task);
    return taskStorage.saveTasks(tasks);
  },

  /**
   * Update an existing task
   */
  updateTask: (taskId: string, updates: Partial<Task>): boolean => {
    const tasks = taskStorage.getTasks();
    const index = tasks.findIndex((task) => task.id === taskId);

    if (index === -1) {
      console.warn(`Task with id ${taskId} not found`);
      return false;
    }

    tasks[index] = { ...tasks[index], ...updates };
    return taskStorage.saveTasks(tasks);
  },

  /**
   * Delete a task
   */
  deleteTask: (taskId: string): boolean => {
    const tasks = taskStorage.getTasks();
    const filteredTasks = tasks.filter((task) => task.id !== taskId);
    return taskStorage.saveTasks(filteredTasks);
  },
};

/**
 * Event storage functions
 */
export const eventStorage = {
  /**
   * Get all events from localStorage
   */
  getEvents: (): CalendarEvent[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const events = safeJsonParse(stored, [] as CalendarEvent[]);

    // Convert date strings back to Date objects
    return events.map((event) => reviveDates(event, ['start', 'end']));
  },

  /**
   * Save events to localStorage
   */
  saveEvents: (events: CalendarEvent[]): boolean => {
    return safeJsonStringify(STORAGE_KEYS.EVENTS, events);
  },

  /**
   * Add a new event
   */
  addEvent: (event: CalendarEvent): boolean => {
    const events = eventStorage.getEvents();
    events.push(event);
    return eventStorage.saveEvents(events);
  },

  /**
   * Update an existing event
   */
  updateEvent: (eventId: string, updates: Partial<CalendarEvent>): boolean => {
    const events = eventStorage.getEvents();
    const index = events.findIndex((event) => event.id === eventId);

    if (index === -1) {
      console.warn(`Event with id ${eventId} not found`);
      return false;
    }

    events[index] = { ...events[index], ...updates };
    return eventStorage.saveEvents(events);
  },

  /**
   * Delete an event
   */
  deleteEvent: (eventId: string): boolean => {
    const events = eventStorage.getEvents();
    const filteredEvents = events.filter((event) => event.id !== eventId);
    return eventStorage.saveEvents(filteredEvents);
  },
};

/**
 * Calendar storage functions
 */
export const calendarStorage = {
  /**
   * Get all calendars from localStorage
   */
  getCalendars: (): Calendar[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.CALENDARS);
    const calendars = safeJsonParse(stored, cloneDefaultCalendars());

    // Ensure we always have at least the default calendars
    if (calendars.length === 0) {
      const defaults = cloneDefaultCalendars();
      calendarStorage.saveCalendars(defaults);
      return defaults;
    }

    return calendars;
  },

  /**
   * Save calendars to localStorage
   */
  saveCalendars: (calendars: Calendar[]): boolean => {
    return safeJsonStringify(STORAGE_KEYS.CALENDARS, calendars);
  },

  /**
   * Add a new calendar
   */
  addCalendar: (calendar: Calendar): boolean => {
    const calendars = calendarStorage.getCalendars();

    // Check if calendar name already exists
    if (calendars.some((cal) => cal.name === calendar.name)) {
      console.warn(`Calendar with name ${calendar.name} already exists`);
      return false;
    }

    calendars.push(calendar);
    return calendarStorage.saveCalendars(calendars);
  },

  /**
   * Update an existing calendar
   */
  updateCalendar: (
    calendarName: string,
    updates: Partial<Calendar>
  ): boolean => {
    const calendars = calendarStorage.getCalendars();
    const index = calendars.findIndex((cal) => cal.name === calendarName);

    if (index === -1) {
      console.warn(`Calendar with name ${calendarName} not found`);
      return false;
    }

    calendars[index] = { ...calendars[index], ...updates };
    return calendarStorage.saveCalendars(calendars);
  },

  /**
   * Delete a calendar (and optionally its events)
   */
  deleteCalendar: (
    calendarName: string,
    deleteEvents: boolean = false
  ): boolean => {
    const calendars = calendarStorage.getCalendars();
    const filteredCalendars = calendars.filter(
      (cal) => cal.name !== calendarName
    );

    if (deleteEvents) {
      const events = eventStorage.getEvents();
      const filteredEvents = events.filter(
        (event) => event.calendarName !== calendarName
      );
      eventStorage.saveEvents(filteredEvents);
    }

    return calendarStorage.saveCalendars(filteredCalendars);
  },
};

/**
 * Settings storage functions
 */
export const settingsStorage = {
  /**
   * Get application settings
   */
  getSettings: (): AppSettings => {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return safeJsonParse(stored, DEFAULT_SETTINGS);
  },

  /**
   * Save application settings
   */
  saveSettings: (settings: AppSettings): boolean => {
    return safeJsonStringify(STORAGE_KEYS.SETTINGS, settings);
  },

  /**
   * Update specific setting
   */
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): boolean => {
    const settings = settingsStorage.getSettings();
    settings[key] = value;
    return settingsStorage.saveSettings(settings);
  },
};

/**
 * Google Auth storage functions
 */
export const googleAuthStorage = {
  /**
   * Get Google authentication state
   */
  getAuthState: (): GoogleAuthState => {
    const stored = localStorage.getItem(STORAGE_KEYS.GOOGLE_AUTH);
    const defaultState: GoogleAuthState = { isAuthenticated: false };
    return safeJsonParse(stored, defaultState);
  },

  /**
   * Save Google authentication state
   */
  saveAuthState: (authState: GoogleAuthState): boolean => {
    return safeJsonStringify(STORAGE_KEYS.GOOGLE_AUTH, authState);
  },

  /**
   * Clear authentication state
   */
  clearAuthState: (): boolean => {
    const defaultState: GoogleAuthState = { isAuthenticated: false };
    return googleAuthStorage.saveAuthState(defaultState);
  },
};

/**
 * Clear all application data
 */
export const clearAllData = (): boolean => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
};

/**
 * Export all data for backup
 */
export const exportData = (): StorageSchema => {
  return {
    tasks: taskStorage.getTasks(),
    events: eventStorage.getEvents(),
    calendars: calendarStorage.getCalendars(),
    settings: settingsStorage.getSettings(),
    googleAuth: googleAuthStorage.getAuthState(),
  };
};

/**
 * Import data from backup
 */
export const importData = (data: Partial<StorageSchema>): boolean => {
  try {
    let success = true;

    if (data.tasks) success = taskStorage.saveTasks(data.tasks) && success;
    if (data.events) success = eventStorage.saveEvents(data.events) && success;
    if (data.calendars)
      success = calendarStorage.saveCalendars(data.calendars) && success;
    if (data.settings)
      success = settingsStorage.saveSettings(data.settings) && success;
    if (data.googleAuth)
      success = googleAuthStorage.saveAuthState(data.googleAuth) && success;

    return success;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
};

/**
 * Get storage usage information
 */
export const getStorageInfo = (): { used: number; available: number } => {
  if (!isStorageAvailable()) {
    return { used: 0, available: 0 };
  }

  let used = 0;

  try {
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        used += localStorage[key].length + key.length;
      }
    }
  } catch (error) {
    console.warn('Failed to calculate storage usage:', error);
  }

  // Most browsers have a 5-10MB limit for localStorage
  const estimated = 5 * 1024 * 1024; // 5MB estimate

  return {
    used,
    available: Math.max(0, estimated - used),
  };
};
