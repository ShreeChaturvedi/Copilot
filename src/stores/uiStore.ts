import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore';

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
export type TaskViewMode = 'folder' | 'list' | 'kanban';
export type DropZone = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later';
export type SortBy = 'title' | 'dueDate' | 'priority' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface TaskPaneConfig {
  id: string;
  grouping: TaskGrouping;
  filterValue?: string; // for specific task list, due date range, or priority
  selectedTaskListId: string | null; // specific task list selection for panes
  showCompleted: boolean;
}

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

  // Multi-pane task management
  taskPanes: TaskPaneConfig[];
  maxTaskPanes: number;
  globalShowCompleted: boolean;
  // Show task list context (emoji + name) in All Tasks view
  showTaskListContextInAll: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  // Selected task list id for Kanban view
  selectedKanbanTaskListId: string | null;

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

  // Multi-pane management actions
  addTaskPane: (config?: Partial<TaskPaneConfig>) => void;
  removeTaskPane: (paneId: string) => void;
  updateTaskPane: (paneId: string, updates: Partial<TaskPaneConfig>) => void;
  setGlobalShowCompleted: (show: boolean) => void;
  setSortBy: (sort: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setShowTaskListContextInAll: (show: boolean) => void;
  setSelectedKanbanTaskListId: (id: string | null) => void;

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
  taskPanes: [
    {
      id: 'pane-1',
      grouping: 'taskList' as TaskGrouping,
      selectedTaskListId: null,
      showCompleted: false,
    },
  ] as TaskPaneConfig[],
  maxTaskPanes: 3,
  globalShowCompleted: false,
  showTaskListContextInAll: false,
  sortBy: 'createdAt' as SortBy,
  sortOrder: 'desc' as SortOrder,
  dragState: {
    isDragging: false,
    taskId: null,
    dropZone: null,
  } as DragState,
  selectedKanbanTaskListId: null as string | null,
};

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      ...initialState,

      openEventModal: (event) =>
        set(
          {
            eventModalOpen: true,
            selectedEvent: event || null,
          },
          false,
          'openEventModal'
        ),

      closeEventModal: () =>
        set(
          {
            eventModalOpen: false,
            selectedEvent: null,
          },
          false,
          'closeEventModal'
        ),

      openEventDetailsModal: (event) =>
        set(
          {
            eventDetailsModalOpen: true,
            selectedEvent: event,
          },
          false,
          'openEventDetailsModal'
        ),

      closeEventDetailsModal: () =>
        set(
          {
            eventDetailsModalOpen: false,
            selectedEvent: null,
          },
          false,
          'closeEventDetailsModal'
        ),

      openSettingsModal: () =>
        set({ settingsModalOpen: true }, false, 'openSettingsModal'),

      closeSettingsModal: () =>
        set({ settingsModalOpen: false }, false, 'closeSettingsModal'),

      toggleNotesEditor: () =>
        set(
          (state) => ({ notesEditorOpen: !state.notesEditorOpen }),
          false,
          'toggleNotesEditor'
        ),

      setSelectedEvent: (event) =>
        set({ selectedEvent: event }, false, 'setSelectedEvent'),

      setLeftPaneWidth: (width) =>
        set(
          { leftPaneWidth: Math.max(200, Math.min(600, width)) },
          false,
          'setLeftPaneWidth'
        ),

      setShowCompletedTasks: (show) =>
        set({ showCompletedTasks: show }, false, 'setShowCompletedTasks'),

      setPeekMode: (mode) => set({ peekMode: mode }, false, 'setPeekMode'),

      setCurrentView: (view) =>
        set(
          () => {
            // Persist to settings store for cross-session memory
            try {
              // Access settings store without creating a React hook dependency
              const { setAppViewMode } = useSettingsStore.getState();
              setAppViewMode(view);
            } catch {
              // Ignore persistence failures
            }
            return { currentView: view };
          },
          false,
          'setCurrentView'
        ),

      setTaskGrouping: (grouping) =>
        set({ taskGrouping: grouping }, false, 'setTaskGrouping'),

      setTaskViewMode: (mode) =>
        set({ taskViewMode: mode }, false, 'setTaskViewMode'),

      setDragState: (state) =>
        set(
          (currentState) => ({
            dragState: { ...currentState.dragState, ...state },
          }),
          false,
          'setDragState'
        ),

      // Multi-pane management actions
      addTaskPane: (config) =>
        set(
          (state) => {
            if (state.taskPanes.length >= state.maxTaskPanes) return state;

            const newPane: TaskPaneConfig = {
              id: `pane-${Date.now()}`,
              grouping: config?.grouping || 'taskList',
              filterValue: config?.filterValue,
              selectedTaskListId: config?.selectedTaskListId || null,
              showCompleted: config?.showCompleted ?? state.globalShowCompleted,
            };

            return {
              taskPanes: [...state.taskPanes, newPane],
            };
          },
          false,
          'addTaskPane'
        ),

      removeTaskPane: (paneId) =>
        set(
          (state) => ({
            taskPanes:
              state.taskPanes.length > 1
                ? state.taskPanes.filter((pane) => pane.id !== paneId)
                : state.taskPanes,
          }),
          false,
          'removeTaskPane'
        ),

      updateTaskPane: (paneId, updates) =>
        set(
          (state) => ({
            taskPanes: state.taskPanes.map((pane) =>
              pane.id === paneId ? { ...pane, ...updates } : pane
            ),
          }),
          false,
          'updateTaskPane'
        ),

      setGlobalShowCompleted: (show) =>
        set(
          (state) => ({
            globalShowCompleted: show,
            taskPanes: state.taskPanes.map((pane) => ({
              ...pane,
              showCompleted: show,
            })),
          }),
          false,
          'setGlobalShowCompleted'
        ),

      setSortBy: (sort) => set({ sortBy: sort }, false, 'setSortBy'),

      setSortOrder: (order) => set({ sortOrder: order }, false, 'setSortOrder'),

      setShowTaskListContextInAll: (show) =>
        set(
          { showTaskListContextInAll: show },
          false,
          'setShowTaskListContextInAll'
        ),

      setSelectedKanbanTaskListId: (id) =>
        set(
          { selectedKanbanTaskListId: id },
          false,
          'setSelectedKanbanTaskListId'
        ),

      resetUI: () => set(initialState, false, 'resetUI'),
    }),
    {
      name: 'ui-store',
    }
  )
);
