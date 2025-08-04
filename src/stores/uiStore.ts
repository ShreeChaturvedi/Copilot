import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarName: string;
  notes?: string;
  color?: string;
}

export type ViewMode = 'calendar' | 'task';
export type TaskGrouping = 'taskList' | 'dueDate' | 'priority';
export type TaskViewMode = 'folder' | 'list';
export type DropZone = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later';

interface DragState {
  isDragging: boolean;
  taskId: string | null;
  dropZone: DropZone | null;
}

interface UIState {
  // Modal states
  eventModalOpen: boolean;
  eventDetailsModalOpen: boolean;
  settingsModalOpen: boolean;
  notesEditorOpen: boolean;
  
  // Current selections
  selectedEvent: CalendarEvent | null;
  
  // Layout preferences
  leftPaneWidth: number;
  showCompletedTasks: boolean;
  peekMode: 'center' | 'right';
  
  // View management
  currentView: ViewMode;
  taskGrouping: TaskGrouping;
  taskViewMode: TaskViewMode;
  
  // Drag & drop state
  dragState: DragState;
  
  // Actions
  openEventModal: (event?: CalendarEvent) => void;
  closeEventModal: () => void;
  openEventDetailsModal: (event: CalendarEvent) => void;
  closeEventDetailsModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  toggleNotesEditor: () => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  setLeftPaneWidth: (width: number) => void;
  setShowCompletedTasks: (show: boolean) => void;
  setPeekMode: (mode: 'center' | 'right') => void;
  
  // New view management actions
  setCurrentView: (view: ViewMode) => void;
  setTaskGrouping: (grouping: TaskGrouping) => void;
  setTaskViewMode: (mode: TaskViewMode) => void;
  setDragState: (state: Partial<DragState>) => void;
  
  resetUI: () => void;
}

const initialState = {
  eventModalOpen: false,
  eventDetailsModalOpen: false,
  settingsModalOpen: false,
  notesEditorOpen: false,
  selectedEvent: null,
  leftPaneWidth: 300,
  showCompletedTasks: false,
  peekMode: 'center' as 'center' | 'right',
  currentView: 'calendar' as ViewMode,
  taskGrouping: 'taskList' as TaskGrouping,
  taskViewMode: 'list' as TaskViewMode,
  dragState: {
    isDragging: false,
    taskId: null,
    dropZone: null,
  } as DragState,
};

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      openEventModal: (event) => set(
        { 
          eventModalOpen: true, 
          selectedEvent: event || null 
        },
        false,
        'openEventModal'
      ),
      
      closeEventModal: () => set(
        { 
          eventModalOpen: false, 
          selectedEvent: null 
        },
        false,
        'closeEventModal'
      ),
      
      openEventDetailsModal: (event) => set(
        { 
          eventDetailsModalOpen: true, 
          selectedEvent: event 
        },
        false,
        'openEventDetailsModal'
      ),
      
      closeEventDetailsModal: () => set(
        { 
          eventDetailsModalOpen: false, 
          selectedEvent: null 
        },
        false,
        'closeEventDetailsModal'
      ),
      
      openSettingsModal: () => set(
        { settingsModalOpen: true },
        false,
        'openSettingsModal'
      ),
      
      closeSettingsModal: () => set(
        { settingsModalOpen: false },
        false,
        'closeSettingsModal'
      ),
      
      toggleNotesEditor: () => set(
        (state) => ({ notesEditorOpen: !state.notesEditorOpen }),
        false,
        'toggleNotesEditor'
      ),
      
      setSelectedEvent: (event) => set(
        { selectedEvent: event },
        false,
        'setSelectedEvent'
      ),
      
      setLeftPaneWidth: (width) => set(
        { leftPaneWidth: Math.max(200, Math.min(600, width)) },
        false,
        'setLeftPaneWidth'
      ),
      
      setShowCompletedTasks: (show) => set(
        { showCompletedTasks: show },
        false,
        'setShowCompletedTasks'
      ),
      
      setPeekMode: (mode) => set(
        { peekMode: mode },
        false,
        'setPeekMode'
      ),
      
      setCurrentView: (view) => set(
        { currentView: view },
        false,
        'setCurrentView'
      ),
      
      setTaskGrouping: (grouping) => set(
        { taskGrouping: grouping },
        false,
        'setTaskGrouping'
      ),
      
      setTaskViewMode: (mode) => set(
        { taskViewMode: mode },
        false,
        'setTaskViewMode'
      ),
      
      setDragState: (state) => set(
        (currentState) => ({
          dragState: { ...currentState.dragState, ...state }
        }),
        false,
        'setDragState'
      ),
      
      resetUI: () => set(
        initialState,
        false,
        'resetUI'
      ),
    }),
    {
      name: 'ui-store',
    }
  )
);