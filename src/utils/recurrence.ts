import { RRule, RRuleSet, rrulestr } from 'rrule';

import type { CalendarEvent } from '@shared/types';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceEditorOptions {
  frequency: Frequency;
  interval: number;
  // Weekly
  daysOfWeek?: number[]; // 0=Sun .. 6=Sat
  // Monthly options
  dayOfMonth?: number; // 1..31
  // Nth weekday: e.g., 1st Monday => setpos:1, weekday:1
  monthlyBySetPos?: number; // -1..4 (last=-1)
  monthlyWeekday?: number; // 0..6
  // Yearly
  month?: number; // 1..12
  yearDayOfMonth?: number; // 1..31
  yearNthWeekday?: { setpos: number; weekday: number; month: number } | null;
  // End conditions
  ends?: 'never' | 'on' | 'after';
  until?: Date | null; // used when ends='on'
  count?: number | null; // used when ends='after'
}

export type ParsedRecurrence = RecurrenceEditorOptions

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export function generateRRule(options: RecurrenceEditorOptions, dtstart: Date): string {
  // Keep dtstart for potential future use; currently not embedded in string
  void dtstart;
  const parts: string[] = [];
  // FREQ
  const freqMap: Record<Frequency, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };
  parts.push(`FREQ=${freqMap[options.frequency]}`);

  // INTERVAL
  const interval = Math.max(1, Math.floor(options.interval || 1));
  parts.push(`INTERVAL=${interval}`);

  if (options.frequency === 'weekly' && options.daysOfWeek && options.daysOfWeek.length > 0) {
    const byday = options.daysOfWeek
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_CODES[(d + 7) % 7])
      .join(',');
    parts.push(`BYDAY=${byday}`);
  }

  if (options.frequency === 'monthly') {
    if (options.dayOfMonth) {
      parts.push(`BYMONTHDAY=${options.dayOfMonth}`);
    } else if (
      typeof options.monthlyBySetPos === 'number' &&
      typeof options.monthlyWeekday === 'number'
    ) {
      const wcode = WEEKDAY_CODES[(options.monthlyWeekday + 7) % 7];
      parts.push(`BYDAY=${wcode}`);
      parts.push(`BYSETPOS=${options.monthlyBySetPos}`);
    }
  }

  if (options.frequency === 'yearly') {
    if (options.month && options.yearDayOfMonth) {
      parts.push(`BYMONTH=${options.month}`);
      parts.push(`BYMONTHDAY=${options.yearDayOfMonth}`);
    } else if (options.yearNthWeekday) {
      const wcode = WEEKDAY_CODES[(options.yearNthWeekday.weekday + 7) % 7];
      parts.push(`BYMONTH=${options.yearNthWeekday.month}`);
      parts.push(`BYDAY=${wcode}`);
      parts.push(`BYSETPOS=${options.yearNthWeekday.setpos}`);
    }
  }

  // End conditions
  if (options.ends === 'after' && options.count && options.count > 0) {
    parts.push(`COUNT=${Math.floor(options.count)}`);
  } else if (options.ends === 'on' && options.until) {
    // UNTIL formatted as UTC in basic format YYYYMMDDT000000Z
    const until = new Date(options.until);
    // Normalize to 23:59:59.999 for all-day style ends for better UX
    until.setHours(23, 59, 59, 999);
    const yyyy = until.getUTCFullYear();
    const mm = String(until.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(until.getUTCDate()).padStart(2, '0');
    const HH = String(until.getUTCHours()).padStart(2, '0');
    const MM = String(until.getUTCMinutes()).padStart(2, '0');
    const SS = String(until.getUTCSeconds()).padStart(2, '0');
    parts.push(`UNTIL=${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`);
  }

  // Always include DTSTART for deterministic expansion
  // rrule library typically uses DTSTART from constructor; for string, we pass separately on parse.
  return `RRULE:${parts.join(';')}`;
}

