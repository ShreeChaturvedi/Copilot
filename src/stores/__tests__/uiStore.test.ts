import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../uiStore';
import type { CalendarEvent } from '../uiStore';

// Mock event for testing
const mockEvent: CalendarEvent = {
  id: '1',
  title: 'Test Event',
  start: new Date('2024-01-01T10:00:00Z'),
  end: new Date('2024-01-01T11:00:00Z'),
  calendarName: 'Personal',
  description: 'Test description',
  location: 'Test location',
};

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.getState().resetUI();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState();
      
      expect(state.eventModalOpen).toBe(false);
      expect(state.eventDetailsModalOpen).toBe(false);
      expect(state.settingsModalOpen).toBe(false);
      expect(state.notesEditorOpen).toBe(false);
      expect(state.selectedEvent).toBe(null);
      expect(state.leftPaneWidth).toBe(300);
      expect(state.showCompletedTasks).toBe(false);
    });
  });

  describe('Event Modal Management', () => {
    it('should open event modal without event', () => {
      const { openEventModal } = useUIStore.getState();
      
      openEventModal();
      
      const state = useUIStore.getState();
      expect(state.eventModalOpen).toBe(true);
      expect(state.selectedEvent).toBe(null);
    });

    it('should open event modal with event', () => {
      const { openEventModal } = useUIStore.getState();
      
      openEventModal(mockEvent);
      
      const state = useUIStore.getState();
      expect(state.eventModalOpen).toBe(true);
      expect(state.selectedEvent).toEqual(mockEvent);
    });

    it('should close event modal and clear selected event', () => {
      const { openEventModal, closeEventModal } = useUIStore.getState();
      
      // First open with event
      openEventModal(mockEvent);
      expect(useUIStore.getState().eventModalOpen).toBe(true);
      expect(useUIStore.getState().selectedEvent).toEqual(mockEvent);
      
      // Then close
      closeEventModal();
      
      const state = useUIStore.getState();
      expect(state.eventModalOpen).toBe(false);
      expect(state.selectedEvent).toBe(null);
    });
  });

  describe('Event Details Modal Management', () => {
    it('should open event details modal with event', () => {
      const { openEventDetailsModal } = useUIStore.getState();
      
      openEventDetailsModal(mockEvent);
      
      const state = useUIStore.getState();
      expect(state.eventDetailsModalOpen).toBe(true);
      expect(state.selectedEvent).toEqual(mockEvent);
    });

    it('should close event details modal and clear selected event', () => {
      const { openEventDetailsModal, closeEventDetailsModal } = useUIStore.getState();
      
      // First open
      openEventDetailsModal(mockEvent);
      expect(useUIStore.getState().eventDetailsModalOpen).toBe(true);
      
      // Then close
      closeEventDetailsModal();
      
      const state = useUIStore.getState();
      expect(state.eventDetailsModalOpen).toBe(false);
      expect(state.selectedEvent).toBe(null);
    });
  });

  describe('Settings Modal Management', () => {
    it('should open settings modal', () => {
      const { openSettingsModal } = useUIStore.getState();
      
      openSettingsModal();
      
      expect(useUIStore.getState().settingsModalOpen).toBe(true);
    });

    it('should close settings modal', () => {
      const { openSettingsModal, closeSettingsModal } = useUIStore.getState();
      
      openSettingsModal();
      expect(useUIStore.getState().settingsModalOpen).toBe(true);
      
      closeSettingsModal();
      expect(useUIStore.getState().settingsModalOpen).toBe(false);
    });
  });

  describe('Notes Editor Management', () => {
    it('should toggle notes editor', () => {
      const { toggleNotesEditor } = useUIStore.getState();
      
      // Initially closed
      expect(useUIStore.getState().notesEditorOpen).toBe(false);
      
      // Toggle to open
      toggleNotesEditor();
      expect(useUIStore.getState().notesEditorOpen).toBe(true);
      
      // Toggle to close
      toggleNotesEditor();
      expect(useUIStore.getState().notesEditorOpen).toBe(false);
    });
  });

  describe('Selected Event Management', () => {
    it('should set selected event', () => {
      const { setSelectedEvent } = useUIStore.getState();
      
      setSelectedEvent(mockEvent);
      
      expect(useUIStore.getState().selectedEvent).toEqual(mockEvent);
    });

    it('should clear selected event', () => {
      const { setSelectedEvent } = useUIStore.getState();
      
      // First set an event
      setSelectedEvent(mockEvent);
      expect(useUIStore.getState().selectedEvent).toEqual(mockEvent);
      
      // Then clear it
      setSelectedEvent(null);
      expect(useUIStore.getState().selectedEvent).toBe(null);
    });
  });

  describe('Layout Preferences', () => {
    it('should set left pane width within bounds', () => {
      const { setLeftPaneWidth } = useUIStore.getState();
      
      // Normal width
      setLeftPaneWidth(400);
      expect(useUIStore.getState().leftPaneWidth).toBe(400);
      
      // Minimum bound
      setLeftPaneWidth(100);
      expect(useUIStore.getState().leftPaneWidth).toBe(200);
      
      // Maximum bound
      setLeftPaneWidth(800);
      expect(useUIStore.getState().leftPaneWidth).toBe(600);
    });

    it('should toggle show completed tasks', () => {
      const { setShowCompletedTasks } = useUIStore.getState();
      
      // Initially false
      expect(useUIStore.getState().showCompletedTasks).toBe(false);
      
      // Set to true
      setShowCompletedTasks(true);
      expect(useUIStore.getState().showCompletedTasks).toBe(true);
      
      // Set back to false
      setShowCompletedTasks(false);
      expect(useUIStore.getState().showCompletedTasks).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state to initial values', () => {
      const { 
        openEventModal, 
        openSettingsModal, 
        toggleNotesEditor, 
        setLeftPaneWidth, 
        setShowCompletedTasks,
        resetUI 
      } = useUIStore.getState();
      
      // Modify state
      openEventModal(mockEvent);
      openSettingsModal();
      toggleNotesEditor();
      setLeftPaneWidth(500);
      setShowCompletedTasks(true);
      
      // Verify state is modified
      let state = useUIStore.getState();
      expect(state.eventModalOpen).toBe(true);
      expect(state.settingsModalOpen).toBe(true);
      expect(state.notesEditorOpen).toBe(true);
      expect(state.leftPaneWidth).toBe(500);
      expect(state.showCompletedTasks).toBe(true);
      
      // Reset
      resetUI();
      
      // Verify state is reset
      state = useUIStore.getState();
      expect(state.eventModalOpen).toBe(false);
      expect(state.eventDetailsModalOpen).toBe(false);
      expect(state.settingsModalOpen).toBe(false);
      expect(state.notesEditorOpen).toBe(false);
      expect(state.selectedEvent).toBe(null);
      expect(state.leftPaneWidth).toBe(300);
      expect(state.showCompletedTasks).toBe(false);
    });
  });
});