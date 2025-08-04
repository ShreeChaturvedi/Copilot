import { ReactNode, useEffect, useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { initializeTheme } = useThemeStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initTheme = async () => {
      try {
        // Initialize theme
        initializeTheme();
        
        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize theme:', error);
        
        if (isMounted) {
          setIsInitialized(true); // Still set to true to prevent infinite loading
        }
      }
    };

    initTheme();

    return () => {
      isMounted = false;
    };
  }, [initializeTheme]);

  // Optional: Add a brief loading state to prevent flash of unstyled content
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
};