export function parseRRule(rruleString: string): ParsedRecurrence | null {
  if (!rruleString || !rruleString.startsWith('RRULE:')) return null;
  const body = rruleString.substring('RRULE:'.length);
  const map: Record<string, string> = {};
  for (const part of body.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) map[k] = v;
  }
  const freqReverse: Record<string, Frequency> = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  };
  const freq = freqReverse[map['FREQ']] || 'weekly';
  const interval = Math.max(1, parseInt(map['INTERVAL'] || '1', 10));

  const opts: ParsedRecurrence = {
    frequency: freq,
    interval,
    ends: undefined,
    until: null,
    count: null,
  };

  if (map['BYDAY']) {
    const bydays = map['BYDAY'].split(',');
    opts.daysOfWeek = bydays.map((code) => WEEKDAY_CODES.indexOf(code as typeof WEEKDAY_CODES[number]));
  }
  if (map['BYMONTHDAY']) {
    const md = parseInt(map['BYMONTHDAY'], 10);
    if (!Number.isNaN(md)) opts.dayOfMonth = md;
  }
  if (map['BYSETPOS']) {
    const sp = parseInt(map['BYSETPOS'], 10);
    if (!Number.isNaN(sp)) opts.monthlyBySetPos = sp;
  }
  if (map['BYDAY'] && map['BYSETPOS'] && opts.frequency === 'monthly') {
    // monthly nth weekday case
    const w = map['BYDAY'].split(',')[0];
    opts.monthlyWeekday = WEEKDAY_CODES.indexOf(w as typeof WEEKDAY_CODES[number]);
  }

  if (map['BYMONTH'] && opts.frequency === 'yearly') {
    const m = parseInt(map['BYMONTH'], 10);
    if (!Number.isNaN(m)) opts.month = m;
  }
  if (map['BYMONTHDAY'] && opts.frequency === 'yearly') {
    const ymd = parseInt(map['BYMONTHDAY'], 10);
    if (!Number.isNaN(ymd)) opts.yearDayOfMonth = ymd;
  }
  if (map['COUNT']) {
    opts.ends = 'after';
    const c = parseInt(map['COUNT'], 10);
    if (!Number.isNaN(c)) opts.count = c;
  } else if (map['UNTIL']) {
    opts.ends = 'on';
    // Parse UNTIL in basic UTC format
    const m = map['UNTIL'];
    const yyyy = parseInt(m.slice(0, 4), 10);
    const MM = parseInt(m.slice(4, 6), 10) - 1;
    const dd = parseInt(m.slice(6, 8), 10);
    const HH = parseInt(m.slice(9, 11) || '0', 10);
    const mm = parseInt(m.slice(11, 13) || '0', 10);
    const ss = parseInt(m.slice(13, 15) || '0', 10);
    opts.until = new Date(Date.UTC(yyyy, MM, dd, HH, mm, ss));
  } else {
    opts.ends = 'never';
  }

  return opts;
}

export function toHumanText(rruleString: string, dtstart: Date): string {
  try {
    const rule = rrulestr(rruleString, { dtstart });
    return (rule as RRule).toText();
  } catch {
    return 'Repeats';
  }
}

export interface ExpandedOccurrence {
  start: Date;
  end: Date;
}

type ExpansionCacheKey = string;

const expansionCache = new Map<ExpansionCacheKey, ExpandedOccurrence[]>();

function buildCacheKey(
  seriesId: string,
  rangeStart: Date,
  rangeEnd: Date,
  rrule: string,
  durationMs: number,
  exceptions: readonly string[]
): string {
  return [
    seriesId,
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
    rrule,
    durationMs,
    exceptions.slice().sort().join('|'),
  ].join('::');
}

export function expandOccurrences(
  event: Pick<CalendarEvent, 'id' | 'start' | 'end' | 'recurrence' | 'exceptions' | 'allDay'>,
  rangeStart: Date,
  rangeEnd: Date
): ExpandedOccurrence[] {
  if (!event.recurrence) return [];
  const durationMs = Math.max(0, new Date(event.end).getTime() - new Date(event.start).getTime());
  const exceptions = event.exceptions ?? [];
  const cacheKey = buildCacheKey(
    event.id,
    rangeStart,
    rangeEnd,
    event.recurrence,
    durationMs,
    exceptions
  );
  const cached = expansionCache.get(cacheKey);
  if (cached) return cached;

  let rule: RRule | RRuleSet;
  try {
    rule = rrulestr(event.recurrence, { dtstart: new Date(event.start) });
  } catch {
    return [];
  }

  const occStarts = (rule as RRule).between(new Date(rangeStart), new Date(rangeEnd), true);
  const exceptionSet = new Set(exceptions);
  const occurrences: ExpandedOccurrence[] = [];
  for (const start of occStarts) {
    // Compare against exceptions using ISO strings of start
    const iso = start.toISOString();
    if (exceptionSet.has(iso)) continue;
    const end = new Date(start.getTime() + durationMs);
    occurrences.push({ start, end });
  }
  expansionCache.set(cacheKey, occurrences);
  return occurrences;
}

function formatUntilUTC(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const HH = String(date.getUTCHours()).padStart(2, '0');
  const MM = String(date.getUTCMinutes()).padStart(2, '0');
  const SS = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`;
}

/**
 * Clamp an RRULE to end at or before the provided date (exclusive of occurrence at that moment).
 * Replaces COUNT and sets UNTIL. Returns a new RRULE string.
 */
export function clampRRuleUntil(rruleString: string, untilDate: Date): string {
  if (!rruleString.startsWith('RRULE:')) return rruleString;
  const body = rruleString.substring(6);
  const map: Record<string, string> = {};
  const order: string[] = [];
  for (const part of body.split(';')) {
    const [k, v] = part.split('=');
    if (!k) continue;
    if (!(k in map)) order.push(k);
    map[k] = v || '';
  }
  // Remove COUNT to avoid conflicting with UNTIL
  delete map['COUNT'];
  // Set UNTIL to one second before the given date (since UNTIL is inclusive)
  const untilMinus = new Date(untilDate.getTime() - 1000);
  map['UNTIL'] = formatUntilUTC(untilMinus);
  // Rebuild preserving original key order when possible, add UNTIL last if not present earlier
  const keys = order.filter((k) => k !== 'COUNT' && k !== 'UNTIL');
  keys.push('UNTIL');
  const parts: string[] = [];
  for (const k of keys) {
    if (map[k] !== undefined) parts.push(`${k}=${map[k]}`);
  }
  return `RRULE:${parts.join(';')}`;
}

