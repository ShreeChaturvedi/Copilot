/**
 * Calendar configuration type definitions
 */

/**
 * Represents a calendar configuration
 */
export interface Calendar {
  /** Unique identifier for the calendar */
  id?: string;
  /** Calendar name/identifier */
  name: string;
  /** Display color for the calendar */
  color: string;
  /** Whether the calendar is currently visible */
  visible: boolean;
  /** Whether this is the default calendar for new events */
  isDefault?: boolean;
  /** Optional description */
  description?: string;
  /** User ID who owns this calendar */
  userId?: string;
  /** When the calendar was created */
  createdAt?: Date;
  /** When the calendar was last updated */
  updatedAt?: Date;
}

/**
 * Calendar creation data
 */
export interface CreateCalendarData {
  /** Calendar name */
  name: string;
  /** Display color */
  color: string;
  /** Optional description */
  description?: string;
  /** Whether this should be the default calendar */
  isDefault?: boolean;
}

/**
 * Calendar update data
 */
export interface UpdateCalendarData {
  /** Calendar name */
  name?: string;
  /** Display color */
  color?: string;
  /** Calendar visibility */
  visible?: boolean;
  /** Whether this should be the default calendar */
  isDefault?: boolean;
  /** Optional description */
  description?: string;
}

/**
 * Calendar filters for querying
 */
export interface CalendarFilters {
  /** Filter by user ID */
  userId?: string;
  /** Filter by visibility */
  visible?: boolean;
  /** Filter by default status */
  isDefault?: boolean;
  /** Search query for name/description */
  search?: string;
}

/**
 * Calendar sorting options
 */
export interface CalendarSortOptions {
  /** Field to sort by */
  field: 'name' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Calendar statistics
 */
export interface CalendarStats {
  /** Calendar ID */
  calendarId: string;
  /** Total number of events */
  totalEvents: number;
  /** Number of upcoming events */
  upcomingEvents: number;
  /** Number of past events */
  pastEvents: number;
  /** Most recent event date */
  lastEventDate?: Date;
  /** Next upcoming event date */
  nextEventDate?: Date;
}