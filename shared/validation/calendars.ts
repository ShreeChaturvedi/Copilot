/**
 * Calendar validation schemas
 */

import { z } from 'zod';

/**
 * Calendar schema
 */
export const calendarSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'Calendar name is required').max(100, 'Calendar name must be less than 100 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  visible: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  userId: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Calendar creation schema
 */
export const createCalendarSchema = z.object({
  name: z.string().min(1, 'Calendar name is required').max(100, 'Calendar name must be less than 100 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isDefault: z.boolean().default(false),
});

/**
 * Calendar update schema
 */
export const updateCalendarSchema = z.object({
  name: z.string().min(1, 'Calendar name is required').max(100, 'Calendar name must be less than 100 characters').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  visible: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Calendar query schema
 */
export const calendarQuerySchema = z.object({
  visible: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Calendar statistics schema
 */
export const calendarStatsSchema = z.object({
  calendarId: z.string().cuid(),
  totalEvents: z.number().min(0),
  upcomingEvents: z.number().min(0),
  pastEvents: z.number().min(0),
  lastEventDate: z.date().optional(),
  nextEventDate: z.date().optional(),
});

/**
 * Validation helper functions
 */
export const validateCalendarName = (name: string): { valid: boolean; errors: string[] } => {
  const result = z.string()
    .min(1, 'Calendar name is required')
    .max(100, 'Calendar name must be less than 100 characters')
    .safeParse(name);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

export const validateCalendarColor = (color: string): boolean => {
  return z.string().regex(/^#[0-9A-F]{6}$/i).safeParse(color).success;
};

/**
 * Type exports from schemas
 */
export type Calendar = z.infer<typeof calendarSchema>;
export type CreateCalendarRequest = z.infer<typeof createCalendarSchema>;
export type UpdateCalendarRequest = z.infer<typeof updateCalendarSchema>;
export type CalendarQueryParams = z.infer<typeof calendarQuerySchema>;
export type CalendarStats = z.infer<typeof calendarStatsSchema>;