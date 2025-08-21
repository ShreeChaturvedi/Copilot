import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type DateDisplayMode = 'relative' | 'absolute';
export type AppViewMode = 'calendar' | 'task';
export type CalendarSubView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
export type SavedTaskGrouping = 'taskList' | 'dueDate' | 'priority';
export type TaskCompletionControl = 'checkbox' | 'status-tag';

export interface SavedTaskPaneConfig {
  id: string;
  grouping: SavedTaskGrouping;
  filterValue?: string;
  selectedTaskListId: string | null;
  showCompleted: boolean;
}

interface SettingsState {
  dateDisplayMode: DateDisplayMode;
  /** Expanded/collapsed state of SmartTaskInput in the left pane when in calendar view */
  calendarViewInputExpanded: boolean;
  /** Expanded/collapsed state of mini calendar in the left pane when in task view */
  taskViewMiniCalendarExpanded: boolean;
  /** Expanded/collapsed state of the main sidebar */
  sidebarExpanded: boolean;
  /** App-level view mode: calendar vs task */
  appViewMode: AppViewMode;
  /** Calendar sub-view when in calendar mode */
  calendarSubView: CalendarSubView;
  /** Multi-pane setup for the task list view */
  taskPaneSetup: SavedTaskPaneConfig[];
  /** Saved sizes (percentages) for the task pane layout */
  taskPaneLayoutSizes: number[];
  /** Whether the enhanced input panel is visible in task view */
  enhancedInputVisible: boolean;
  /** Selected task list for the enhanced input panel (task view) */
  enhancedInputTaskListId: string | null;
  /** Selected task list for the left pane SmartTaskInput (calendar view) */
  leftSmartInputTaskListId: string | null;
  /** How task completion is controlled/rendered in list view */
  taskCompletionControl: TaskCompletionControl;
  /** Whether to show the sidebar task analytics summary */
  showSidebarTaskAnalytics: boolean;

  // Actions
  setDateDisplayMode: (mode: DateDisplayMode) => void;
  setCalendarViewInputExpanded: (expanded: boolean) => void;
  toggleCalendarViewInput: () => void;
  setTaskViewMiniCalendarExpanded: (expanded: boolean) => void;
  toggleTaskViewMiniCalendar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  setAppViewMode: (view: AppViewMode) => void;
  setCalendarSubView: (view: CalendarSubView) => void;
  setTaskPaneSetup: (setup: SavedTaskPaneConfig[]) => void;
  setTaskPaneLayoutSizes: (sizes: number[]) => void;
  setEnhancedInputVisible: (visible: boolean) => void;
  setEnhancedInputTaskListId: (taskListId: string | null) => void;
  setLeftSmartInputTaskListId: (taskListId: string | null) => void;
  setTaskCompletionControl: (mode: TaskCompletionControl) => void;
  setShowSidebarTaskAnalytics: (visible: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        dateDisplayMode: 'relative',
        calendarViewInputExpanded: true,
        taskViewMiniCalendarExpanded: true,
        sidebarExpanded: true,
        appViewMode: 'calendar',
        calendarSubView: 'timeGridWeek',
        taskPaneSetup: [
          {
            id: 'pane-1',
            grouping: 'taskList',
            selectedTaskListId: null,
            showCompleted: false,
          },
        ],
        taskPaneLayoutSizes: [],
        enhancedInputVisible: false,
        enhancedInputTaskListId: null,
        leftSmartInputTaskListId: null,
        taskCompletionControl: 'checkbox',
        showSidebarTaskAnalytics: true,

        setDateDisplayMode: (mode) => set({ dateDisplayMode: mode }, false, 'setDateDisplayMode'),
        setCalendarViewInputExpanded: (expanded) =>
          set({ calendarViewInputExpanded: expanded }, false, 'setCalendarViewInputExpanded'),
        toggleCalendarViewInput: () =>
          set(
            { calendarViewInputExpanded: !get().calendarViewInputExpanded },
            false,
            'toggleCalendarViewInput'
          ),
        setTaskViewMiniCalendarExpanded: (expanded) =>
          set({ taskViewMiniCalendarExpanded: expanded }, false, 'setTaskViewMiniCalendarExpanded'),
        toggleTaskViewMiniCalendar: () =>
          set(
            { taskViewMiniCalendarExpanded: !get().taskViewMiniCalendarExpanded },
            false,
            'toggleTaskViewMiniCalendar'
          ),
        setSidebarExpanded: (expanded) =>
          set({ sidebarExpanded: expanded }, false, 'setSidebarExpanded'),
        toggleSidebar: () =>
          set({ sidebarExpanded: !get().sidebarExpanded }, false, 'toggleSidebar'),
        setAppViewMode: (view) => set({ appViewMode: view }, false, 'setAppViewMode'),
        setCalendarSubView: (view) => set({ calendarSubView: view }, false, 'setCalendarSubView'),
        setTaskPaneSetup: (setup) => set({ taskPaneSetup: setup }, false, 'setTaskPaneSetup'),
        setTaskPaneLayoutSizes: (sizes) => set({ taskPaneLayoutSizes: sizes }, false, 'setTaskPaneLayoutSizes'),
        setEnhancedInputVisible: (visible) => set({ enhancedInputVisible: visible }, false, 'setEnhancedInputVisible'),
        setEnhancedInputTaskListId: (taskListId) => set({ enhancedInputTaskListId: taskListId }, false, 'setEnhancedInputTaskListId'),
        setLeftSmartInputTaskListId: (taskListId) => set({ leftSmartInputTaskListId: taskListId }, false, 'setLeftSmartInputTaskListId'),
        setTaskCompletionControl: (mode) => set({ taskCompletionControl: mode }, false, 'setTaskCompletionControl'),
        setShowSidebarTaskAnalytics: (visible) => set({ showSidebarTaskAnalytics: visible }, false, 'setShowSidebarTaskAnalytics'),
      }),
      {
        name: 'settings-store',
        partialize: (state) => ({
          dateDisplayMode: state.dateDisplayMode,
          calendarViewInputExpanded: state.calendarViewInputExpanded,
          taskViewMiniCalendarExpanded: state.taskViewMiniCalendarExpanded,
          sidebarExpanded: state.sidebarExpanded,
          appViewMode: state.appViewMode,
          calendarSubView: state.calendarSubView,
          taskPaneSetup: state.taskPaneSetup,
          taskPaneLayoutSizes: state.taskPaneLayoutSizes,
          enhancedInputVisible: state.enhancedInputVisible,
          enhancedInputTaskListId: state.enhancedInputTaskListId,
          leftSmartInputTaskListId: state.leftSmartInputTaskListId,
          taskCompletionControl: state.taskCompletionControl,
          showSidebarTaskAnalytics: state.showSidebarTaskAnalytics,
        }),
      }
    ),
    { name: 'settings-store' }
  )
);


