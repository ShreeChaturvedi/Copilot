import { useEffect } from 'react';

export type CalendarViewKey = 'D' | 'W' | 'M' | 'L';

interface KeyboardShortcutsOptions {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
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

/** True when the event targets something that consumes typing. */
const isEditableTarget = (event: KeyboardEvent): boolean => {
  const el = event.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
};

/** True while any dialog/sheet is open (single keys must not leak through). */
const isOverlayOpen = (): boolean =>
  Boolean(
    document.querySelector(
      '[data-slot=dialog-content][data-state=open], [data-slot=sheet-content][data-state=open], [role=dialog]'
    )
  );

/**
 * Keyboard-initiated actions never animate (design-brief §5): flag the
 * document for one frame window so CSS can suppress transitions
 * (`[data-kbd-nav] .view-switcher-slider { transition: none }`).
 */
const withKbdNav = (fn: () => void) => {
  document.documentElement.setAttribute('data-kbd-nav', '');
  try {
    fn();
  } finally {
    window.setTimeout(() => {
      document.documentElement.removeAttribute('data-kbd-nav');
    }, 250);
  }
};

/**
 * Global keyboard shortcuts hook
 * Handles application-wide shortcuts (modifier combos) and, when the
 * calendar handlers are provided, the single-key map:
 * `T` today, `D/W/M/L` views, arrow keys navigate.
 */
export function useKeyboardShortcuts({
  onOpenProfile,
  onOpenSettings,
  onOpenHelp,
  onLogout,
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
          case 'p':
            // ⌘P / Ctrl+P - Open Profile
            if (!onOpenProfile) break;
            preventDefault();
            onOpenProfile();
            break;

          case ',':
            // ⌘, / Ctrl+, - Open Settings (common pattern)
            if (!onOpenSettings) break;
            preventDefault();
            onOpenSettings();
            break;

          case '/':
            // ⌘⇧/ - Show keyboard shortcuts help
            if (event.shiftKey && onOpenHelp) {
              preventDefault();
              onOpenHelp();
            }
            break;

          case '?':
            // ⌘? / Ctrl+? - Help (alternative)
            if (!onOpenHelp) break;
            preventDefault();
            onOpenHelp();
            break;

          case 'q':
            // ⌘Q / Ctrl+Q - Logout (with confirmation)
            if (!onLogout) break;
            preventDefault();
            if (confirm('Are you sure you want to log out?')) {
              onLogout();
            }
            break;

          default:
            break;
        }
        return;
      }

      // Single-key map (calendar): inert while typing or under an overlay.
      if (event.altKey || isEditableTarget(event) || isOverlayOpen()) return;

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
  }, [
    onOpenProfile,
    onOpenSettings,
    onOpenHelp,
    onLogout,
    onToday,
    onViewKey,
    onPrev,
    onNext,
  ]);
}

/**
 * Get keyboard shortcuts help text
 */
export const getKeyboardShortcuts = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return [
    { keys: 'T', description: 'Go to today' },
    { keys: 'D / W / M / L', description: 'Day, Week, Month, List view' },
    { keys: '← / →', description: 'Previous / next period' },
    { keys: `${modKey}+P`, description: 'Open Profile settings' },
    { keys: `${modKey}+,`, description: 'Open Settings' },
    { keys: `${modKey}+?`, description: 'Show Help' },
    { keys: `${modKey}+Q`, description: 'Logout' },
  ];
};
