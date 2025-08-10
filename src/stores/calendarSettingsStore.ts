import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type TimeRangeMode = 'default' | 'fullDay' | 'custom';

interface CalendarSettingsState {
  timeRangeMode: TimeRangeMode;
  customStartHour: number; // 0-24
  customEndHour: number;   // 0-24

  setTimeRangeMode: (mode: TimeRangeMode) => void;
  setCustomRange: (startHour: number, endHour: number) => void;

  getEffectiveRange: () => { startHour: number; endHour: number };
  getSlotTimes: () => { slotMinTime: string; slotMaxTime: string };
}

const clampHour = (hour: number) => Math.min(24, Math.max(0, Math.floor(hour)));

const formatSlotTime = (hour: number) => {
  const clamped = clampHour(hour);
  const hh = clamped.toString().padStart(2, '0');
  return `${hh}:00:00`;
};

export const useCalendarSettingsStore = create<CalendarSettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        timeRangeMode: 'default',
        customStartHour: 6,
        customEndHour: 22,

        setTimeRangeMode: (mode) => set({ timeRangeMode: mode }, false, 'setTimeRangeMode'),

        setCustomRange: (start, end) => {
          const startHour = clampHour(start);
          const endHour = clampHour(end);
          const adjustedStart = Math.min(startHour, endHour - 1);
          const adjustedEnd = Math.max(endHour, startHour + 1);
          set({ customStartHour: adjustedStart, customEndHour: adjustedEnd }, false, 'setCustomRange');
        },

        getEffectiveRange: () => {
          const state = get();
          if (state.timeRangeMode === 'fullDay') {
            return { startHour: 0, endHour: 24 };
          }
          if (state.timeRangeMode === 'custom') {
            return {
              startHour: clampHour(state.customStartHour),
              endHour: clampHour(state.customEndHour),
            };
          }
          // default
          return { startHour: 6, endHour: 22 };
        },

        getSlotTimes: () => {
          const { startHour, endHour } = get().getEffectiveRange();
          return {
            slotMinTime: formatSlotTime(startHour),
            slotMaxTime: formatSlotTime(endHour),
          };
        },
      }),
      {
        name: 'calendar-settings-store',
        partialize: (state) => ({
          timeRangeMode: state.timeRangeMode,
          customStartHour: state.customStartHour,
          customEndHour: state.customEndHour,
        }),
      }
    ),
    { name: 'calendar-settings-store' }
  )
);

