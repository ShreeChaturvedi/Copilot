import { useEffect } from 'react';
import { useCommandBarStore } from '@/stores/commandBarStore';
import type { CalendarSubView } from '@/stores/settingsStore';
import {
  actionGoToday,
  actionNewTask,
  actionSetCalendarView,
} from '@/components/command/actions';

const VIEW_KEYS: Record<string, CalendarSubView> = {
  d: 'timeGridDay',
  w: 'timeGridWeek',
  m: 'dayGridMonth',
  l: 'listWeek',
};

/** True when the key event originated in a text-entry context. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
  );
}

/** True while any Radix layer (dialog, menu, popover) is open. */
function hasOpenLayer(): boolean {
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [data-state="open"][data-slot="popover-content"]'
  );
}

/**
 * Global keyboard map (design-brief §4.6): Cmd/Ctrl+K palette, T today,
 * D/W/M/L calendar views, N new task. Single-letter keys never fire while
 * typing in an input or while a dialog/menu layer is open.
 *
 * Number keys for a visible-day-count are specced as conditional; neither
 * settingsStore nor calendarSettingsStore models a day count (only discrete
 * sub-views), so they are intentionally not bound.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl+K toggles the palette from anywhere, inputs included
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useCommandBarStore.getState().toggle();
        return;
      }

      if (mod || event.altKey || event.repeat) return;
      if (event.key.length !== 1) return;
      if (isTypingTarget(event.target)) return;
      if (hasOpenLayer()) return;

      const key = event.key.toLowerCase();

      if (key === 't') {
        event.preventDefault();
        actionGoToday();
        return;
      }
      if (key in VIEW_KEYS) {
        event.preventDefault();
        actionSetCalendarView(VIEW_KEYS[key]);
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        actionNewTask();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
