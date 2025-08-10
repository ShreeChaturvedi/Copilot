import { useMemo, useState, useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/toggle';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/Select';
import { generateRRule, parseRRule, toHumanText, type RecurrenceEditorOptions } from '@/utils/recurrence';

interface RecurrenceSectionProps {
  startDateTime?: Date;
  value?: string;
  exceptions: string[];
  onChange: (rrule: string | null) => void;
  onClearExceptions?: () => void;
  showSummary?: boolean;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurrenceSection(props: RecurrenceSectionProps) {
  const { startDateTime, value, exceptions, onChange, onClearExceptions, showSummary = false } = props;

  const initialOpts: RecurrenceEditorOptions = useMemo(() => {
    const parsed = value ? parseRRule(value) : null;
    if (parsed) return parsed;
    return {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: startDateTime ? [new Date(startDateTime).getDay()] : [new Date().getDay()],
      ends: 'never',
      until: null,
      count: null,
    };
  }, [value, startDateTime]);

  const [opts, setOpts] = useState<RecurrenceEditorOptions>(initialOpts);
  const [summary, setSummary] = useState<string>('Does not repeat');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    // Recompute summary when options or start time change
    if (!value) {
      setSummary('Does not repeat');
      return;
    }
    setSummary(toHumanText(value, startDateTime || new Date()));
  }, [startDateTime, value]);

  const handleFreqChange = (freq: RecurrenceEditorOptions['frequency'] | 'none') => {
    if (freq === 'none') {
      onChange(null);
      setSummary('Does not repeat');
      return;
    }
    const next: RecurrenceEditorOptions = { ...opts, frequency: freq };
    // Defaults per frequency
    if (freq === 'weekly' && (!next.daysOfWeek || next.daysOfWeek.length === 0)) {
      next.daysOfWeek = [startDateTime ? new Date(startDateTime).getDay() : new Date().getDay()];
    }
    if (freq === 'monthly') {
      next.dayOfMonth = startDateTime ? new Date(startDateTime).getDate() : new Date().getDate();
      next.monthlyBySetPos = undefined;
      next.monthlyWeekday = undefined;
    }
    if (freq === 'yearly') {
      const dt = startDateTime ? new Date(startDateTime) : new Date();
      next.month = dt.getMonth() + 1;
      next.yearDayOfMonth = dt.getDate();
      next.yearNthWeekday = null;
    }
    setOpts(next);
    const generated = generateRRule(next, startDateTime || new Date());
    onChange(generated);
  };

  const handleIntervalChange = (n: number) => {
    const next = { ...opts, interval: Math.max(1, Math.floor(n || 1)) };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  const toggleDay = (day: number) => {
    const set = new Set(opts.daysOfWeek || []);
    if (set.has(day)) set.delete(day); else set.add(day);
    const next = { ...opts, daysOfWeek: Array.from(set).sort((a, b) => a - b) };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  const handleMonthModeChange = (mode: 'dayOfMonth' | 'nthWeekday') => {
    const dt = startDateTime ? new Date(startDateTime) : new Date();
    if (mode === 'dayOfMonth') {
      const next = { ...opts, dayOfMonth: dt.getDate(), monthlyBySetPos: undefined, monthlyWeekday: undefined };
      setOpts(next);
      onChange(generateRRule(next, startDateTime || new Date()));
    } else {
      const weekday = dt.getDay();
      const weekIndex = Math.ceil(dt.getDate() / 7); // 1..5 approx, 5 means last
      const setpos = weekIndex >= 5 ? -1 : weekIndex;
      const next = { ...opts, dayOfMonth: undefined, monthlyBySetPos: setpos, monthlyWeekday: weekday };
      setOpts(next);
      onChange(generateRRule(next, startDateTime || new Date()));
    }
  };

  const handleEndsChange = (ends: 'never' | 'on' | 'after') => {
    const next = { ...opts, ends, count: ends === 'after' ? (opts.count || 10) : null, until: ends === 'on' ? (opts.until || addDays(new Date(), 30)) : null };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  const handleUntilChange = (d?: Date) => {
    if (!d) return;
    const next = { ...opts, until: d };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
    setShowDatePicker(false);
  };

  const handleCountChange = (c: number) => {
    const next = { ...opts, count: Math.max(1, Math.floor(c || 1)) };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  const currentFreq: 'none' | RecurrenceEditorOptions['frequency'] = value ? (opts.frequency) : 'none';

  const unitLabel = useMemo(() => {
    switch (opts.frequency) {
      case 'daily':
        return 'days';
      case 'weekly':
        return 'weeks';
      case 'monthly':
        return 'months';
      case 'yearly':
        return 'years';
      default:
        return 'times';
    }
  }, [opts.frequency]);

  const weekdayLong = (d: number) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];

  const nthLabel = (date: Date) => {
    const day = date.getDate();
    const weekIndex = Math.ceil(day / 7); // 1..5 (5 ~ last)
    if (weekIndex >= 5) return 'last';
    return ['first','second','third','fourth'][weekIndex - 1] || 'first';
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Repeat</span>
        </div>
        {exceptions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearExceptions} className="text-xs">Clear exceptions ({exceptions.length})</Button>
        )}
      </div>

      {/* Frequency */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={currentFreq} onValueChange={(val) => handleFreqChange(val as any)}>
          <SelectTrigger>
            <SelectValue placeholder="Does not repeat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Does not repeat</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Frequency</SelectLabel>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {currentFreq !== 'none' && (
          <div className="flex items-center gap-2">
            <span className="text-sm">Every</span>
            <Input type="number" min={1} className="w-16" value={opts.interval} onChange={(e) => handleIntervalChange(parseInt(e.target.value || '1', 10))} />
            <span className="text-sm">{unitLabel}</span>
          </div>
        )}
      </div>

      {/* Weekly days */}
      {currentFreq === 'weekly' && (
        <div className="flex gap-2 flex-wrap">
          {weekdayLabels.map((label, idx) => (
            <Toggle
              key={label}
              pressed={(opts.daysOfWeek || []).includes(idx)}
              onPressedChange={() => toggleDay(idx)}
              variant="outline"
              size="sm"
            >
              {label}
            </Toggle>
          ))}
        </div>
      )}

      {/* Monthly mode */}
      {currentFreq === 'monthly' && (
        <RadioGroup className="flex items-center gap-4 flex-wrap">
          <label className="inline-flex items-center gap-2">
            <RadioGroupItem
              value="day"
              checked={Boolean(opts.dayOfMonth)}
              onClick={() => handleMonthModeChange('dayOfMonth')}
            />
            <span className="text-sm">On day {opts.dayOfMonth || (startDateTime ? new Date(startDateTime).getDate() : new Date().getDate())}</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <RadioGroupItem
              value="nth"
              checked={Boolean(opts.monthlyBySetPos && typeof opts.monthlyWeekday === 'number')}
              onClick={() => handleMonthModeChange('nthWeekday')}
            />
            <span className="text-sm">On the {nthLabel(startDateTime || new Date())} {weekdayLong((startDateTime || new Date()).getDay())}</span>
          </label>
        </RadioGroup>
      )}

      {/* Yearly controls (simple) */}
      {currentFreq === 'yearly' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">On</span>
          <Input type="number" min={1} max={12} className="w-16" value={opts.month || (startDateTime ? new Date(startDateTime).getMonth()+1 : new Date().getMonth()+1)} onChange={(e) => {
            const v = Math.min(12, Math.max(1, parseInt(e.target.value||'1', 10)));
            const next = { ...opts, month: v };
            setOpts(next);
            onChange(generateRRule(next, startDateTime || new Date()));
          }} />
          <span className="text-sm">/</span>
          <Input type="number" min={1} max={31} className="w-16" value={opts.yearDayOfMonth || (startDateTime ? new Date(startDateTime).getDate() : new Date().getDate())} onChange={(e) => {
            const v = Math.min(31, Math.max(1, parseInt(e.target.value||'1', 10)));
            const next = { ...opts, yearDayOfMonth: v };
            setOpts(next);
            onChange(generateRRule(next, startDateTime || new Date()));
          }} />
        </div>
      )}

      {/* End conditions */}
      {currentFreq !== 'none' && (
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={opts.ends || 'never'} onValueChange={(val) => handleEndsChange(val as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never ends</SelectItem>
              <SelectItem value="on">On date…</SelectItem>
              <SelectItem value="after">After N occurrences…</SelectItem>
            </SelectContent>
          </Select>

          {opts.ends === 'on' && (
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><CalendarIcon className="h-4 w-4" /> {opts.until ? format(opts.until, 'yyyy-MM-dd') : 'Pick date'}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker mode="single" selected={opts.until || undefined} onSelect={(d) => handleUntilChange(d)} initialFocus />
              </PopoverContent>
            </Popover>
          )}

          {opts.ends === 'after' && (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} className="w-20" value={opts.count || 10} onChange={(e) => handleCountChange(parseInt(e.target.value||'1', 10))} />
              <span className="text-sm">occurrences</span>
            </div>
          )}
        </div>
      )}

      {/* Summary (optional) */}
      {showSummary && (
        <div className="text-sm text-muted-foreground">{summary}</div>
      )}
    </div>
  );
}

