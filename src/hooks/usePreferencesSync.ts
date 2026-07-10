import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCalendarSettingsStore } from '@/stores/calendarSettingsStore';
import { useUIStore } from '@/stores/uiStore';
import { userAPI } from '@/services/api/user';

/**
 * On authentication, load the user's saved preferences from the server and
 * apply them to the app shell. Workspace prefs from Settings > General are
 * applied here on login so theme, default view, and week start survive reload.
 */
export function usePreferencesSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;

    // The results are written to global stores, which is safe even if this
    // component has unmounted. We intentionally do NOT gate application on a
    // mounted flag: under StrictMode the cleanup would run before the fetch
    // resolves and silently drop the preferences.
    (async () => {
      try {
        const prefs = await userAPI.getPreferences();

        // Theme: an explicit in-app choice always wins over the server
        // value (#68, #69). The server theme only applies in a browser
        // where the user has never touched the appearance control, and it
        // is applied without being marked as a user choice.
        const themeStore = useThemeStore.getState();
        if (!themeStore.hasExplicitPreference) {
          themeStore.applySyncedTheme(prefs.theme as Theme);
        }

        // First day of the week for the calendar grid
        useCalendarSettingsStore.getState().setWeekStartsOn(prefs.weekStartsOn);

        // Startup view ('last-used' keeps the locally persisted view)
        if (prefs.defaultView === 'calendar' || prefs.defaultView === 'tasks') {
          const view = prefs.defaultView === 'tasks' ? 'task' : 'calendar';
          useSettingsStore.getState().setAppViewMode(view);
          useUIStore.getState().setCurrentView(view);
        }
      } catch {
        // Preferences are best-effort; a load failure leaves local defaults.
        syncedRef.current = false;
      }
    })();
  }, [isAuthenticated]);
}
