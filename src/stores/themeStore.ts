import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

// Helper function to get system theme preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
      resolvedTheme === 'dark' ? '#1f2937' : '#ffffff'
    );
  }
};

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'system',
        resolvedTheme: 'light',
        
        setTheme: (theme) => {
          const resolvedTheme = resolveTheme(theme);
          applyThemeToDocument(resolvedTheme);
          
          set(
            { theme, resolvedTheme },
            false,
            'setTheme'
          );
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
          const { theme } = get();
          const resolvedTheme = resolveTheme(theme);
          applyThemeToDocument(resolvedTheme);
          
          set(
            { resolvedTheme },
            false,
            'initializeTheme'
          );
          
          // Listen for system theme changes
          if (typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
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
        partialize: (state) => ({ theme: state.theme }),
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