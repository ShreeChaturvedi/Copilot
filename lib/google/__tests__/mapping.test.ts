/**
 * Table-driven unit tests for Google<->app event mapping (plan §9):
 * RRULE round-trips, EXDATE<->exceptions, all-day ±1-day end conversion,
 * dateTime<->UTC with timeZone, modified/cancelled instance folding helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  appEventToGoogle,
  buildGoogleRecurrence,
  googleEventToApp,
  isoToUtcBasic,
  originalStartToIso,
  parseExdateLine,
  parseGoogleRecurrence,
  rfc5545ValueToIso,
  wallTimeToUtc,
  MappingError,
  type AppEventFields,
} from '../mapping.js';
import type { GCalEvent } from '../types.js';

const baseApp: AppEventFields = {
  title: 'Standup',
  description: null,
  location: null,
  start: new Date('2026-07-06T14:00:00.000Z'),
  end: new Date('2026-07-06T14:30:00.000Z'),
  allDay: false,
  recurrence: null,
  exceptions: [],
};

const baseGoogle: GCalEvent = {
  id: 'gev-1',
  etag: '"100"',
  status: 'confirmed',
  summary: 'Standup',
  start: { dateTime: '2026-07-06T10:00:00-04:00', timeZone: 'America/New_York' },
  end: { dateTime: '2026-07-06T10:30:00-04:00', timeZone: 'America/New_York' },
  updated: '2026-07-01T00:00:00.000Z',
};

describe('timezone helpers', () => {
  it.each([
    // [wall time, zone, expected UTC instant]
    ['2026-07-06 10:00 EDT', 'America/New_York', '2026-07-06T14:00:00.000Z'],
    ['2026-01-06 10:00 EST', 'America/New_York', '2026-01-06T15:00:00.000Z'],
    ['2026-07-06 10:00 UTC', 'UTC', '2026-07-06T10:00:00.000Z'],
    ['2026-07-06 10:00 IST', 'Asia/Kolkata', '2026-07-06T04:30:00.000Z'],
  ])('wallTimeToUtc %s (%s)', (_label, zone, expected) => {
    const [datePart] = expected.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    expect(
      wallTimeToUtc(
        { year: y, month: m, day: d, hour: 10, minute: 0, second: 0 },
        zone
      ).toISOString()
    ).toBe(expected);
  });

  it.each([
    ['20260706T140000Z', undefined, '2026-07-06T14:00:00.000Z'],
    ['20260706T100000', 'America/New_York', '2026-07-06T14:00:00.000Z'],
    ['20260706T100000', undefined, '2026-07-06T10:00:00.000Z'], // floating -> UTC
    ['20260706', undefined, '2026-07-06T00:00:00.000Z'], // DATE
  ])('rfc5545ValueToIso(%s, %s)', (value, tzid, expected) => {
    expect(rfc5545ValueToIso(value, tzid)).toBe(expected);
  });

  it('isoToUtcBasic strips millis and separators', () => {
    expect(isoToUtcBasic('2026-07-06T14:00:00.000Z')).toBe('20260706T140000Z');
  });
});

describe('parseGoogleRecurrence (inbound)', () => {
  it.each([
    [
      'plain weekly RRULE',
      ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'],
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
      [],
    ],
    [
      'RRULE + UTC EXDATE (two values, one line)',
      [
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE:20260713T140000Z,20260720T140000Z',
      ],
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      ['2026-07-13T14:00:00.000Z', '2026-07-20T14:00:00.000Z'],
    ],
    [
      'RRULE + TZID EXDATE (converted to UTC instants)',
      [
        'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10',
        'EXDATE;TZID=America/New_York:20260713T100000',
      ],
      'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10',
      ['2026-07-13T14:00:00.000Z'],
    ],
    [
      'RRULE + VALUE=DATE EXDATE (all-day)',
      ['RRULE:FREQ=DAILY;COUNT=5', 'EXDATE;VALUE=DATE:20260708'],
      'RRULE:FREQ=DAILY;COUNT=5',
      ['2026-07-08T00:00:00.000Z'],
    ],
    [
      'monthly BYSETPOS survives verbatim',
      ['RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1'],
      'RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1',
      [],
    ],
    ['no recurrence', undefined, null, []],
  ])('%s', (_label, lines, recurrence, exceptions) => {
    const parsed = parseGoogleRecurrence(lines as string[] | undefined);
    expect(parsed.recurrence).toBe(recurrence);
    expect(parsed.exceptions).toEqual(exceptions);
  });

  it('multiple EXDATE lines merge and dedupe', () => {
    const parsed = parseGoogleRecurrence([
      'RRULE:FREQ=DAILY',
      'EXDATE:20260713T140000Z',
      'EXDATE:20260713T140000Z,20260714T140000Z',
    ]);
    expect(parsed.exceptions).toEqual([
      '2026-07-13T14:00:00.000Z',
      '2026-07-14T14:00:00.000Z',
    ]);
  });

  it('RDATE/EXRULE sets are stored verbatim (read-only sync)', () => {
    const lines = [
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'RDATE:20260801T140000Z',
      'EXDATE:20260713T140000Z',
    ];
    const parsed = parseGoogleRecurrence(lines);
    expect(parsed.recurrence).toBe(lines.join('\n'));
    expect(parsed.exceptions).toEqual([]);
  });

  it('rejects malformed EXDATE lines', () => {
    expect(() => parseExdateLine('EXDATE;VALUE=DATE')).toThrow(MappingError);
    expect(() => parseExdateLine('EXDATE:garbage')).toThrow(MappingError);
  });
});

describe('buildGoogleRecurrence (outbound)', () => {
  it.each([
    [
      'RRULE only',
      'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE',
      [],
      false,
      ['RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE'],
    ],
    [
      'RRULE + timed exceptions -> single UTC EXDATE line',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      ['2026-07-20T14:00:00.000Z', '2026-07-13T14:00:00.000Z'],
      false,
      [
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE:20260713T140000Z,20260720T140000Z',
      ],
    ],
    [
      'RRULE + all-day exceptions -> VALUE=DATE EXDATE',
      'RRULE:FREQ=DAILY;COUNT=5',
      ['2026-07-08T00:00:00.000Z'],
      true,
      ['RRULE:FREQ=DAILY;COUNT=5', 'EXDATE;VALUE=DATE:20260708'],
    ],
    ['no recurrence -> undefined', null, [], false, undefined],
  ])('%s', (_label, recurrence, exceptions, allDay, expected) => {
    expect(buildGoogleRecurrence(recurrence, exceptions, allDay)).toEqual(
      expected
    );
  });

  it('complex multi-line sets round-trip verbatim', () => {
    const stored = 'RRULE:FREQ=WEEKLY;BYDAY=MO\nRDATE:20260801T140000Z';
    expect(buildGoogleRecurrence(stored, [], false)).toEqual([
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'RDATE:20260801T140000Z',
    ]);
  });

  it('inbound -> outbound round-trips RRULE + EXDATE', () => {
    const lines = [
      'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261228T235959Z',
      'EXDATE:20260713T140000Z,20260720T140000Z',
    ];
    const parsed = parseGoogleRecurrence(lines);
    expect(
      buildGoogleRecurrence(parsed.recurrence, parsed.exceptions, false)
    ).toEqual(lines);
  });
});

describe('googleEventToApp', () => {
  it('maps a timed event to UTC instants', () => {
    const app = googleEventToApp(baseGoogle);
    expect(app.title).toBe('Standup');
    expect(app.allDay).toBe(false);
    expect(app.start.toISOString()).toBe('2026-07-06T14:00:00.000Z');
    expect(app.end.toISOString()).toBe('2026-07-06T14:30:00.000Z');
  });

  it('maps an all-day event with exclusive->inclusive end', () => {
    const app = googleEventToApp({
      ...baseGoogle,
      start: { date: '2026-07-06' },
      end: { date: '2026-07-08' }, // exclusive: covers Jul 6 + Jul 7
    });
    expect(app.allDay).toBe(true);
    expect(app.start.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(app.end.toISOString()).toBe('2026-07-07T23:59:59.999Z');
  });

  it('maps a single-day all-day event', () => {
    const app = googleEventToApp({
      ...baseGoogle,
      start: { date: '2026-07-06' },
      end: { date: '2026-07-07' },
    });
    expect(app.start.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(app.end.toISOString()).toBe('2026-07-06T23:59:59.999Z');
  });

  it('defaults a missing summary and passes through desc/location', () => {
    const app = googleEventToApp({
      ...baseGoogle,
      summary: undefined,
      description: 'notes here',
      location: 'Room 4',
    });
    expect(app.title).toBe('(No title)');
    expect(app.description).toBe('notes here');
    expect(app.location).toBe('Room 4');
  });

  it('throws on cancelled shells with no start/end', () => {
    expect(() =>
      googleEventToApp({ id: 'x', etag: '"1"', status: 'cancelled' })
    ).toThrow(MappingError);
  });
});

describe('appEventToGoogle', () => {
  it('emits dateTime + timeZone for timed events', () => {
    const g = appEventToGoogle(baseApp, 'America/New_York');
    expect(g.start).toEqual({
      dateTime: '2026-07-06T14:00:00.000Z',
      timeZone: 'America/New_York',
    });
    expect(g.status).toBe('confirmed');
  });

  it('emits exclusive end.date (+1 day) for all-day events', () => {
    const g = appEventToGoogle(
      {
        ...baseApp,
        allDay: true,
        start: new Date('2026-07-06T00:00:00.000Z'),
        end: new Date('2026-07-07T23:59:59.999Z'),
      },
      'UTC'
    );
    expect(g.start).toEqual({ date: '2026-07-06' });
    expect(g.end).toEqual({ date: '2026-07-08' });
  });

  it('all-day round-trip is stable (google -> app -> google)', () => {
    const gEvent: GCalEvent = {
      ...baseGoogle,
      start: { date: '2026-07-06' },
      end: { date: '2026-07-09' },
    };
    const app = googleEventToApp(gEvent);
    const back = appEventToGoogle(app, 'UTC');
    expect(back.start).toEqual({ date: '2026-07-06' });
    expect(back.end).toEqual({ date: '2026-07-09' });
  });

  it('timed round-trip preserves the UTC instant', () => {
    const app = googleEventToApp(baseGoogle);
    const back = appEventToGoogle(app, 'America/New_York');
    expect(new Date(back.start!.dateTime!).getTime()).toBe(
      Date.parse(baseGoogle.start!.dateTime!)
    );
  });

  it('recurring round-trip with exceptions', () => {
    const gEvent: GCalEvent = {
      ...baseGoogle,
      recurrence: [
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE;TZID=America/New_York:20260713T100000',
      ],
    };
    const app = googleEventToApp(gEvent);
    expect(app.recurrence).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(app.exceptions).toEqual(['2026-07-13T14:00:00.000Z']);
    const back = appEventToGoogle(app, 'America/New_York');
    expect(back.recurrence).toEqual([
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE:20260713T140000Z',
    ]);
  });
});

describe('originalStartToIso (instance folding)', () => {
  it('converts dateTime originalStartTime to the app exceptions format', () => {
    expect(
      originalStartToIso({ dateTime: '2026-07-13T10:00:00-04:00' })
    ).toBe('2026-07-13T14:00:00.000Z');
  });

  it('converts all-day originalStartTime', () => {
    expect(originalStartToIso({ date: '2026-07-13' })).toBe(
      '2026-07-13T00:00:00.000Z'
    );
  });

  it('throws when neither field is set', () => {
    expect(() => originalStartToIso({})).toThrow(MappingError);
  });
});
