import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SharedToggleButton, type ToggleOption } from '@/components/ui/SharedToggleButton';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { useCalendarSettingsStore, type TimeRangeMode } from '@/stores/calendarSettingsStore';

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendar Time Range</CardTitle>
          <CardDescription>
            Control which hours are visible in the calendar time grid (week and day views).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm">Mode</Label>
            <SharedToggleButton
              currentValue={timeRangeMode}
              options={MODE_OPTIONS}
              onValueChange={(mode) => setTimeRangeMode(mode as TimeRangeMode)}
              size="md"
            />
          </div>

          {timeRangeMode === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm">Custom Range</Label>
              <RangeSlider
                min={0}
                max={24}
                step={1}
                values={[customStartHour, customEndHour]}
                onChange={([start, end]) => setCustomRange(start, end)}
              />
            </div>
          )}

          <Separator />

          <div className="text-sm text-muted-foreground">
            Visible Hours: <span className="font-medium text-foreground">{effectiveLabel}</span>
          </div>
        </CardContent>
      </Card>
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

