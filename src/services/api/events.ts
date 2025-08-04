/**
 * Event API service layer
 * Mock implementation that will be replaced with actual API calls
 */

import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '../../types';
import { eventStorage } from '../../utils/storage';
import { validateEvent } from '../../utils/validation';
import { toUTC } from '../../utils/date';

/**
 * Event creation data
 */
export interface CreateEventData {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarName: string;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

/**
 * Event update data
 */
export interface UpdateEventData {
  title?: string;
  start?: Date;
  end?: Date;
  description?: string;
  location?: string;
  calendarName?: string;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

/**
 * Simulate network delay for more realistic behavior
 */
const simulateNetworkDelay = (ms: number = 150) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Event API service
 */
export const eventApi = {
  /**
   * Fetch all events from storage
   */
  fetchEvents: async (): Promise<CalendarEvent[]> => {
    await simulateNetworkDelay(150);
    return eventStorage.getEvents();
  },

  /**
   * Create a new event
   */
  createEvent: async (data: CreateEventData): Promise<CalendarEvent> => {
    // Validate event data
    const validationResult = validateEvent(data);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errors[0].message);
    }

    const newEvent: CalendarEvent = {
      id: uuidv4(),
      title: data.title.trim(),
      start: toUTC(data.start),
      end: toUTC(data.end),
      description: data.description?.trim(),
      location: data.location?.trim(),
      calendarName: data.calendarName,
      notes: data.notes,
      color: data.color,
      allDay: data.allDay || false,
      recurrence: data.recurrence,
    };

    await simulateNetworkDelay(250);

    const success = eventStorage.addEvent(newEvent);
    if (!success) {
      throw new Error('Failed to save event');
    }

    return newEvent;
  },

  /**
   * Update an existing event
   */
  updateEvent: async (id: string, data: UpdateEventData): Promise<CalendarEvent> => {
    // Validate event data if provided
    if (data.title !== undefined || data.start !== undefined || data.end !== undefined) {
      const currentEvent = eventStorage.getEvents().find(e => e.id === id);
      if (!currentEvent) {
        throw new Error('Event not found');
      }

      const eventDataToValidate = {
        title: data.title ?? currentEvent.title,
        start: data.start ?? currentEvent.start,
        end: data.end ?? currentEvent.end,
        calendarName: data.calendarName ?? currentEvent.calendarName,
      };

      const validationResult = validateEvent(eventDataToValidate);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors[0].message);
      }
    }

    // Convert dates to UTC if provided
    const updateData = { ...data };
    if (updateData.start) {
      updateData.start = toUTC(updateData.start);
    }
    if (updateData.end) {
      updateData.end = toUTC(updateData.end);
    }

    await simulateNetworkDelay(200);

    const success = eventStorage.updateEvent(id, updateData);
    if (!success) {
      throw new Error('Failed to update event');
    }

    // Return updated event
    const events = eventStorage.getEvents();
    const updatedEvent = events.find(event => event.id === id);
    if (!updatedEvent) {
      throw new Error('Event not found after update');
    }

    return updatedEvent;
  },

  /**
   * Delete an event
   */
  deleteEvent: async (id: string): Promise<void> => {
    await simulateNetworkDelay(150);

    const success = eventStorage.deleteEvent(id);
    if (!success) {
      throw new Error('Failed to delete event');
    }
  },

  /**
   * Fetch events for a specific calendar
   */
  fetchEventsByCalendar: async (calendarName: string): Promise<CalendarEvent[]> => {
    await simulateNetworkDelay(100);
    const allEvents = eventStorage.getEvents();
    return allEvents.filter(event => event.calendarName === calendarName);
  },

  /**
   * Fetch events within a date range
   */
  fetchEventsByDateRange: async (start: Date, end: Date): Promise<CalendarEvent[]> => {
    await simulateNetworkDelay(100);
    const allEvents = eventStorage.getEvents();
    const startUTC = toUTC(start);
    const endUTC = toUTC(end);
    
    return allEvents.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Event overlaps with the date range
      return eventStart < endUTC && eventEnd > startUTC;
    });
  },
};