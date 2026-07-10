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

/**
 * Keyboard-initiated actions never animate (design-brief §5): flag the
 * document for a short window so CSS can suppress the view-switcher slider
 * transition (`[data-kbd-nav] .view-switcher-slider { transition: none }`).
 * Shared by both keyboard hooks so the Task-view path (which routes through
 * these actions) suppresses the slider the same way the calendar path does.
 */
export function withKbdNav(fn: () => void) {
  document.documentElement.setAttribute('data-kbd-nav', '');
  try {
    fn();
  } finally {
    window.setTimeout(() => {
      document.documentElement.removeAttribute('data-kbd-nav');
    }, 250);
  }
}

/**
 * Best-effort Mac detection, preferring the non-deprecated UA Client Hints
 * platform over the deprecated `navigator.platform`. One shared source so the
 * palette and the shortcut cheatsheet never render mismatched ⌘/Ctrl keycaps.
 */
export function getIsMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform;
  if (uaPlatform) return /mac/i.test(uaPlatform);
  return /mac/i.test(navigator.userAgent);
}

/** The platform modifier glyph used in keycap hints. */
export const getModKey = (): string => (getIsMac() ? '⌘' : 'Ctrl');

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

/** Open the Account settings section (the former ⌘P profile target). */
export function actionOpenProfile() {
  window.dispatchEvent(
    new CustomEvent(APP_EVENT_OPEN_SETTINGS, {
      detail: { section: 'account' },
    })
  );
}

/** Collapse/expand the main sidebar. */
export function actionToggleSidebar() {
  useSettingsStore.getState().toggleSidebar();
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
