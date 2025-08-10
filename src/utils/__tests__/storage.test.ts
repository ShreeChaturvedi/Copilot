/**
 * Unit tests for storage utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStorageAvailable,
  taskStorage,
  eventStorage,
  calendarStorage,
  settingsStorage,
  googleAuthStorage,
  clearAllData,
  exportData,
  importData,
  getStorageInfo,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_CALENDARS,
} from '../storage';
import type { Task, CalendarEvent, Calendar, AppSettings, GoogleAuthState } from "@shared/types";

// localStorage is already mocked in setup.ts - no need for custom mock here

describe('Storage Utilities', () => {
  // Remove the custom localStorage mock - use the global one from setup.ts instead
  
  describe('isStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });

    it('should return false when localStorage throws error', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage not available');
      });

      expect(isStorageAvailable()).toBe(false);

      localStorage.setItem = originalSetItem;
    });
  });

  describe('taskStorage', () => {
    const mockTask: Task = {
      id: '1',
      title: 'Test Task',
      completed: false,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      userId: 'test-user',
      scheduledDate: new Date('2024-01-16T10:00:00Z'),
    };

    describe('getTasks', () => {
      it('should return empty array when no tasks stored', () => {
        expect(taskStorage.getTasks()).toEqual([]);
      });

      it('should return stored tasks with dates converted', () => {
        const storedData = JSON.stringify([{
          ...mockTask,
          createdAt: mockTask.createdAt.toISOString(),
          scheduledDate: mockTask.scheduledDate?.toISOString(),
        }]);
        
        // Set the data in localStorage
        localStorage.setItem(STORAGE_KEYS.TASKS, storedData);
        
        const tasks = taskStorage.getTasks();
        expect(tasks).toHaveLength(1);
        expect(tasks[0].createdAt).toBeInstanceOf(Date);
        expect(tasks[0].scheduledDate).toBeInstanceOf(Date);
      });

      it('should handle invalid JSON gracefully', () => {
        localStorage.setItem(STORAGE_KEYS.TASKS, 'invalid-json');
        expect(taskStorage.getTasks()).toEqual([]);
      });
    });

    describe('saveTasks', () => {
      it('should save tasks to localStorage', () => {
        const result = taskStorage.saveTasks([mockTask]);
        
        expect(result).toBe(true);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.TASKS,
          JSON.stringify([mockTask])
        );
      });
    });

    describe('addTask', () => {
      it('should add task to existing tasks', () => {
        taskStorage.saveTasks([mockTask]);
        
        const newTask: Task = {
          id: '2',
          title: 'New Task',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'test-user',
        };
        
        const result = taskStorage.addTask(newTask);
        
        expect(result).toBe(true);
        const tasks = taskStorage.getTasks();
        expect(tasks).toHaveLength(2);
      });
    });

    describe('updateTask', () => {
      beforeEach(() => {
        taskStorage.saveTasks([mockTask]);
      });

      it('should update existing task', () => {
        const result = taskStorage.updateTask('1', { completed: true });
        
        expect(result).toBe(true);
        const tasks = taskStorage.getTasks();
        expect(tasks[0].completed).toBe(true);
      });

      it('should return false for non-existing task', () => {
        const result = taskStorage.updateTask('999', { completed: true });
        expect(result).toBe(false);
      });
    });

    describe('deleteTask', () => {
      beforeEach(() => {
        taskStorage.saveTasks([mockTask]);
      });

      it('should delete existing task', () => {
        const result = taskStorage.deleteTask('1');
        
        expect(result).toBe(true);
        const tasks = taskStorage.getTasks();
        expect(tasks).toHaveLength(0);
      });

      it('should handle non-existing task gracefully', () => {
        const result = taskStorage.deleteTask('999');
        expect(result).toBe(true); // Still returns true as operation succeeded
      });
    });
  });

  describe('eventStorage', () => {
    const mockEvent: CalendarEvent = {
      id: '1',
      title: 'Test Event',
      start: new Date('2024-01-15T10:00:00Z'),
      end: new Date('2024-01-15T12:00:00Z'),
      calendarName: 'Personal',
    };

    describe('getEvents', () => {
      it('should return empty array when no events stored', () => {
        expect(eventStorage.getEvents()).toEqual([]);
      });

      it('should return stored events with dates converted', () => {
        const storedData = JSON.stringify([{
          ...mockEvent,
          start: mockEvent.start.toISOString(),
          end: mockEvent.end.toISOString(),
        }]);
        
        localStorage.setItem(STORAGE_KEYS.EVENTS, storedData);
        
        const events = eventStorage.getEvents();
        expect(events).toHaveLength(1);
        expect(events[0].start).toBeInstanceOf(Date);
        expect(events[0].end).toBeInstanceOf(Date);
      });
    });

    describe('addEvent', () => {
      it('should add event to existing events', () => {
        const result = eventStorage.addEvent(mockEvent);
        
        expect(result).toBe(true);
        const events = eventStorage.getEvents();
        expect(events).toHaveLength(1);
      });
    });

    describe('updateEvent', () => {
      beforeEach(() => {
        eventStorage.saveEvents([mockEvent]);
      });

      it('should update existing event', () => {
        const result = eventStorage.updateEvent('1', { title: 'Updated Event' });
        
        expect(result).toBe(true);
        const events = eventStorage.getEvents();
        expect(events[0].title).toBe('Updated Event');
      });

      it('should return false for non-existing event', () => {
        const result = eventStorage.updateEvent('999', { title: 'Updated' });
        expect(result).toBe(false);
      });
    });

    describe('deleteEvent', () => {
      beforeEach(() => {
        eventStorage.saveEvents([mockEvent]);
      });

      it('should delete existing event', () => {
        const result = eventStorage.deleteEvent('1');
        
        expect(result).toBe(true);
        const events = eventStorage.getEvents();
        expect(events).toHaveLength(0);
      });
    });
  });

  describe('calendarStorage', () => {
    const mockCalendar: Calendar = {
      name: 'Test Calendar',
      color: '#FF0000',
      visible: true,
    };

    describe('getCalendars', () => {
      it('should return default calendars when none stored', () => {
        const calendars = calendarStorage.getCalendars();
        expect(calendars).toEqual(DEFAULT_CALENDARS);
      });

      it('should return stored calendars', () => {
        // First clear the store to avoid default calendars
        localStorage.clear();
        localStorage.setItem(STORAGE_KEYS.CALENDARS, JSON.stringify([mockCalendar]));
        
        const calendars = calendarStorage.getCalendars();
        expect(calendars).toEqual([mockCalendar]);
      });
    });

    describe('addCalendar', () => {
      it('should add new calendar', () => {
        const result = calendarStorage.addCalendar(mockCalendar);
        
        expect(result).toBe(true);
        const calendars = calendarStorage.getCalendars();
        expect(calendars).toContainEqual(mockCalendar);
      });

      it('should not add calendar with duplicate name', () => {
        calendarStorage.addCalendar(mockCalendar);
        const result = calendarStorage.addCalendar(mockCalendar);
        
        expect(result).toBe(false);
      });
    });

    describe('updateCalendar', () => {
      beforeEach(() => {
        calendarStorage.saveCalendars([mockCalendar]);
      });

      it('should update existing calendar', () => {
        const result = calendarStorage.updateCalendar('Test Calendar', { color: '#00FF00' });
        
        expect(result).toBe(true);
        const calendars = calendarStorage.getCalendars();
        expect(calendars[0].color).toBe('#00FF00');
      });

      it('should return false for non-existing calendar', () => {
        const result = calendarStorage.updateCalendar('Non-existing', { color: '#00FF00' });
        expect(result).toBe(false);
      });
    });

    describe('deleteCalendar', () => {
      beforeEach(() => {
        calendarStorage.saveCalendars([mockCalendar]);
      });

      it('should delete calendar without deleting events', () => {
        const result = calendarStorage.deleteCalendar('Test Calendar', false);
        
        expect(result).toBe(true);
        const calendars = calendarStorage.getCalendars();
        expect(calendars).not.toContainEqual(mockCalendar);
      });

      it('should delete calendar and its events', () => {
        const mockEvent: CalendarEvent = {
          id: '1',
          title: 'Test Event',
          start: new Date(),
          end: new Date(),
          calendarName: 'Test Calendar',
        };
        
        eventStorage.saveEvents([mockEvent]);
        
        const result = calendarStorage.deleteCalendar('Test Calendar', true);
        
        expect(result).toBe(true);
        const events = eventStorage.getEvents();
        expect(events).toHaveLength(0);
      });
    });
  });

  describe('settingsStorage', () => {
    describe('getSettings', () => {
      it('should return default settings when none stored', () => {
        const settings = settingsStorage.getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
      });

      it('should return stored settings', () => {
        const customSettings: AppSettings = {
          ...DEFAULT_SETTINGS,
          theme: 'dark',
        };
        
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(customSettings));
        
        const settings = settingsStorage.getSettings();
        expect(settings.theme).toBe('dark');
      });
    });

    describe('updateSetting', () => {
      it('should update specific setting', () => {
        const result = settingsStorage.updateSetting('theme', 'dark');
        
        expect(result).toBe(true);
        const settings = settingsStorage.getSettings();
        expect(settings.theme).toBe('dark');
      });
    });
  });

  describe('googleAuthStorage', () => {
    const mockAuthState: GoogleAuthState = {
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600000,
      isAuthenticated: true,
    };

    describe('getAuthState', () => {
      it('should return default auth state when none stored', () => {
        const authState = googleAuthStorage.getAuthState();
        expect(authState.isAuthenticated).toBe(false);
      });

      it('should return stored auth state', () => {
        localStorage.setItem(STORAGE_KEYS.GOOGLE_AUTH, JSON.stringify(mockAuthState));
        
        const authState = googleAuthStorage.getAuthState();
        expect(authState).toEqual(mockAuthState);
      });
    });

    describe('clearAuthState', () => {
      it('should clear authentication state', () => {
        googleAuthStorage.saveAuthState(mockAuthState);
        
        const result = googleAuthStorage.clearAuthState();
        
        expect(result).toBe(true);
        const authState = googleAuthStorage.getAuthState();
        expect(authState.isAuthenticated).toBe(false);
      });
    });
  });

  describe('clearAllData', () => {
    it('should clear all application data', () => {
      // Add some data first
      taskStorage.saveTasks([]);
      eventStorage.saveEvents([]);
      settingsStorage.saveSettings(DEFAULT_SETTINGS);
      
      const result = clearAllData();
      
      expect(result).toBe(true);
      expect(localStorage.removeItem).toHaveBeenCalledTimes(Object.keys(STORAGE_KEYS).length);
    });
  });

  describe('exportData', () => {
    it('should export all application data', () => {
      const mockTask: Task = {
        id: '1',
        title: 'Test',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'test-user',
      };
      
      taskStorage.saveTasks([mockTask]);
      
      const exportedData = exportData();
      
      expect(exportedData.tasks).toHaveLength(1);
      expect(exportedData.events).toEqual([]);
      expect(exportedData.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('importData', () => {
    it('should import partial data', () => {
      const mockTask: Task = {
        id: '1',
        title: 'Imported Task',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'test-user',
      };
      
      const result = importData({ tasks: [mockTask] });
      
      expect(result).toBe(true);
      const tasks = taskStorage.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Imported Task');
    });

    it('should handle import errors gracefully', () => {
      // Mock setItem to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });
      
      const result = importData({ tasks: [] });
      expect(result).toBe(false);
      
      // Restore original implementation
      localStorage.setItem = originalSetItem;
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage usage information', () => {
      const info = getStorageInfo();
      
      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('available');
      expect(typeof info.used).toBe('number');
      expect(typeof info.available).toBe('number');
    });

    it('should return zeros when storage not available', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage not available');
      });

      const info = getStorageInfo();
      expect(info.used).toBe(0);
      expect(info.available).toBe(0);

      localStorage.setItem = originalSetItem;
    });
  });
});