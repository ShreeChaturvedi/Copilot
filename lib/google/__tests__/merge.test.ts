/**
 * Table-driven truth-table tests for the per-field three-way merge (plan §5).
 */
import { describe, it, expect } from 'vitest';
import {
  appFieldsToSynced,
  normalizeSnapshot,
  syncedFieldsEqual,
  syncedToAppFields,
  threeWayMergeEvent,
  type SyncedFields,
} from '../merge.js';

const BASE: SyncedFields = {
  title: 'Standup',
  description: 'daily',
  location: 'Room 1',
  start: '2026-07-06T09:00:00.000Z',
  end: '2026-07-06T09:15:00.000Z',
  allDay: false,
  recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
  exceptions: ['2026-07-13T09:00:00.000Z'],
};

const APP_NEWER = new Date('2026-07-02T12:00:00Z');
const GOOGLE_NEWER = new Date('2026-07-02T13:00:00Z');

function clone(over: Partial<SyncedFields> = {}): SyncedFields {
  return { ...BASE, exceptions: [...BASE.exceptions], ...over };
}

describe('threeWayMergeEvent — scalar field truth table', () => {
  it('case 1: nobody changed -> no-op, no outbound', () => {
    const r = threeWayMergeEvent(
      BASE,
      clone(),
      clone(),
      APP_NEWER,
      GOOGLE_NEWER
    );
    expect(syncedFieldsEqual(r.merged, BASE)).toBe(true);
    expect(r.appWon).toEqual([]);
    expect(r.googleWon).toEqual([]);
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(false);
  });

  it('case 2: only Google changed -> take Google, no outbound', () => {
    const google = clone({ title: 'Standup v2' });
    const r = threeWayMergeEvent(
      BASE,
      clone(),
      google,
      APP_NEWER,
      GOOGLE_NEWER
    );
    expect(r.merged.title).toBe('Standup v2');
    expect(r.googleWon).toEqual(['title']);
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(false);
  });

  it('case 3: only the app changed -> keep app, outbound patch required', () => {
    const app = clone({ location: 'Room 9' });
    const r = threeWayMergeEvent(BASE, app, clone(), GOOGLE_NEWER, APP_NEWER);
    expect(r.merged.location).toBe('Room 9');
    expect(r.appWon).toEqual(['location']);
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(true);
  });

  it('case 4: both changed differently -> LWW, app newer keeps app + outbound', () => {
    const app = clone({ title: 'App title' });
    const google = clone({ title: 'Google title' });
    const r = threeWayMergeEvent(BASE, app, google, GOOGLE_NEWER, APP_NEWER);
    expect(r.merged.title).toBe('App title');
    expect(r.conflicts).toEqual(['title']);
    expect(r.needsOutbound).toBe(true);
  });

  it('case 4: both changed differently -> LWW, Google newer takes Google', () => {
    const app = clone({ title: 'App title' });
    const google = clone({ title: 'Google title' });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.title).toBe('Google title');
    expect(r.conflicts).toEqual(['title']);
    expect(r.needsOutbound).toBe(false);
  });

  it('case 4 tie: equal timestamps -> Google wins (no write loop)', () => {
    const app = clone({ title: 'App title' });
    const google = clone({ title: 'Google title' });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, APP_NEWER);
    expect(r.merged.title).toBe('Google title');
  });

  it('case 4: missing Google `updated` -> the app wins', () => {
    const app = clone({ title: 'App title' });
    const google = clone({ title: 'Google title' });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, null);
    expect(r.merged.title).toBe('App title');
    expect(r.needsOutbound).toBe(true);
  });

  it('identical concurrent change -> no conflict, no outbound', () => {
    const app = clone({ description: 'same edit' });
    const google = clone({ description: 'same edit' });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.description).toBe('same edit');
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(false);
  });

  it('merges independent per-field changes from both sides', () => {
    const app = clone({ title: 'App title' });
    const google = clone({ location: 'Google room', description: 'g-desc' });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.title).toBe('App title');
    expect(r.merged.location).toBe('Google room');
    expect(r.merged.description).toBe('g-desc');
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(true); // app's title must flow out
  });
});

