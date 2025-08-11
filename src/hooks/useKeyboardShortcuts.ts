import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface KeyboardShortcutsOptions {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
}

/**
 * Global keyboard shortcuts hook
 * Handles application-wide keyboard shortcuts
 */
export function useKeyboardShortcuts({
  onOpenProfile,
  onOpenSettings,
  onOpenHelp,
  onLogout,
}: KeyboardShortcutsOptions) {
  const { logout } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      const isModifierPressed = event.metaKey || event.ctrlKey;
      
      if (!isModifierPressed) return;

      // Prevent default browser shortcuts when our shortcuts are used
      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      switch (event.key.toLowerCase()) {
        case 'p':
          // ⌘P / Ctrl+P - Open Profile
          preventDefault();
          onOpenProfile();
          break;
        
        case ',':
          // ⌘, / Ctrl+, - Open Settings (common pattern)
          preventDefault();
          onOpenSettings();
          break;
        
        case '/':
          // ⌘/ / Ctrl+/ - Show keyboard shortcuts help
          if (event.shiftKey) {
            preventDefault();
            onOpenHelp();
          }
          break;
        
        case '?':
          // ⌘? / Ctrl+? - Help (alternative)
          preventDefault();
          onOpenHelp();
          break;
        
        case 'q':
          // ⌘Q / Ctrl+Q - Logout (with confirmation)
          preventDefault();
          if (confirm('Are you sure you want to log out?')) {
            onLogout();
          }
          break;
        
        default:
          // No matching shortcut, don't prevent default
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [onOpenProfile, onOpenSettings, onOpenHelp, onLogout, logout]);
}

/**
 * Get keyboard shortcuts help text
 */
export const getKeyboardShortcuts = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return [
    { keys: `${modKey}+P`, description: 'Open Profile settings' },
    { keys: `${modKey}+,`, description: 'Open Settings' },
    { keys: `${modKey}+?`, description: 'Show Help' },
    { keys: `${modKey}+Q`, description: 'Logout' },
  ];
};