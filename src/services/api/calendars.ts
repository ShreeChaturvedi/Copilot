/**
 * Calendar API service layer
 * Real implementation calling Vercel API routes with graceful fallback to local storage in dev/test.
 */

import type { Calendar } from "@shared/types";
import { calendarStorage } from '../../utils/storage';
import { validateCalendar } from '../../utils/validation';
import { useAuthStore } from '@/stores/authStore';

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
 * Calendar API service
 */
export const calendarApi = {
  /**
   * Fetch all calendars from storage
   */
  fetchCalendars: async (): Promise<Calendar[]> => {
    const res = await fetch(`${apiBase}/calendars?withEventCounts=true`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) {
      const calendars = calendarStorage.getCalendars();
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
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch calendars');
    const raw = body.data as Array<Record<string, unknown>>;
    return raw.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      description: (c.description as string) || undefined,
      visible: c.isVisible as boolean,
      isDefault: c.isDefault as boolean,
      userId: c.userId,
      createdAt: c.createdAt ? new Date(c.createdAt as string) : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt as string) : undefined,
    } as Calendar));
  },

  /**
   * Create a new calendar
   */
  createCalendar: async (data: CreateCalendarData): Promise<Calendar> => {
    const validationResult = validateCalendar(data);
    if (!validationResult.isValid) throw new Error(validationResult.errors[0].message);

    const res = await fetch(`${apiBase}/calendars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        name: data.name.trim(),
        color: data.color,
        description: data.description?.trim(),
        isDefault: data.isDefault ?? false,
      }),
    });
    if (!isJson(res)) {
      // Fallback to local storage
      const existing = calendarStorage.getCalendars();
      if (existing.some(cal => cal.name.toLowerCase() === data.name.toLowerCase())) {
        throw new Error('A calendar with this name already exists');
      }
      const newCalendar: Calendar = {
        name: data.name.trim(),
        color: data.color,
        visible: data.visible ?? true,
        isDefault: data.isDefault ?? false,
        description: data.description?.trim(),
      };
      const success = calendarStorage.addCalendar(newCalendar);
      if (!success) throw new Error('Failed to save calendar');
      return newCalendar;
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to create calendar');
    const c = body.data as Record<string, unknown>;
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      description: (c.description as string) || undefined,
      visible: c.isVisible as boolean,
      isDefault: c.isDefault as boolean,
      userId: c.userId,
      createdAt: c.createdAt ? new Date(c.createdAt as string) : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt as string) : undefined,
    } as Calendar;
  },

  /**
   * Update an existing calendar
   */
  updateCalendar: async (name: string, data: UpdateCalendarData): Promise<Calendar> => {
    // Try backend first: resolve id by name
    const list = await calendarApi.fetchCalendars().catch(() => [] as Calendar[]);
    const target = list.find((c) => c.name === name);
    if (target?.id) {
      const res = await fetch(`${apiBase}/calendars/${encodeURIComponent(target.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: data.name,
          color: data.color,
          description: data.description,
          isVisible: data.visible,
          isDefault: data.isDefault,
        }),
      });
      if (isJson(res)) {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to update calendar');
        const c = body.data as Record<string, unknown>;
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          description: (c.description as string) || undefined,
          visible: c.isVisible as boolean,
          isDefault: c.isDefault as boolean,
          userId: c.userId,
          createdAt: c.createdAt ? new Date(c.createdAt as string) : undefined,
          updatedAt: c.updatedAt ? new Date(c.updatedAt as string) : undefined,
        } as Calendar;
      }
    }

    // Fallback to local storage
    if (data.name !== undefined) {
      const validationResult = validateCalendar({ ...data, name: data.name!, color: data.color || '#3B82F6' });
      if (!validationResult.isValid) throw new Error(validationResult.errors[0].message);
      const existingCalendars = calendarStorage.getCalendars();
      if (data.name && data.name !== name && existingCalendars.some(cal => cal.name.toLowerCase() === data.name!.toLowerCase())) {
        throw new Error('A calendar with this name already exists');
      }
    }
    if (data.isDefault) {
      const existingCalendars = calendarStorage.getCalendars();
      existingCalendars.forEach(cal => {
        if (cal.name !== name && cal.isDefault) {
          calendarStorage.updateCalendar(cal.name, { isDefault: false });
        }
      });
    }
    const success = calendarStorage.updateCalendar(name, data);
    if (!success) throw new Error('Failed to update calendar');
    const calendars = calendarStorage.getCalendars();
    const updatedCalendar = calendars.find(calendar => calendar.name === (data.name || name));
    if (!updatedCalendar) throw new Error('Calendar not found after update');
    return updatedCalendar;
  },

  /**
   * Delete a calendar
   */
  deleteCalendar: async (name: string): Promise<void> => {
    // Try backend first
    const list = await calendarApi.fetchCalendars().catch(() => [] as Calendar[]);
    const target = list.find((c) => c.name === name);
    if (target?.id) {
      const res = await fetch(`${apiBase}/calendars/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      if (isJson(res)) {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.message || 'Failed to delete calendar');
        }
        return;
      }
    }

    // Fallback to local storage
    const calendars = calendarStorage.getCalendars();
    if (calendars.length <= 1) throw new Error('Cannot delete the only calendar');
    const calendarToDelete = calendars.find(cal => cal.name === name);
    if (calendarToDelete?.isDefault) {
      const otherCalendar = calendars.find(cal => cal.name !== name);
      if (otherCalendar) calendarStorage.updateCalendar(otherCalendar.name, { isDefault: true });
    }
    const success = calendarStorage.deleteCalendar(name);
    if (!success) throw new Error('Failed to delete calendar');
  },

  /**
   * Toggle calendar visibility
   */
  toggleCalendarVisibility: async (name: string): Promise<Calendar> => {
    // Try backend first
    const list = await calendarApi.fetchCalendars().catch(() => [] as Calendar[]);
    const target = list.find((c) => c.name === name);
    if (target?.id) {
      const res = await fetch(`${apiBase}/calendars/${encodeURIComponent(target.id)}?action=toggle-visibility`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (isJson(res)) {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to toggle visibility');
        const c = body.data as Record<string, unknown>;
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          description: (c.description as string) || undefined,
          visible: c.isVisible as boolean,
          isDefault: c.isDefault as boolean,
          userId: c.userId,
          createdAt: c.createdAt ? new Date(c.createdAt as string) : undefined,
          updatedAt: c.updatedAt ? new Date(c.updatedAt as string) : undefined,
        } as Calendar;
      }
    }
    // Fallback
    const calendars = calendarStorage.getCalendars();
    const calendar = calendars.find(cal => cal.name === name);
    if (!calendar) throw new Error('Calendar not found');
    return calendarApi.updateCalendar(name, { visible: !calendar.visible });
  },

  /**
   * Set calendar as default
   */
  setDefaultCalendar: async (name: string): Promise<Calendar> => {
    // Try backend first
    const list = await calendarApi.fetchCalendars().catch(() => [] as Calendar[]);
    const target = list.find((c) => c.name === name);
    if (target?.id) {
      const res = await fetch(`${apiBase}/calendars/${encodeURIComponent(target.id)}?action=set-default`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      if (isJson(res)) {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to set default calendar');
        const c = body.data as Record<string, unknown>;
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          description: (c.description as string) || undefined,
          visible: c.isVisible as boolean,
          isDefault: c.isDefault as boolean,
          userId: c.userId,
          createdAt: c.createdAt ? new Date(c.createdAt as string) : undefined,
          updatedAt: c.updatedAt ? new Date(c.updatedAt as string) : undefined,
        } as Calendar;
      }
    }
    // Fallback
    return calendarApi.updateCalendar(name, { isDefault: true });
  },
};