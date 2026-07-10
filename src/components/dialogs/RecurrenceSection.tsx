import { useCallback, useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  generateRRule,
  parseRRule,
  toHumanText,
  type RecurrenceEditorOptions,
} from '@/utils/recurrence';

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

// Max day-of-month for a 1-based month. February allows 29 so leap-day yearly
// series stay possible; the RRULE engine skips non-leap years for Feb 29.
const MONTH_MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function daysInMonth(month1Based: number): number {
  return MONTH_MAX_DAYS[Math.min(12, Math.max(1, month1Based)) - 1];
}

export default function RecurrenceSection(props: RecurrenceSectionProps) {
  const {
    startDateTime,
    value,
    exceptions,
    onChange,
    onClearExceptions,
    showSummary = false,
    endsControlled = false,
  } = props;

  const initialOpts: RecurrenceEditorOptions = useMemo(() => {
    const parsed = value ? parseRRule(value) : null;
    if (parsed) return parsed;
    return {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: startDateTime
        ? [new Date(startDateTime).getDay()]
        : [new Date().getDay()],
      ends: 'never',
      until: null,
      count: null,
    };
  }, [value, startDateTime]);

  const [opts, setOpts] = useState<RecurrenceEditorOptions>(initialOpts);
  const [summary, setSummary] = useState<string>('Does not repeat');

  // Single commit path: update local view state then serialize + notify the
  // parent. Keeps every handler on one source of truth for how options map to
  // an RRULE string.
  const commit = useCallback(
    (next: RecurrenceEditorOptions) => {
      setOpts(next);
      onChange(generateRRule(next, startDateTime ?? new Date()));
    },
    [onChange, startDateTime]
  );

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
    commit({ ...opts, interval: Math.max(1, Math.floor(n || 1)) });
  };

  const handleMonthModeChange = (mode: 'dayOfMonth' | 'nthWeekday') => {
    const dt = startDateTime ? new Date(startDateTime) : new Date();
    if (mode === 'dayOfMonth') {
      commit({
        ...opts,
        dayOfMonth: dt.getDate(),
        monthlyBySetPos: undefined,
        monthlyWeekday: undefined,
      });
    } else {
      const weekday = dt.getDay();
      const weekIndex = Math.ceil(dt.getDate() / 7); // 1..5 approx, 5 means last
      const setpos = weekIndex >= 5 ? -1 : weekIndex;
      commit({
        ...opts,
        dayOfMonth: undefined,
        monthlyBySetPos: setpos,
        monthlyWeekday: weekday,
      });
    }
  };

  const handleCountChange = (c: number) => {
    commit({ ...opts, count: Math.max(1, Math.floor(c || 1)) });
  };

  const currentFreq: 'none' | RecurrenceEditorOptions['frequency'] = value
    ? opts.frequency
    : 'none';

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

  const weekdayLong = (d: number) =>
    [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][d];

  const nthLabel = (date: Date) => {
    const day = date.getDate();
    const weekIndex = Math.ceil(day / 7); // 1..5 (5 ~ last)
    if (weekIndex >= 5) return 'last';
    return ['first', 'second', 'third', 'fourth'][weekIndex - 1] || 'first';
  };

  return (
    <div className="space-y-3">
      {exceptions.length > 0 && (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearExceptions}
            className="text-xs"
          >
            Clear exceptions ({exceptions.length})
          </Button>
        </div>
      )}

      {/* Advanced options: each decision ("how often," "on which day(s),"
          "how many times") gets its own row instead of competing for one
          flex-wrap line. */}
      {currentFreq !== 'none' && (
        <div className="space-y-3">
          {/* Row 1: interval */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm">Every</span>
            <Input
              type="number"
              min={1}
              className="w-16"
              value={opts.interval}
              onChange={(e) =>
                handleIntervalChange(parseInt(e.target.value || '1', 10))
              }
            />
            <span className="text-sm">
              {unitLabel}
              {currentFreq === 'weekly' ||
              currentFreq === 'monthly' ||
              currentFreq === 'yearly'
                ? ' on'
                : ''}
            </span>
          </div>

          {/* Row 2: the frequency-dependent control (weekday / monthly / yearly) */}
          {currentFreq === 'weekly' && (
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                type="multiple"
                value={(opts.daysOfWeek || []).map(String)}
                onValueChange={(values) => {
                  const nextDays = values
                    .map((v) => parseInt(v, 10))
                    .sort((a, b) => a - b);
                  commit({ ...opts, daysOfWeek: nextDays });
                }}
                aria-label="Select days of week"
              >
                {weekdayLabels.map((label, idx) => (
                  <ToggleGroupItem
                    key={label}
                    value={String(idx)}
                    size="sm"
                    className="w-9"
                  >
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {currentFreq === 'monthly' && (
            <div className="flex items-center gap-2 flex-wrap">
              <RadioGroup className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-2">
                  <RadioGroupItem
                    value="day"
                    checked={Boolean(opts.dayOfMonth)}
                    onClick={() => handleMonthModeChange('dayOfMonth')}
                  />
                  <span className="text-sm">
                    day{' '}
                    {opts.dayOfMonth ||
                      (startDateTime
                        ? new Date(startDateTime).getDate()
                        : new Date().getDate())}
                  </span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <RadioGroupItem
                    value="nth"
                    checked={Boolean(
                      opts.monthlyBySetPos &&
                        typeof opts.monthlyWeekday === 'number'
                    )}
                    onClick={() => handleMonthModeChange('nthWeekday')}
                  />
                  <span className="text-sm">
                    the {nthLabel(startDateTime || new Date())}{' '}
                    {weekdayLong((startDateTime || new Date()).getDay())}
                  </span>
                </label>
              </RadioGroup>
            </div>
          )}

          {currentFreq === 'yearly' &&
            (() => {
              const selectedMonth =
                opts.month ||
                (startDateTime
                  ? new Date(startDateTime).getMonth() + 1
                  : new Date().getMonth() + 1);
              // Clamp the day to the selected month's length so impossible dates
              // (e.g. Feb 31) can't be entered and silently never recur. Feb is
              // allowed 29 so leap-day series remain possible.
              const daysInSelectedMonth = daysInMonth(selectedMonth);
              const selectedDay =
                opts.yearDayOfMonth ||
                (startDateTime
                  ? new Date(startDateTime).getDate()
                  : new Date().getDate());
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="w-16"
                    value={selectedMonth}
                    onChange={(e) => {
                      const v = Math.min(
                        12,
                        Math.max(1, parseInt(e.target.value || '1', 10))
                      );
                      // Re-clamp the day when the month shrinks under it.
                      const clampedDay = Math.min(selectedDay, daysInMonth(v));
                      commit({ ...opts, month: v, yearDayOfMonth: clampedDay });
                    }}
                  />
                  <span className="text-sm">/</span>
                  <Input
                    type="number"
                    min={1}
                    max={daysInSelectedMonth}
                    className="w-16"
                    value={selectedDay}
                    onChange={(e) => {
                      const v = Math.min(
                        daysInSelectedMonth,
                        Math.max(1, parseInt(e.target.value || '1', 10))
                      );
                      commit({ ...opts, yearDayOfMonth: v });
                    }}
                  />
                </div>
              );
            })()}

          {/* Row 3: when ends is managed by parent but is 'after', expose N occurrences */}
          {endsControlled && opts.ends === 'after' && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={opts.count || 10}
                onChange={(e) =>
                  handleCountChange(parseInt(e.target.value || '1', 10))
                }
              />
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
