import React, { useState, useEffect } from 'react';
import { Calendar, Bell, BellRing } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CustomTimeInput } from '@/components/ui/CustomTimeInput';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DueDateBadgeProps {
  taskId: string;
  date?: Date;
  onChange: (date: Date | undefined) => void;
}

export const DueDateBadge: React.FC<DueDateBadgeProps> = ({
  taskId,
  date,
  onChange,
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

  useEffect(() => {
    setSelectedDate(date);
    setIncludeTime(date ? !(date.getHours() === 0 && date.getMinutes() === 0) : false);
    setTimeValue(date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '12:00');
  }, [date]);

  const formatDisplay = (d?: Date) => {
    if (!d) return 'Add due date';
    const base = format(d, 'MM/dd/yyyy');
    if (includeTime) {
      return `${base} @ ${format(d, 'h:mm a')}`;
    }
    return base;
  };

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
        <Badge
          variant="outline"
          className={cn(
            "text-xs px-2 py-1 gap-1 transition-colors cursor-pointer",
            (() => {
              const hasReminder = remind !== 'none';
              const overdue = hasReminder && selectedDate ? selectedDate.getTime() < Date.now() : false;
              if (hasReminder && overdue) return "text-[#ef4444] border-[#ef4444] hover:border-[#ef4444]";
              if (hasReminder) return "text-[#3b82f6] border-[#3b82f6] hover:border-[#3b82f6]";
              return "text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50";
            })()
          )}
          style={(() => {
            const hasReminder = remind !== 'none';
            if (!hasReminder) return undefined;
            const overdue = selectedDate ? selectedDate.getTime() < Date.now() : false;
            const hex = overdue ? '#ef4444' : '#3b82f6';
            return { backgroundColor: `${hex}1A`, borderColor: hex, color: hex } as React.CSSProperties;
          })()}
          aria-label="Edit due date"
        >
          {(() => {
            const hasReminder = remind !== 'none';
            const overdue = hasReminder && selectedDate ? selectedDate.getTime() < Date.now() : false;
            if (hasReminder && overdue) return <BellRing className="w-3 h-3" />;
            if (hasReminder) return <Bell className="w-3 h-3" />;
            return <Calendar className="w-3 h-3" />;
          })()}
          {formatDisplay(selectedDate)}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-auto" align="start">
        <div className="space-y-3">
          {/* Top display with optional time field */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-medium">
              {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select a date'}
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
            className="[--cell-size:--spacing(7)]"
          />

          {/* Include time switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`include-time-${taskId}`} className="text-sm">Include time</Label>
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
            <Button size="sm" onClick={() => apply(selectedDate)}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};