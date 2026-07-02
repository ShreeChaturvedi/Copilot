import React, { useEffect, useState } from 'react';
import type { Task } from '@shared/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { CustomTimeInput } from '@/components/ui/CustomTimeInput';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/Button';

interface ScheduleTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen date when the user places the task. */
  onPlace: (taskId: string, scheduledDate: Date) => void;
}

/**
 * Schedule dialog (design-brief §4.3, fixes #44): gives a task a time.
 * The action keeps one name through its flow: `Place` -> `Placed`.
 */
export const ScheduleTaskDialog: React.FC<ScheduleTaskDialogProps> = ({
  task,
  open,
  onOpenChange,
  onPlace,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [includeTime, setIncludeTime] = useState(false);
  const [timeValue, setTimeValue] = useState('09:00');

  // Re-seed from the task each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const existing = task?.scheduledDate;
    setSelectedDate(existing ?? new Date());
    const hasTime =
      existing && !(existing.getHours() === 0 && existing.getMinutes() === 0);
    setIncludeTime(Boolean(hasTime));
    setTimeValue(
      hasTime
        ? `${String(existing.getHours()).padStart(2, '0')}:${String(
            existing.getMinutes()
          ).padStart(2, '0')}`
        : '09:00'
    );
  }, [open, task]);

  const handlePlace = () => {
    if (!task || !selectedDate) return;
    const next = new Date(selectedDate);
    if (includeTime) {
      const [hh, mm] = timeValue.split(':').map((n) => parseInt(n || '0', 10));
      next.setHours(hh || 0, mm || 0, 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
    }
    onPlace(task.id, next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Schedule task</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {task?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <CalendarPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            autoFocus
          />
          <div className="flex w-full items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Switch
                id="schedule-include-time"
                checked={includeTime}
                onCheckedChange={setIncludeTime}
              />
              <Label
                htmlFor="schedule-include-time"
                className="text-[13px] text-muted-foreground"
              >
                Time
              </Label>
            </div>
            {includeTime && (
              <CustomTimeInput
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-28"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePlace} disabled={!selectedDate}>
            Place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleTaskDialog;