describe('threeWayMergeEvent — time composite', () => {
  it('start+end+allDay merge as ONE field (no start>end frankenevents)', () => {
    const app = clone({
      start: '2026-07-06T10:00:00.000Z',
      end: '2026-07-06T10:15:00.000Z',
    });
    const google = clone({
      start: '2026-07-06T08:00:00.000Z',
      end: '2026-07-06T08:15:00.000Z',
    });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, GOOGLE_NEWER);
    // Google newer: BOTH start and end come from Google, never mixed.
    expect(r.merged.start).toBe('2026-07-06T08:00:00.000Z');
    expect(r.merged.end).toBe('2026-07-06T08:15:00.000Z');
    expect(r.conflicts).toEqual(['time']);
  });

  it('app-only time change survives and requires outbound', () => {
    const app = clone({ end: '2026-07-06T09:45:00.000Z' });
    const r = threeWayMergeEvent(BASE, app, clone(), APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.end).toBe('2026-07-06T09:45:00.000Z');
    expect(r.appWon).toContain('time');
    expect(r.needsOutbound).toBe(true);
  });
});

describe('threeWayMergeEvent — exceptions set merge', () => {
  it('unions additions from both sides (occurrence deletions never resurrect)', () => {
    const app = clone({
      exceptions: [...BASE.exceptions, '2026-07-20T09:00:00.000Z'],
    });
    const google = clone({
      exceptions: [...BASE.exceptions, '2026-07-27T09:00:00.000Z'],
    });
    const r = threeWayMergeEvent(BASE, app, google, APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.exceptions).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-20T09:00:00.000Z',
      '2026-07-27T09:00:00.000Z',
    ]);
    // Both sides win partially; the app's addition must flow out.
    expect(r.appWon).toContain('exceptions');
    expect(r.googleWon).toContain('exceptions');
    expect(r.conflicts).toEqual([]);
    expect(r.needsOutbound).toBe(true);
  });

  it('a removal on one side beats a concurrent keep on the other', () => {
    const app = clone({ exceptions: [] }); // app removed the exception
    const r = threeWayMergeEvent(BASE, app, clone(), APP_NEWER, GOOGLE_NEWER);
    expect(r.merged.exceptions).toEqual([]);
    expect(r.needsOutbound).toBe(true);
  });
});

describe('threeWayMergeEvent — no-base LWW fallback', () => {
  it('equal states -> no-op', () => {
    const r = threeWayMergeEvent(
      null,
      clone(),
      clone(),
      APP_NEWER,
      GOOGLE_NEWER
    );
    expect(r.needsOutbound).toBe(false);
    expect(r.conflicts).toEqual([]);
  });

  it('differing states: whole event LWW (app newer)', () => {
    const app = clone({ title: 'App', location: 'A' });
    const google = clone({ title: 'Google', description: 'G' });
    const r = threeWayMergeEvent(null, app, google, GOOGLE_NEWER, APP_NEWER);
    expect(syncedFieldsEqual(r.merged, app)).toBe(true);
    expect(r.needsOutbound).toBe(true);
  });

  it('differing states: whole event LWW (Google newer)', () => {
    const app = clone({ title: 'App' });
    const google = clone({ title: 'Google' });
    const r = threeWayMergeEvent(null, app, google, APP_NEWER, GOOGLE_NEWER);
    expect(syncedFieldsEqual(r.merged, google)).toBe(true);
    expect(r.needsOutbound).toBe(false);
  });
});

describe('normalization helpers', () => {
  it('normalizeSnapshot round-trips a stored snapshot', () => {
    const parsed = normalizeSnapshot(JSON.parse(JSON.stringify(BASE)));
    expect(parsed).toEqual(BASE);
  });

  it('normalizeSnapshot rejects malformed snapshots', () => {
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot('nope')).toBeNull();
    expect(normalizeSnapshot({ title: 42 })).toBeNull();
    expect(
      normalizeSnapshot({ title: 'x', start: 'bad', end: 'bad' })
    ).toBeNull();
  });

  it('normalizeSnapshot dedupes/sorts exceptions and normalizes dates', () => {
    const s = normalizeSnapshot({
      ...BASE,
      start: '2026-07-06T09:00:00Z', // second precision -> ms-normalized
      exceptions: [
        '2026-07-20T09:00:00.000Z',
        '2026-07-13T09:00:00Z',
        '2026-07-20T09:00:00.000Z',
      ],
    })!;
    expect(s.start).toBe('2026-07-06T09:00:00.000Z');
    expect(s.exceptions).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-20T09:00:00.000Z',
    ]);
  });

  it('appFieldsToSynced/syncedToAppFields round-trip', () => {
    const app = syncedToAppFields(BASE);
    expect(app.start).toBeInstanceOf(Date);
    expect(appFieldsToSynced(app)).toEqual(BASE);
  });
});
