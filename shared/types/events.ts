/**
 * Calendar event type definitions
 */

/**
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event title */
  title: string;
  /** Event start date/time (stored in UTC) */
  start: Date;
  /** Event end date/time (stored in UTC) */
  end: Date;
  /** Optional event description */
  description?: string;
  /** Optional event location */
  location?: string;
  /** Calendar ID this event belongs to */
  calendarId?: string;
  /** Name of the calendar this event belongs to (for backward compatibility) */
  calendarName?: string;
  /** User ID who owns this event */
  userId?: string;
  /** Optional rich text notes (HTML content) */
  notes?: string;
  /** Optional color override for this event */
  color?: string;
  /** Whether this is an all-day event */
  allDay?: boolean;
  /** Optional recurrence rule (RRULE format) */
  recurrence?: string;
  /** Optional list of exception dates (UTC ISO strings) where occurrences are skipped */
  exceptions?: string[];
  /** When the event was created */
  createdAt?: Date;
  /** When the event was last updated */
  updatedAt?: Date;
  /** Transient: when viewing a single occurrence, the instance start time (local/UTC Date) */
  occurrenceInstanceStart?: Date;
  /** Transient: when viewing a single occurrence, the instance end time (local/UTC Date) */
  occurrenceInstanceEnd?: Date;
}

/**
 * Event recurrence pattern
 */
export interface RecurrencePattern {
  /** Recurrence frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Interval between occurrences */
  interval: number;
  /** Days of week for weekly recurrence */
  daysOfWeek?: number[];
  /** Day of month for monthly recurrence */
  dayOfMonth?: number;
  /** End date for recurrence */
  endDate?: Date;
  /** Number of occurrences */
  count?: number;
}

/**
 * Event reminder configuration
 */
export interface EventReminder {
  /** Unique identifier for the reminder */
  id: string;
  /** Minutes before event to send reminder */
  minutesBefore: number;
  /** Reminder method */
  method: 'email' | 'notification' | 'popup';
  /** Whether reminder is enabled */
  enabled: boolean;
}

/**
 * Event filters for querying
 */
export interface EventFilters {
  /** Filter by calendar ID */
  calendarId?: string;
  /** Filter by date range start */
  startDate?: Date;
  /** Filter by date range end */
  endDate?: Date;
  /** Filter by user ID */
  userId?: string;
  /** Search query for title/description */
  search?: string;
  /** Filter by all-day events */
  allDay?: boolean;
}

/**
 * Event sorting options
 */
export interface EventSortOptions {
  /** Field to sort by */
  field: 'start' | 'end' | 'title' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Location autocomplete result
 */
export interface LocationResult {
  /** Display name of the location */
  name: string;
  /** Full formatted address */
  address: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Place ID for future reference */
  placeId?: string;
}

/**
 * Event handler types for calendar operations
 */
export type CalendarEventHandlers = {
  onEventClick: (event: CalendarEvent) => void;
  onEventCreate: (event: Partial<CalendarEvent>) => void;
  onEventUpdate: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
};

/**
 * Component prop types for event components
 */
export interface CalendarViewProps {
  events: CalendarEvent[];
  calendars: Calendar[];
  handlers: CalendarEventHandlers;
}

export interface EventModalProps {
  isOpen: boolean;
  event?: CalendarEvent;
  calendars: Calendar[];
  onSave: (event: CalendarEvent) => void;
  onClose: () => void;
}

// Import Calendar type for use in interfaces
import type { Calendar } from './calendars';