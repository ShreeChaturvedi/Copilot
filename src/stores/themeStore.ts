import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  /**
   * True once the user has explicitly chosen a theme in this browser.
   * Server preference sync must never override an explicit local choice
   * (#68, #69).
   */
  hasExplicitPreference: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  /** Apply a server-synced theme without marking it as a user choice. */
  applySyncedTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

// Helper function to get system theme preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

// Helper function to resolve theme based on current setting
const resolveTheme = (theme: Theme): ResolvedTheme => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

// Helper function to apply theme to document
const applyThemeToDocument = (resolvedTheme: ResolvedTheme) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (resolvedTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      // Canvas hexes from the SETTLE token system (design-brief §2.1)
      resolvedTheme === 'dark' ? '#0c1112' : '#fafbfc'
    );
  }
};

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'system',
        resolvedTheme: 'light',
        hasExplicitPreference: false,

        setTheme: (theme) => {
          const resolvedTheme = resolveTheme(theme);
          applyThemeToDocument(resolvedTheme);

          set(
            { theme, resolvedTheme, hasExplicitPreference: true },
            false,
            'setTheme'
          );

          // Write the choice through to the account preferences so the
          // server value stays in sync with the in-app control (#69).
          // Best-effort and async: a failure never affects the local theme.
          void (async () => {
            try {
              const { useAuthStore } = await import('@/stores/authStore');
              if (!useAuthStore.getState().isAuthenticated) return;
              const { userAPI } = await import('@/services/api/user');
              await userAPI.updatePreferences({ theme });
            } catch {
              // Preference write-through is optional.
            }
          })();
        },

        applySyncedTheme: (theme) => {
          const resolvedTheme = resolveTheme(theme);
          applyThemeToDocument(resolvedTheme);

          set({ theme, resolvedTheme }, false, 'applySyncedTheme');
        },

        toggleTheme: () => {
          const { theme, resolvedTheme } = get();

          // If system theme, toggle to opposite of current resolved theme
          if (theme === 'system') {
            const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
            get().setTheme(newTheme);
          } else {
            // If manual theme, toggle between light and dark
            const newTheme = theme === 'light' ? 'dark' : 'light';
            get().setTheme(newTheme);
          }
        },

        initializeTheme: () => {
          const { theme, hasExplicitPreference } = get();
          const resolvedTheme = resolveTheme(theme);
          applyThemeToDocument(resolvedTheme);

          set(
            {
              resolvedTheme,
              // Migration: stores persisted before the flag existed carry a
              // non-default theme only when the user picked one.
              hasExplicitPreference: hasExplicitPreference || theme !== 'system',
            },
            false,
            'initializeTheme'
          );

          // Listen for system theme changes
          if (typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia(
              '(prefers-color-scheme: dark)'
            );

            const handleSystemThemeChange = () => {
              const currentState = get();
              if (currentState.theme === 'system') {
                const newResolvedTheme = getSystemTheme();
                applyThemeToDocument(newResolvedTheme);
                set(
                  { resolvedTheme: newResolvedTheme },
                  false,
                  'systemThemeChange'
                );
              }
            };

            // Modern browsers
            if (mediaQuery.addEventListener) {
              mediaQuery.addEventListener('change', handleSystemThemeChange);
            } else {
              // Fallback for older browsers
              mediaQuery.addListener(handleSystemThemeChange);
            }
          }
        },
      }),
      {
        name: 'theme-store',
        partialize: (state) => ({
          theme: state.theme,
          hasExplicitPreference: state.hasExplicitPreference,
        }),
        onRehydrateStorage: () => (state) => {
          // Initialize theme after rehydration
          if (state) {
            state.initializeTheme();
          }
        },
      }
    ),
    {
      name: 'theme-store',
    }
  )
);
