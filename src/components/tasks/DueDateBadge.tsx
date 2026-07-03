import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Bell, BellRing } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CustomTimeInput } from '@/components/ui/CustomTimeInput';
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInCalendarDays,
} from 'date-fns';
import { useSettingsStore, type DateDisplayMode } from '@/stores/settingsStore';
import './task-item.css';

type Proximity = 'overdue' | 'today' | 'later' | 'none';

const hasTimeComponent = (d: Date) =>
  !(d.getHours() === 0 && d.getMinutes() === 0);

/** Proximity ink (design-brief §4.1): overdue --destructive, today --aqua,
 *  later/none --muted. Keyed on the date itself, never on reminder state. */
const getDueProximity = (d?: Date, now: Date = new Date()): Proximity => {
  if (!d) return 'none';
  const overdue = hasTimeComponent(d)
    ? d.getTime() < now.getTime()
    : differenceInCalendarDays(d, now) < 0;
  if (overdue) return 'overdue';
  if (isToday(d)) return 'today';
  return 'later';
};

interface DueDateBadgeProps {
  taskId: string;
  date?: Date;
  onChange: (date: Date | undefined) => void;
  /** Optional: hide the removable hover-X for manual due date badge */
  hideRemove?: boolean;
  /** Optional: label when no date is set */
  emptyLabel?: string;
}

export const DueDateBadge: React.FC<DueDateBadgeProps> = ({
  taskId,
  date,
  onChange,
  hideRemove: _hideRemoveUnused,
  emptyLabel = 'Add due date',
}) => {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date);
  const [includeTime, setIncludeTime] = useState<boolean>(() => {
    if (!date) return false;
    return !(date.getHours() === 0 && date.getMinutes() === 0);
  });
  const [timeValue, setTimeValue] = useState<string>(() => {
    if (!date) return '12:00';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });
  const [remind, setRemind] = useState<string>('none');

  // Global date display preference
  const dateDisplayMode = useSettingsStore((s) => s.dateDisplayMode);

  useEffect(() => {
    setSelectedDate(date);
    setIncludeTime(
      date ? !(date.getHours() === 0 && date.getMinutes() === 0) : false
    );
    setTimeValue(
      date
        ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : '12:00'
    );
  }, [date]);

  // Compact mono chip text (design-brief §4.1/§3: every time-numeral mono).
  // Relative: `Today 14:00` / `Thu 14:00` / `Jul 21`; absolute: `07/21/2026 14:00`.
  const formatDisplay = useMemo(() => {
    return (d?: Date) => {
      if (!d) return emptyLabel;
      const withTime = includeTime && hasTimeComponent(d);
      if (dateDisplayMode === 'absolute') {
        const base = format(d, 'MM/dd/yyyy');
        return withTime ? `${base} ${format(d, 'HH:mm')}` : base;
      }
      const time = withTime ? ` ${format(d, 'HH:mm')}` : '';
      if (isToday(d)) return `Today${time}`;
      if (isTomorrow(d)) return `Tomorrow${time}`;
      if (isYesterday(d)) return `Yesterday${time}`;
      const days = differenceInCalendarDays(d, new Date());
      if (days > 0 && days < 7) return `${format(d, 'EEE')}${time}`;
      if (d.getFullYear() === new Date().getFullYear())
        return `${format(d, 'MMM d')}${time}`;
      return format(d, 'MMM d yyyy');
    };
  }, [dateDisplayMode, includeTime, emptyLabel]);

  const apply = (next?: Date) => {
    onChange(next);
    setOpen(false);
  };

  const handleCalendarSelect = (d?: Date) => {
    if (!d) return;
    const withTime = new Date(d);
    if (includeTime) {
      const [hh, mm] = timeValue.split(':').map((n) => parseInt(n || '0', 10));
      withTime.setHours(hh || 0, mm || 0, 0, 0);
    } else {
      withTime.setHours(0, 0, 0, 0);
    }
    setSelectedDate(withTime);
  };

  const handleTimeChange = (value: string) => {
    setTimeValue(value);
    if (selectedDate) {
      const [hh, mm] = value.split(':').map((n) => parseInt(n || '0', 10));
      const next = new Date(selectedDate);
      next.setHours(hh || 0, mm || 0, 0, 0);
      setSelectedDate(next);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ti-due"
          data-proximity={getDueProximity(selectedDate)}
          aria-label="Edit due date"
          data-testid="due-date-badge"
        >
          {(() => {
            const hasReminder = remind !== 'none';
            const overdue = getDueProximity(selectedDate) === 'overdue';
            if (hasReminder && overdue) return <BellRing />;
            if (hasReminder) return <Bell />;
            return <Calendar />;
          })()}
          {formatDisplay(selectedDate)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-auto" align="start">
        <div className="space-y-3">
          {/* Top display with optional time field */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-medium font-mono tabular-nums">
              {selectedDate
                ? format(selectedDate, 'MMM d, yyyy')
                : 'Select a date'}
            </div>
            {includeTime && (
              <div className="flex items-center gap-2">
                <CustomTimeInput
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="h-8 w-[114px]"
                />
              </div>
            )}
          </div>

          <CalendarPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            captionLayout="dropdown"
            className="[--cell-size:--spacing(7)] w-full"
          />

          {/* Include time switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`include-time-${taskId}`} className="text-sm">
              Include time
            </Label>
            <Switch
              id={`include-time-${taskId}`}
              checked={includeTime}
              onCheckedChange={(checked) => {
                setIncludeTime(!!checked);
                if (selectedDate) {
                  const next = new Date(selectedDate);
                  if (!checked) {
                    next.setHours(0, 0, 0, 0);
                  }
                  setSelectedDate(next);
                }
              }}
            />
          </div>

          {/* Display mode selector */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Display</Label>
            <Select
              value={dateDisplayMode}
              onValueChange={(v) =>
                useSettingsStore
                  .getState()
                  .setDateDisplayMode(v as DateDisplayMode)
              }
            >
              <SelectTrigger size="sm" className="min-w-[150px]">
                <SelectValue placeholder="Relative" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relative">Relative</SelectItem>
                <SelectItem value="absolute">Absolute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remind dropdown - UI only */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Remind</Label>
            <Select value={remind} onValueChange={setRemind}>
              <SelectTrigger size="sm" className="min-w-[150px]">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="at-time">At time of due date</SelectItem>
                <SelectItem value="5m">5 minutes before</SelectItem>
                <SelectItem value="15m">15 minutes before</SelectItem>
                <SelectItem value="30m">30 minutes before</SelectItem>
                <SelectItem value="1h">1 hour before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(undefined);
                apply(undefined);
              }}
            >
              Clear
            </Button>
            <Button size="sm" onClick={() => apply(selectedDate)}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
