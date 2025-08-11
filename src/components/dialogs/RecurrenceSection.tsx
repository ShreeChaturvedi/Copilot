import { useMemo, useState, useEffect } from 'react';
// import { addDays } from 'date-fns';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// import { Calendar as CalendarPicker } from '@/components/ui/calendar';
// import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
// import {
//   Select,
//   SelectTrigger,
//   SelectContent,
//   SelectItem,
//   SelectValue,
// } from '@/components/ui/Select';
import { generateRRule, parseRRule, toHumanText, type RecurrenceEditorOptions } from '@/utils/recurrence';

interface RecurrenceSectionProps {
  startDateTime?: Date;
  value?: string;
  exceptions: string[];
  onChange: (rrule: string | null) => void;
  onClearExceptions?: () => void;
  showSummary?: boolean;
  /** When true, end condition controls are managed by the parent row and hidden here */
  endsControlled?: boolean;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurrenceSection(props: RecurrenceSectionProps) {
  const { startDateTime, value, exceptions, onChange, onClearExceptions, showSummary = false, endsControlled = false } = props;

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
  // const [showDatePicker, setShowDatePicker] = useState(false);

  // Sync internal options when external RRULE value changes
  useEffect(() => {
    if (!value) return;
    const parsed = parseRRule(value);
    if (parsed) {
      setOpts(parsed);
    }
  }, [value]);

  useEffect(() => {
    // Recompute summary when options or start time change
    if (!value) {
      setSummary('Does not repeat');
      return;
    }
    setSummary(toHumanText(value, startDateTime || new Date()));
  }, [startDateTime, value]);


  const handleIntervalChange = (n: number) => {
    const next = { ...opts, interval: Math.max(1, Math.floor(n || 1)) };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  // const toggleDay = (day: number) => {
  //   const set = new Set(opts.daysOfWeek || []);
  //   if (set.has(day)) set.delete(day); else set.add(day);
  //   const next = { ...opts, daysOfWeek: Array.from(set).sort((a, b) => a - b) };
  //   setOpts(next);
  //   onChange(generateRRule(next, startDateTime || new Date()));
  // };

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

  // const handleEndsChange = (ends: 'never' | 'on' | 'after') => {
  //   const next = { ...opts, ends, count: ends === 'after' ? (opts.count || 10) : null, until: ends === 'on' ? (opts.until || addDays(new Date(), 30)) : null };
  //   setOpts(next);
  //   onChange(generateRRule(next, startDateTime || new Date()));
  // };

  // const handleUntilChange = (d?: Date) => {
  //   if (!d) return;
  //   const next = { ...opts, until: d };
  //   setOpts(next);
  //   onChange(generateRRule(next, startDateTime || new Date()));
  //   setShowDatePicker(false);
  // };

  const handleCountChange = (c: number) => {
    const next = { ...opts, count: Math.max(1, Math.floor(c || 1)) };
    setOpts(next);
    onChange(generateRRule(next, startDateTime || new Date()));
  };

  const currentFreq: 'none' | RecurrenceEditorOptions['frequency'] = value ? (opts.frequency) : 'none';

  const unitLabel = useMemo(() => {
    const base = (() => {
      switch (opts.frequency) {
        case 'daily':
          return 'day';
        case 'weekly':
          return 'week';
        case 'monthly':
          return 'month';
        case 'yearly':
          return 'year';
        default:
          return 'time';
      }
    })();
    return (opts.interval ?? 1) === 1 ? base : `${base}s`;
  }, [opts.frequency, opts.interval]);

  const weekdayLong = (d: number) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];

  const nthLabel = (date: Date) => {
    const day = date.getDate();
    const weekIndex = Math.ceil(day / 7); // 1..5 (5 ~ last)
    if (weekIndex >= 5) return 'last';
    return ['first','second','third','fourth'][weekIndex - 1] || 'first';
  };

  return (
    <div className="space-y-3">
      {exceptions.length > 0 && (
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={onClearExceptions} className="text-xs">Clear exceptions ({exceptions.length})</Button>
        </div>
      )}

      {/* Consolidated advanced options in a single row */}
      {currentFreq !== 'none' && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Interval */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm">Every</span>
            <Input type="number" min={1} className="w-16" value={opts.interval} onChange={(e) => handleIntervalChange(parseInt(e.target.value || '1', 10))} />
            <span className="text-sm">{unitLabel}{(currentFreq === 'weekly' || currentFreq === 'monthly' || currentFreq === 'yearly') ? ' on' : ''}</span>
          </div>

          {/* Weekly days */}
          {currentFreq === 'weekly' && (
            <>
            <ToggleGroup type="multiple" value={(opts.daysOfWeek || []).map(String)} onValueChange={(values) => {
              const nextDays = values.map((v) => parseInt(v, 10)).sort((a, b) => a - b);
              const next = { ...opts, daysOfWeek: nextDays };
              setOpts(next);
              onChange(generateRRule(next, startDateTime || new Date()));
            }} aria-label="Select days of week" className="ml-1">
              {weekdayLabels.map((label, idx) => (
                <ToggleGroupItem key={label} value={String(idx)} size="sm" className="w-9">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            </>
          )}

          {/* Monthly mode */}
          {currentFreq === 'monthly' && (
            <RadioGroup className="flex items-center gap-4 flex-wrap ml-1">
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem
                  value="day"
                  checked={Boolean(opts.dayOfMonth)}
                  onClick={() => handleMonthModeChange('dayOfMonth')}
                />
                <span className="text-sm">day {opts.dayOfMonth || (startDateTime ? new Date(startDateTime).getDate() : new Date().getDate())}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem
                  value="nth"
                  checked={Boolean(opts.monthlyBySetPos && typeof opts.monthlyWeekday === 'number')}
                  onClick={() => handleMonthModeChange('nthWeekday')}
                />
                <span className="text-sm">the {nthLabel(startDateTime || new Date())} {weekdayLong((startDateTime || new Date()).getDay())}</span>
              </label>
            </RadioGroup>
          )}

          {/* Yearly controls */}
          {currentFreq === 'yearly' && (
            <div className="flex items-center gap-2 flex-wrap ml-1">
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

          {/* When ends is managed by parent but is 'after', expose N occurrences inline */}
          {endsControlled && opts.ends === 'after' && (
            <div className="flex items-center gap-2 ml-1">
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

