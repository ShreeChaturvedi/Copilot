import { useEffect } from 'react';
import { isOverlayOpen, isTypingTarget } from './useGlobalShortcuts';
import { getModKey, withKbdNav } from '@/components/command/actions';

export type CalendarViewKey = 'D' | 'W' | 'M' | 'L';

interface KeyboardShortcutsOptions {
  /**
   * @deprecated ⌘P Print-override binding was removed; kept for caller compat.
   */
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  /**
   * @deprecated ⌘Q logout binding was removed (OS-reserved / native confirm);
   * kept for caller compat.
   */
  onLogout?: () => void;
  /** Single-key `T`: go to today (calendar surfaces) */
  onToday?: () => void;
  /** Single keys `D/W/M/L`: switch calendar view */
  onViewKey?: (key: CalendarViewKey) => void;
  /** ArrowLeft: previous period */
  onPrev?: () => void;
  /** ArrowRight: next period */
  onNext?: () => void;
}

/**
 * Global keyboard shortcuts hook
 * Handles application-wide shortcuts (modifier combos) and, when the
 * calendar handlers are provided, the single-key map:
 * `T` today, `D/W/M/L` views, arrow keys navigate.
 */
export function useKeyboardShortcuts({
  onOpenSettings,
  onOpenHelp,
  onToday,
  onViewKey,
  onPrev,
  onNext,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;

      // Prevent default browser shortcuts when our shortcuts are used
      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (isModifierPressed) {
        switch (event.key.toLowerCase()) {
          case ',':
            // ⌘, / Ctrl+, - Open Settings (common pattern)
            if (!onOpenSettings) break;
            preventDefault();
            onOpenSettings();
            break;

          case '?':
            // ⌘? / Ctrl+? (⇧+/ produces '?') - keyboard shortcuts help
            if (!onOpenHelp) break;
            preventDefault();
            onOpenHelp();
            break;

          default:
            break;
        }
        return;
      }

      // Single-key map (calendar): inert while typing or under an overlay.
      if (event.altKey || isTypingTarget(event.target) || isOverlayOpen())
        return;

      switch (event.key) {
        case 't':
        case 'T':
          if (!onToday) break;
          preventDefault();
          withKbdNav(onToday);
          break;

        case 'd':
        case 'D':
        case 'w':
        case 'W':
        case 'm':
        case 'M':
        case 'l':
        case 'L':
          if (!onViewKey) break;
          preventDefault();
          withKbdNav(() =>
            onViewKey(event.key.toUpperCase() as CalendarViewKey)
          );
          break;

        case 'ArrowLeft':
          if (!onPrev) break;
          preventDefault();
          withKbdNav(onPrev);
          break;

        case 'ArrowRight':
          if (!onNext) break;
          preventDefault();
          withKbdNav(onNext);
          break;

        default:
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      });
    };
  }, [onOpenSettings, onOpenHelp, onToday, onViewKey, onPrev, onNext]);
}

/**
 * Get keyboard shortcuts help text
 */
export const getKeyboardShortcuts = () => {
  const modKey = getModKey();

  return [
    { keys: `${modKey}+K`, description: 'Open command palette' },
    { keys: 'N', description: 'New task' },
    { keys: 'T', description: 'Go to today' },
    { keys: 'D / W / M / L', description: 'Day, Week, Month, List view' },
    { keys: '← / →', description: 'Previous / next period' },
    { keys: `${modKey}+,`, description: 'Open settings' },
    { keys: `${modKey}+?`, description: 'Keyboard shortcuts' },
  ];
};
