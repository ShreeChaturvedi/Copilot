import { useMemo } from 'react';
import {
  SharedToggleButton,
  type ToggleOption,
} from '@/components/ui/SharedToggleButton';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { SettingsRow } from './SettingsRow';
import {
  useCalendarSettingsStore,
  type TimeRangeMode,
} from '@/stores/calendarSettingsStore';

const MODE_OPTIONS: ToggleOption<TimeRangeMode>[] = [
  { value: 'default', label: 'Default' },
  { value: 'fullDay', label: 'Full Day' },
  { value: 'custom', label: 'Custom' },
];

export function CalendarSettings() {
  const {
    timeRangeMode,
    customStartHour,
    customEndHour,
    setTimeRangeMode,
    setCustomRange,
  } = useCalendarSettingsStore();

  const effectiveLabel = useMemo(() => {
    const { startHour, endHour } =
      timeRangeMode === 'fullDay'
        ? { startHour: 0, endHour: 24 }
        : timeRangeMode === 'custom'
          ? { startHour: customStartHour, endHour: customEndHour }
          : { startHour: 6, endHour: 22 };
    return `${formatHour(startHour)} – ${formatHour(endHour)}`;
  }, [timeRangeMode, customStartHour, customEndHour]);

  return (
    <div className="space-y-5">
      <SettingsRow
        label="Mode"
        description="Which hours are visible by default in week and day views"
        align="start"
      >
        <SharedToggleButton
          currentValue={timeRangeMode}
          options={MODE_OPTIONS}
          onValueChange={(mode) => setTimeRangeMode(mode as TimeRangeMode)}
          size="md"
        />
      </SettingsRow>

      {timeRangeMode === 'custom' && (
        <SettingsRow
          label="Custom range"
          description="Drag to set the visible start and end hour"
          align="start"
        >
          <div className="w-64 max-w-[60vw]">
            <RangeSlider
              min={0}
              max={24}
              step={1}
              values={[customStartHour, customEndHour]}
              onChange={([start, end]) => setCustomRange(start, end)}
            />
          </div>
        </SettingsRow>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <span className="text-sm text-ink-muted">Visible hours</span>
        <span className="font-mono text-[0.8125rem] tabular-nums text-foreground">
          {effectiveLabel}
        </span>
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  const clamped = Math.round(hour);
  if (clamped === 0) return '12 AM';
  if (clamped === 12) return '12 PM';
  if (clamped === 24) return '12 AM';
  const suffix = clamped < 12 ? 'AM' : 'PM';
  const h12 = clamped % 12;
  return `${h12 === 0 ? 12 : h12} ${suffix}`;
}

export default CalendarSettings;
