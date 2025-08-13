/**
 * Event API service layer
 * Real implementation calling Vercel API routes with graceful fallback to local storage in dev/test.
 */

import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from "@shared/types";
import { eventStorage } from '../../utils/storage';
import { validateEvent } from '../../utils/validation';
import { toUTC } from '../../utils/date';
import { useAuthStore } from '@/stores/authStore';
import { calendarApi } from './calendars';

const apiBase = '/api';

function authHeaders(): Record<string, string> {
  try {
    const token = useAuthStore.getState().getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function isJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

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
  exceptions?: string[];
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
  exceptions?: string[];
}

/**
 * Simulate network delay for more realistic behavior
 */
// Legacy helper retained for compatibility in local fallback paths only
// const simulateNetworkDelay = (_ms: number = 150) => Promise.resolve();

/**
 * Event API service
 */
export const eventApi = {
  /**
   * Fetch all events from storage
   */
  fetchEvents: async (): Promise<CalendarEvent[]> => {
    const res = await fetch(`${apiBase}/events`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) {
      return eventStorage.getEvents();
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch events');
    const items = Array.isArray(body.data?.data) ? body.data.data : (body.data || []);
    return items.map((e: Record<string, unknown>) => {
      const record = e as Record<string, unknown>;
      const calendar = record.calendar as Record<string, unknown> | undefined;
      return {
        ...(record as object),
        calendarName: (record.calendarName as string | undefined) ?? (calendar?.name as string | undefined),
        start: new Date(record.start as string),
        end: new Date(record.end as string),
        createdAt: record.createdAt ? new Date(record.createdAt as string) : undefined,
        updatedAt: record.updatedAt ? new Date(record.updatedAt as string) : undefined,
      } as CalendarEvent;
    });
  },

  /**
   * Create a new event
   */
  createEvent: async (data: CreateEventData): Promise<CalendarEvent> => {
    const validationResult = validateEvent(data);
    if (!validationResult.isValid) throw new Error(validationResult.errors[0].message);

    // Try backend first; map calendarName to calendarId isn't available in legacy; leaving as calendarName
    const payload: Record<string, unknown> = {
      title: data.title.trim(),
      start: toUTC(data.start).toISOString(),
      end: toUTC(data.end).toISOString(),
      description: data.description?.trim(),
      location: data.location?.trim(),
      notes: data.notes,
      allDay: !!data.allDay,
      recurrence: data.recurrence,
    };

    // Resolve calendarId from calendarName when possible
    let calendarId: string | undefined;
    try {
      const calendars = await calendarApi.fetchCalendars();
      const match = calendars.find(c => c.name === data.calendarName);
      calendarId = match?.id;
    } catch {
      // ignore; we'll rely on backend legacy bridge via calendarName
    }

    try {
      const res = await fetch(`${apiBase}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...payload,
          ...(calendarId ? { calendarId } : { calendarName: data.calendarName }),
        }),
      });
      if (isJson(res)) {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to create event');
        const e = body.data as Record<string, unknown>;
        const calendar = e.calendar as Record<string, unknown> | undefined;
        const calendarName = (e.calendarName as string | undefined) ?? (calendar?.name as string | undefined) ?? data.calendarName;
        return {
          ...(e as object),
          calendarName,
          start: new Date(e.start as string),
          end: new Date(e.end as string),
          createdAt: e.createdAt ? new Date(e.createdAt as string) : undefined,
          updatedAt: e.updatedAt ? new Date(e.updatedAt as string) : undefined,
        } as CalendarEvent;
      }
    } catch {
      // fall back to local storage below
    }

    // Fallback to local storage
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
      exceptions: data.exceptions ?? [],
    };
    const success = eventStorage.addEvent(newEvent);
    if (!success) throw new Error('Failed to save event');
    return newEvent;
  },

  /**
   * Update an existing event
   */
  updateEvent: async (id: string, data: UpdateEventData): Promise<CalendarEvent> => {
    // Try backend first
    try {
      const payload: Record<string, unknown> = { ...data };
      if (payload.start instanceof Date) payload.start = toUTC(payload.start).toISOString();
      if (payload.end instanceof Date) payload.end = toUTC(payload.end).toISOString();
      const res = await fetch(`${apiBase}/events/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (isJson(res)) {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to update event');
        const e = body.data as Record<string, unknown>;
        const calendar = e.calendar as Record<string, unknown> | undefined;
        const calendarName = (e.calendarName as string | undefined) ?? (calendar?.name as string | undefined);
        return {
          ...(e as object),
          calendarName,
          start: new Date(e.start as string),
          end: new Date(e.end as string),
          createdAt: e.createdAt ? new Date(e.createdAt as string) : undefined,
          updatedAt: e.updatedAt ? new Date(e.updatedAt as string) : undefined,
        } as CalendarEvent;
      }
    } catch {
      // fall back
    }

    // Fallback to local storage validation
    if (data.title !== undefined || data.start !== undefined || data.end !== undefined) {
      const currentEvent = eventStorage.getEvents().find(e => e.id === id);
      if (!currentEvent) throw new Error('Event not found');
      const eventDataToValidate = {
        title: data.title ?? currentEvent.title,
        start: data.start ?? currentEvent.start,
        end: data.end ?? currentEvent.end,
        calendarName: data.calendarName ?? currentEvent.calendarName ?? '',
      };
      const validationResult = validateEvent(eventDataToValidate);
      if (!validationResult.isValid) throw new Error(validationResult.errors[0].message);
    }
    const updateData = { ...data };
    if (updateData.start) updateData.start = toUTC(updateData.start);
    if (updateData.end) updateData.end = toUTC(updateData.end);
    const success = eventStorage.updateEvent(id, updateData);
    if (!success) throw new Error('Failed to update event');
    const events = eventStorage.getEvents();
    const updatedEvent = events.find(event => event.id === id);
    if (!updatedEvent) throw new Error('Event not found after update');
    return updatedEvent;
  },

  /**
   * Delete an event
   */
  deleteEvent: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase}/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (isJson(res)) {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to delete event');
      }
      return;
    }
    const success = eventStorage.deleteEvent(id);
    if (!success) throw new Error('Failed to delete event');
  },

  /**
   * Fetch events for a specific calendar
   */
  fetchEventsByCalendar: async (calendarName: string): Promise<CalendarEvent[]> => {
    // Backend expects calendarId; we pass through name for legacy; will be filtered client-side
    const all = await eventApi.fetchEvents();
    return all.filter(e => e.calendarName === calendarName);
  },

  /**
   * Fetch events within a date range
   */
  fetchEventsByDateRange: async (start: Date, end: Date): Promise<CalendarEvent[]> => {
    const res = await fetch(`${apiBase}/events?start=${encodeURIComponent(toUTC(start).toISOString())}&end=${encodeURIComponent(toUTC(end).toISOString())}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) {
      const allEvents = eventStorage.getEvents();
      const startUTC = toUTC(start);
      const endUTC = toUTC(end);
      return allEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart < endUTC && eventEnd > startUTC;
      });
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch events');
    const items = Array.isArray(body.data?.data) ? body.data.data : (body.data || []);
    return items.map((e: Record<string, unknown>) => {
      const record = e as Record<string, unknown>;
      const calendar = record.calendar as Record<string, unknown> | undefined;
      return {
        ...(record as object),
        calendarName: (record.calendarName as string | undefined) ?? (calendar?.name as string | undefined),
        start: new Date(record.start as string),
        end: new Date(record.end as string),
        createdAt: record.createdAt ? new Date(record.createdAt as string) : undefined,
        updatedAt: record.updatedAt ? new Date(record.updatedAt as string) : undefined,
      } as CalendarEvent;
    });
  },
};