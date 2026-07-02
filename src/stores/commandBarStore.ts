import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CommandBarState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * Cmd+K command bar open state (design-brief §4.6).
 * Shared between the global shortcut hook and the CommandBar mount.
 */
export const useCommandBarStore = create<CommandBarState>()(
  devtools(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }, false, 'setOpen'),
      toggle: () => set((s) => ({ open: !s.open }), false, 'toggle'),
    }),
    { name: 'command-bar-store' }
  )
);
