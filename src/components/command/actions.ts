/**
 * Shared app actions behind the Cmd+K palette and the global single-key
 * shortcuts (design-brief §4.6). Non-hook so both the keydown handler and the
 * palette rows call the same code paths.
 */
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore, type CalendarSubView } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';

/** Window-event bridges (same pattern as the existing 'app:open-settings') */
export const APP_EVENT_NEW_TASK = 'app:new-task';
export const APP_EVENT_CALENDAR_TODAY = 'app:calendar-today';
export const APP_EVENT_OPEN_SETTINGS = 'app:open-settings';

/** Open the task-creation input (enhanced input in the task view). */
export function actionNewTask() {
  const ui = useUIStore.getState();
  if (ui.currentView === 'task') {
    window.dispatchEvent(new CustomEvent(APP_EVENT_NEW_TASK));
  } else {
    // Set visibility first so TaskFocusPane mounts with the input open
    useSettingsStore.getState().setEnhancedInputVisible(true);
    ui.setCurrentView('task');
  }
}

/** Open the event-creation dialog (switching to the calendar if needed). */
export function actionNewEvent() {
  const ui = useUIStore.getState();
  ui.openEventModal();
  if (ui.currentView !== 'calendar') ui.setCurrentView('calendar');
}

/** Jump the calendar to today. A fresh calendar mount opens at today. */
export function actionGoToday() {
  const ui = useUIStore.getState();
  if (ui.currentView === 'calendar') {
    window.dispatchEvent(new CustomEvent(APP_EVENT_CALENDAR_TODAY));
  } else {
    ui.setCurrentView('calendar');
  }
}

/** Switch the calendar sub-view (D/W/M/L). */
export function actionSetCalendarView(view: CalendarSubView) {
  useSettingsStore.getState().setCalendarSubView(view);
  const ui = useUIStore.getState();
  if (ui.currentView !== 'calendar') ui.setCurrentView('calendar');
}

/** Switch between the calendar and tasks app views. */
export function actionOpenAppView(view: 'calendar' | 'task') {
  useUIStore.getState().setCurrentView(view);
}

/** Toggle light/dark theme via the theme store. */
export function actionToggleTheme() {
  useThemeStore.getState().toggleTheme();
}

/** Open the settings dialog through the existing window-event bridge. */
export function actionOpenSettings() {
  window.dispatchEvent(
    new CustomEvent(APP_EVENT_OPEN_SETTINGS, {
      detail: { section: 'general' },
    })
  );
}
