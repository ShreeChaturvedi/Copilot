/**
 * Event validation schemas
 */

import { z } from 'zod';

/**
 * Recurrence pattern schema
 */
export const recurrencePatternSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().min(1, 'Interval must be at least 1'),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  endDate: z.date().optional(),
  count: z.number().min(1).optional(),
});

/**
 * Event reminder schema
 */
export const eventReminderSchema = z.object({
  id: z.string().cuid(),
  minutesBefore: z.number().min(0, 'Minutes before must be non-negative'),
  method: z.enum(['email', 'notification', 'popup']),
  enabled: z.boolean().default(true),
});

/**
 * Location result schema
 */
export const locationResultSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().min(1, 'Address is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().optional(),
});

/**
 * Calendar event schema
 */
export const calendarEventSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1, 'Event title is required').max(200, 'Event title must be less than 200 characters'),
  start: z.date(),
  end: z.date(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  calendarId: z.string().cuid(),
  userId: z.string().cuid(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  allDay: z.boolean().default(false),
  recurrence: z.string().optional(), // RRULE format
  createdAt: z.date(),
  updatedAt: z.date(),
}).refine(
  (data) => data.end > data.start,
  {
    message: 'End date must be after start date',
    path: ['end'],
  }
);

/**
 * Event creation schema
 */
export const createEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Event title must be less than 200 characters'),
  start: z.string().datetime().or(z.date()),
  end: z.string().datetime().or(z.date()),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  calendarId: z.string().cuid(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  allDay: z.boolean().default(false),
  recurrence: z.string().optional(),
}).refine(
  (data) => {
    const start = typeof data.start === 'string' ? new Date(data.start) : data.start;
    const end = typeof data.end === 'string' ? new Date(data.end) : data.end;
    return end > start;
  },
  {
    message: 'End date must be after start date',
    path: ['end'],
  }
);

/**
 * Event update schema
 */
export const updateEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Event title must be less than 200 characters').optional(),
  start: z.string().datetime().or(z.date()).optional(),
  end: z.string().datetime().or(z.date()).optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  calendarId: z.string().cuid().optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  allDay: z.boolean().optional(),
  recurrence: z.string().optional(),
}).refine(
  (data) => {
    if (data.start && data.end) {
      const start = typeof data.start === 'string' ? new Date(data.start) : data.start;
      const end = typeof data.end === 'string' ? new Date(data.end) : data.end;
      return end > start;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['end'],
  }
);

/**
 * Event query schema
 */
export const eventQuerySchema = z.object({
  calendarId: z.string().cuid().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['start', 'end', 'title', 'createdAt', 'updatedAt']).default('start'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Date range query schema
 */
export const dateRangeQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).refine(
  (data) => new Date(data.end) > new Date(data.start),
  {
    message: 'End date must be after start date',
    path: ['end'],
  }
);

/**
 * Bulk event operations schema
 */
export const bulkUpdateEventsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one event ID is required'),
  updates: updateEventSchema,
});

export const bulkDeleteEventsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one event ID is required'),
});

/**
 * Event conflict detection schema
 */
export const eventConflictSchema = z.object({
  start: z.date(),
  end: z.date(),
  calendarId: z.string().cuid(),
  excludeEventId: z.string().cuid().optional(),
});

/**
 * Validation helper functions
 */
export const validateEventTitle = (title: string): { valid: boolean; errors: string[] } => {
  const result = z.string()
    .min(1, 'Event title is required')
    .max(200, 'Event title must be less than 200 characters')
    .safeParse(title);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

export const validateDateRange = (start: Date, end: Date): { valid: boolean; errors: string[] } => {
  if (end <= start) {
    return {
      valid: false,
      errors: ['End date must be after start date'],
    };
  }

  return { valid: true, errors: [] };
};

export const validateRecurrenceRule = (rrule: string): boolean => {
  // Basic RRULE validation - in a real implementation, you'd use a proper RRULE parser
  const rrulePattern = /^RRULE:/;
  return rrulePattern.test(rrule);
};

export const validateLocation = (location: string): { valid: boolean; errors: string[] } => {
  const result = z.string()
    .max(200, 'Location must be less than 200 characters')
    .safeParse(location);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

/**
 * Type exports from schemas
 */
export type RecurrencePattern = z.infer<typeof recurrencePatternSchema>;
export type EventReminder = z.infer<typeof eventReminderSchema>;
export type LocationResult = z.infer<typeof locationResultSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CreateEventRequest = z.infer<typeof createEventSchema>;
export type UpdateEventRequest = z.infer<typeof updateEventSchema>;
export type EventQueryParams = z.infer<typeof eventQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type BulkUpdateEventsRequest = z.infer<typeof bulkUpdateEventsSchema>;
export type BulkDeleteEventsRequest = z.infer<typeof bulkDeleteEventsSchema>;
export type EventConflictQuery = z.infer<typeof eventConflictSchema>;