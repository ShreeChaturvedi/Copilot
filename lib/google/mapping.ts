/**
 * Pure mapping functions between Google Calendar events and app events
 * (plan §2/§3). No I/O; unit-test heavy.
 *
 * Field map: title<->summary, description<->description, location<->location.
 * App `notes` and `color` stay app-only. `status` outbound is always
 * 'confirmed'; inbound 'cancelled' is handled by the sync engine as a delete.
 *
 * Times: the app stores UTC instants (timestamp-without-tz parsed as UTC).
 *  - Timed: start.dateTime (RFC3339) <-> UTC Date. Outbound carries the
 *    user's IANA timeZone (required by Google for recurring events).
 *  - All-day: Google end.date is EXCLUSIVE; the app stores an INCLUSIVE end
 *    at 23:59:59.999 UTC of the last day. Outbound +1 day, inbound -1 day.
 *
 * Recurrence: the app keeps one master row with a single `RRULE:` string in
 * `recurrence` and excluded occurrence starts (UTC ISO strings, exactly
 * `Date.toISOString()` format) in `exceptions[]`.
 *  - Inbound RRULE-only (+EXDATE) recurrences fold EXDATE lines into
 *    `exceptions[]`. RDATE/EXRULE (rare) keep the full multi-line string in
 *    `recurrence` untouched (read-only sync per plan) with no folding.
 *  - Outbound emits ["RRULE:...", "EXDATE:..."]; DTSTART/DTEND lines are not
 *    allowed in Google's recurrence[] (start/end fields carry them).
 *
 * Known divergence (documented, not solved in M1): Google expands recurrences
 * in the event's wall-clock timeZone (DST-aware); the app expands from fixed
 * UTC instants, so a weekly event crosses DST offset by one hour between the
 * two views.
 */
import type { GCalEvent, GCalEventDateTime, GCalEventInput } from './types.js';

export interface AppEventFields {
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  recurrence: string | null;
  exceptions: string[];
}

export class MappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MappingError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_MS_OF_DAY = DAY_MS - 1;

// --- timezone helpers --------------------------------------------------------

/**
 * Convert a wall-clock time in an IANA zone to the UTC instant it denotes.
 * Two-pass fixed-point using Intl (no tz database dependency).
 */
export function wallTimeToUtc(
  parts: {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string
): Date {
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let guess = asUtc;
  // Two iterations converge for all real offsets (incl. DST edges).
  for (let i = 0; i < 2; i++) {
    guess = asUtc - zoneOffsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
}

/** Offset (ms) of `timeZone` from UTC at `instant` (positive = ahead of UTC). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(instant)) {
    if (type !== 'literal') parts[type] = parseInt(value, 10);
  }
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second
  );
  return wallAsUtc - instant.getTime();
}

// --- RFC5545 date-time helpers ----------------------------------------------

/** `2026-07-01T14:00:00.000Z` -> `20260701T140000Z` (UTC basic). */
export function isoToUtcBasic(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new MappingError(`Invalid ISO timestamp: ${iso}`);
  }
  return d
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '');
}

/** `2026-07-01T00:00:00.000Z` -> `20260701` (RFC5545 DATE). */
export function isoToBasicDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new MappingError(`Invalid ISO timestamp: ${iso}`);
  }
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Parse one RFC5545 date-time value (`20260701T140000Z`, `20260701T140000`,
 * or `20260701`) to a UTC ISO string. Floating times resolve in `tzid` when
 * given, else UTC. DATE values resolve to 00:00:00 UTC (matching how the app
 * stores all-day starts and expands their occurrences).
 */
export function rfc5545ValueToIso(value: string, tzid?: string): string {
  const m = value
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) throw new MappingError(`Unparseable RFC5545 date value: ${value}`);
  const [, y, mo, d, h = '0', mi = '0', s = '0', zulu] = m;
  const parts = {
    year: parseInt(y, 10),
    month: parseInt(mo, 10),
    day: parseInt(d, 10),
    hour: parseInt(h, 10),
    minute: parseInt(mi, 10),
    second: parseInt(s, 10),
  };
  if (zulu || !tzid) {
    return new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      )
    ).toISOString();
  }
  return wallTimeToUtc(parts, tzid).toISOString();
}

// --- recurrence mapping --------------------------------------------------------

export interface ParsedGoogleRecurrence {
  /** Single `RRULE:` line, full multi-line string (RDATE/EXRULE), or null. */
  recurrence: string | null;
  /** Excluded occurrence starts as UTC ISO strings (app exceptions format). */
  exceptions: string[];
}

/**
 * Google `recurrence[]` lines -> app {recurrence, exceptions}.
 * RRULE (+EXDATE) folds EXDATEs into exceptions. Any RDATE/EXRULE keeps the
 * whole set verbatim (joined by \n) so server-side rrulestr expansion still
 * honors it; the UI treats it as a custom rule.
 */
