/**
 * Calendar API service layer
 * Mock implementation that will be replaced with actual API calls
 */

import type { Calendar } from '../../types';
import { calendarStorage } from '../../utils/storage';
import { validateCalendar } from '../../utils/validation';

/**
 * Calendar creation data
 */
export interface CreateCalendarData {
  name: string;
  color: string;
  visible?: boolean;
  isDefault?: boolean;
  description?: string;
}

/**
 * Calendar update data
 */
export interface UpdateCalendarData {
  name?: string;
  color?: string;
  visible?: boolean;
  isDefault?: boolean;
  description?: string;
}

/**
 * Default calendar colors
 */
export const DEFAULT_CALENDAR_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6B7280', // Gray
];

/**
 * Simulate network delay for more realistic behavior
 */
const simulateNetworkDelay = (ms: number = 150) =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calendar API service
 */
export const calendarApi = {
  /**
   * Fetch all calendars from storage
   */
  fetchCalendars: async (): Promise<Calendar[]> => {
    await simulateNetworkDelay(100);
    const calendars = calendarStorage.getCalendars();

    // Ensure there's always a default calendar
    if (calendars.length === 0) {
      const defaultCalendar: Calendar = {
        name: 'Personal',
        color: DEFAULT_CALENDAR_COLORS[0],
        visible: true,
        isDefault: true,
        description: 'Personal calendar',
      };
      calendarStorage.addCalendar(defaultCalendar);
      return [defaultCalendar];
    }

    return calendars;
  },

  /**
   * Create a new calendar
   */
  createCalendar: async (data: CreateCalendarData): Promise<Calendar> => {
    // Validate calendar data
    const validationResult = validateCalendar(data);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errors[0].message);
    }

    // Check if calendar name already exists
    const existingCalendars = calendarStorage.getCalendars();
    if (existingCalendars.some(cal => cal.name.toLowerCase() === data.name.toLowerCase())) {
      throw new Error('A calendar with this name already exists');
    }

    const newCalendar: Calendar = {
      name: data.name.trim(),
      color: data.color,
      visible: data.visible ?? true,
      isDefault: data.isDefault ?? false,
      description: data.description?.trim(),
    };

    // If this is set as default, remove default from others
    if (newCalendar.isDefault) {
      existingCalendars.forEach(cal => {
        if (cal.isDefault) {
          calendarStorage.updateCalendar(cal.name, { isDefault: false });
        }
      });
    }

    await simulateNetworkDelay(200);

    const success = calendarStorage.addCalendar(newCalendar);
    if (!success) {
      throw new Error('Failed to save calendar');
    }

    return newCalendar;
  },

  /**
   * Update an existing calendar
   */
  updateCalendar: async (name: string, data: UpdateCalendarData): Promise<Calendar> => {
    // Validate calendar data if name is being changed
    if (data.name !== undefined) {
      const validationResult = validateCalendar({ ...data, name: data.name!, color: data.color || '#3B82F6' });
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors[0].message);
      }

      // Check if new name already exists (excluding current calendar)
      const existingCalendars = calendarStorage.getCalendars();
      if (data.name && data.name !== name && existingCalendars.some(cal => cal.name.toLowerCase() === data.name!.toLowerCase())) {
        throw new Error('A calendar with this name already exists');
      }
    }

    // If this is being set as default, remove default from others
    if (data.isDefault) {
      const existingCalendars = calendarStorage.getCalendars();
      existingCalendars.forEach(cal => {
        if (cal.name !== name && cal.isDefault) {
          calendarStorage.updateCalendar(cal.name, { isDefault: false });
        }
      });
    }

    await simulateNetworkDelay(150);

    const success = calendarStorage.updateCalendar(name, data);
    if (!success) {
      throw new Error('Failed to update calendar');
    }

    // Return updated calendar
    const calendars = calendarStorage.getCalendars();
    const updatedCalendar = calendars.find(calendar => calendar.name === (data.name || name));
    if (!updatedCalendar) {
      throw new Error('Calendar not found after update');
    }

    return updatedCalendar;
  },

  /**
   * Delete a calendar
   */
  deleteCalendar: async (name: string): Promise<void> => {
    // Check if this is the only calendar
    const calendars = calendarStorage.getCalendars();
    if (calendars.length <= 1) {
      throw new Error('Cannot delete the only calendar');
    }

    // Check if this is the default calendar and reassign if needed
    const calendarToDelete = calendars.find(cal => cal.name === name);
    if (calendarToDelete?.isDefault) {
      const otherCalendar = calendars.find(cal => cal.name !== name);
      if (otherCalendar) {
        calendarStorage.updateCalendar(otherCalendar.name, { isDefault: true });
      }
    }

    await simulateNetworkDelay(150);

    const success = calendarStorage.deleteCalendar(name);
    if (!success) {
      throw new Error('Failed to delete calendar');
    }
  },

  /**
   * Toggle calendar visibility
   */
  toggleCalendarVisibility: async (name: string): Promise<Calendar> => {
    const calendars = calendarStorage.getCalendars();
    const calendar = calendars.find(cal => cal.name === name);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    return calendarApi.updateCalendar(name, { visible: !calendar.visible });
  },

  /**
   * Set calendar as default
   */
  setDefaultCalendar: async (name: string): Promise<Calendar> => {
    return calendarApi.updateCalendar(name, { isDefault: true });
  },
};