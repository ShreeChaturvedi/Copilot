import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type TimeRangeMode = 'default' | 'fullDay' | 'custom';

interface CalendarSettingsState {
  timeRangeMode: TimeRangeMode;
  customStartHour: number; // 0-24
  customEndHour: number;   // 0-24
  weekStartsOn: number;    // 0 (Sun) - 6 (Sat), fed from saved user preferences

  setTimeRangeMode: (mode: TimeRangeMode) => void;
  setCustomRange: (startHour: number, endHour: number) => void;
  setWeekStartsOn: (day: number) => void;

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
        weekStartsOn: 0,

        setTimeRangeMode: (mode) => set({ timeRangeMode: mode }, false, 'setTimeRangeMode'),

        setWeekStartsOn: (day) =>
          set(
            { weekStartsOn: Math.max(0, Math.min(6, Math.floor(day))) },
            false,
            'setWeekStartsOn'
          ),

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
          weekStartsOn: state.weekStartsOn,
        }),
      }
    ),
    { name: 'calendar-settings-store' }
  )
);