export function parseGoogleRecurrence(
  lines: string[] | undefined
): ParsedGoogleRecurrence {
  if (!lines || lines.length === 0) {
    return { recurrence: null, exceptions: [] };
  }
  const hasComplex = lines.some((l) => /^(RDATE|EXRULE)[;:]/i.test(l.trim()));
  if (hasComplex) {
    return { recurrence: lines.join('\n'), exceptions: [] };
  }

  let rrule: string | null = null;
  const exceptions: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^RRULE:/i.test(line)) {
      // Keep the first RRULE (Google emits at most one).
      if (!rrule) rrule = `RRULE:${line.slice(line.indexOf(':') + 1)}`;
    } else if (/^EXDATE/i.test(line)) {
      exceptions.push(...parseExdateLine(line));
    }
    // Anything else (e.g. stray blank) is ignored.
  }
  const deduped = [...new Set(exceptions)].sort();
  return { recurrence: rrule, exceptions: deduped };
}

/** One `EXDATE[;TZID=..][;VALUE=..]:v[,v...]` line -> UTC ISO strings. */
export function parseExdateLine(line: string): string[] {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) throw new MappingError(`Malformed EXDATE line: ${line}`);
  const header = line.slice(0, colonIdx);
  const values = line.slice(colonIdx + 1).split(',');
  const tzidMatch = header.match(/;TZID=([^;:]+)/i);
  const tzid = tzidMatch?.[1];
  return values.filter((v) => v.trim()).map((v) => rfc5545ValueToIso(v, tzid));
}

/**
 * App {recurrence, exceptions, allDay} -> Google `recurrence[]`.
 * Multi-line recurrences (RDATE/EXRULE imports) pass through verbatim.
 */
export function buildGoogleRecurrence(
  recurrence: string | null,
  exceptions: string[],
  allDay: boolean
): string[] | undefined {
  if (!recurrence) return undefined;
  const lines = recurrence
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const isSimple = lines.length === 1 && /^RRULE:/i.test(lines[0]);
  if (!isSimple) return lines; // verbatim round-trip of complex sets

  const out = [lines[0]];
  if (exceptions.length > 0) {
    const sorted = [...new Set(exceptions)].sort();
    out.push(
      allDay
        ? `EXDATE;VALUE=DATE:${sorted.map(isoToBasicDate).join(',')}`
        : `EXDATE:${sorted.map(isoToUtcBasic).join(',')}`
    );
  }
  return out;
}

// --- event body mapping ----------------------------------------------------------

/** Google `originalStartTime` -> the app's exceptions[] entry for it. */
export function originalStartToIso(ost: GCalEventDateTime): string {
  if (ost.dateTime) return new Date(ost.dateTime).toISOString();
  if (ost.date) return rfc5545ValueToIso(ost.date.replace(/-/g, ''));
  throw new MappingError('originalStartTime has neither date nor dateTime');
}

/**
 * Active (non-cancelled) Google event -> app event fields.
 * Throws MappingError when start/end are missing (cancelled shells must be
 * routed to the delete path before mapping).
 */
export function googleEventToApp(g: GCalEvent): AppEventFields {
  if (!g.start || !g.end) {
    throw new MappingError(`Google event ${g.id} is missing start/end`);
  }
  const allDay = !!g.start.date;
  let start: Date;
  let end: Date;
  if (allDay) {
    if (!g.start.date || !g.end.date) {
      throw new MappingError(`Google all-day event ${g.id} missing dates`);
    }
    start = new Date(`${g.start.date}T00:00:00.000Z`);
    // Google end.date is exclusive; app stores inclusive 23:59:59.999.
    end = new Date(
      Date.parse(`${g.end.date}T00:00:00.000Z`) - DAY_MS + LAST_MS_OF_DAY
    );
  } else {
    if (!g.start.dateTime || !g.end.dateTime) {
      throw new MappingError(`Google timed event ${g.id} missing dateTimes`);
    }
    start = new Date(g.start.dateTime);
    end = new Date(g.end.dateTime);
  }

  const { recurrence, exceptions } = parseGoogleRecurrence(g.recurrence);

  return {
    title: g.summary?.trim() || '(No title)',
    description: g.description ?? null,
    location: g.location ?? null,
    start,
    end,
    allDay,
    recurrence,
    exceptions,
  };
}

/**
 * App event fields -> Google event body (outbound writes; used by M2 and by
 * tests/live seeding in M1). `timeZone` is the user's IANA zone.
 */
export function appEventToGoogle(
  e: AppEventFields,
  timeZone: string
): GCalEventInput {
  const body: GCalEventInput = {
    summary: e.title,
    description: e.description,
    location: e.location,
    status: 'confirmed',
  };
  if (e.allDay) {
    const startDate = e.start.toISOString().slice(0, 10);
    // App inclusive end (23:59:59.999 of last day) -> Google exclusive date:
    // take the end's UTC calendar day and add one day.
    const endDate = new Date(
      Date.parse(`${e.end.toISOString().slice(0, 10)}T00:00:00.000Z`) + DAY_MS
    )
      .toISOString()
      .slice(0, 10);
    body.start = { date: startDate };
    body.end = { date: endDate };
  } else {
    body.start = { dateTime: e.start.toISOString(), timeZone };
    body.end = { dateTime: e.end.toISOString(), timeZone };
  }
  // Always set recurrence explicitly (empty array = "no recurrence"). A PATCH
  // that OMITS the field leaves Google's stored RRULE untouched, so turning a
  // recurring event into a single one would never clear it on Google; an empty
  // array removes the RRULE/EXDATE. Inserts read [] as non-recurring too.
  body.recurrence =
    buildGoogleRecurrence(e.recurrence, e.exceptions, e.allDay) ?? [];
  return body;
}
