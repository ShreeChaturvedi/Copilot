/**
 * Per-field three-way merge for concurrently edited events (plan §5).
 *
 * Pure functions, no I/O. The base is the googleSyncSnapshot captured at the
 * last successful sync; app is the current local row; google is the mapped
 * inbound payload. Per synced field:
 *
 *   1. app == base && google == base  -> keep base (no-op)
 *   2. app == base && google != base  -> take Google's value
 *   3. app != base && google == base  -> keep the app's value (outbound patch)
 *   4. app != base && google != base  -> true conflict: last-write-wins on the
 *      whole field by events."updatedAt" vs Google `updated`
 *
 * Field granularity: title / description / location / recurrence are scalar
 * fields; {start, end, allDay} merge as ONE composite "time" field (merging
 * start and end independently could produce start > end); exceptions[] gets a
 * real three-way SET merge (additions and removals from both sides both
 * apply) and therefore never conflicts — deleting an occurrence on either
 * side sticks.
 *
 * No base (legacy rows, or an app-origin row whose first outbound write has
 * not completed): degrade to whole-event LWW.
 *
 * Tie-breaks: equal timestamps -> Google wins (inbound is authoritative, and
 * taking the remote value cannot start an outbound write loop). A missing
 * Google `updated` -> the app wins (we cannot show Google is newer).
 */
import type { AppEventFields } from './mapping.js';

/** The synced-field set, normalized for comparison (dates as UTC ISO). */
export interface SyncedFields {
  title: string;
  description: string | null;
  location: string | null;
  /** UTC ISO string (Date.toISOString() format). */
  start: string;
  end: string;
  allDay: boolean;
  recurrence: string | null;
  /** Sorted, deduped UTC ISO strings. */
  exceptions: string[];
}

export type MergeFieldName =
  | 'title'
  | 'description'
  | 'location'
  | 'time'
  | 'recurrence'
  | 'exceptions';

export interface MergeResult {
  merged: SyncedFields;
  /** Fields where the app's change survived over Google's version. */
  appWon: MergeFieldName[];
  /** Fields where Google's change was applied over the app's version. */
  googleWon: MergeFieldName[];
  /** Fields where both sides changed and LWW decided (subset of the above). */
  conflicts: MergeFieldName[];
  /** True when merged != Google's version: an outbound patch must follow. */
  needsOutbound: boolean;
}

// --- normalization ------------------------------------------------------------

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeExceptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const v of value) {
    const iso = isoOrNull(v);
    if (iso) out.add(iso);
  }
  return [...out].sort();
}

/** AppEventFields (Dates) -> comparable SyncedFields. */
export function appFieldsToSynced(f: AppEventFields): SyncedFields {
  return {
    title: f.title,
    description: f.description ?? null,
    location: f.location ?? null,
    start: f.start.toISOString(),
    end: f.end.toISOString(),
    allDay: !!f.allDay,
    recurrence: f.recurrence ?? null,
    exceptions: normalizeExceptions(f.exceptions),
  };
}

/** SyncedFields -> AppEventFields (for repo writes / payload building). */
export function syncedToAppFields(s: SyncedFields): AppEventFields {
  return {
    title: s.title,
    description: s.description,
    location: s.location,
    start: new Date(s.start),
    end: new Date(s.end),
    allDay: s.allDay,
    recurrence: s.recurrence,
    exceptions: [...s.exceptions],
  };
}

/**
 * Instance-derived exclusions recorded on a snapshot (jsonb key
 * `instanceExceptions`): occurrence starts excluded locally because Google
 * models them as override/cancelled INSTANCES of the master, not as EXDATE
 * lines. They live in the app row's exceptions[] but are invisible in
 * Google's recurrence[], so they must be filtered out of both sides of the
 * exceptions merge and out of every outbound EXDATE payload — writing an
 * EXDATE for an overridden instance cancels the override on Google.
 */
export function instanceExceptionsOf(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  return normalizeExceptions(
    (raw as Record<string, unknown>).instanceExceptions
  );
}

/**
 * Parse a stored googleSyncSnapshot (jsonb -> object) into SyncedFields.
 * Returns null on any malformed/missing snapshot (merge degrades to LWW).
 * The `exceptions` here are the EXDATE-backed set only; instance-derived
 * exclusions are read separately via instanceExceptionsOf().
 */
export function normalizeSnapshot(raw: unknown): SyncedFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const start = isoOrNull(o.start);
  const end = isoOrNull(o.end);
  if (typeof o.title !== 'string' || !start || !end) return null;
  return {
    title: o.title,
    description: typeof o.description === 'string' ? o.description : null,
    location: typeof o.location === 'string' ? o.location : null,
    start,
    end,
    allDay: !!o.allDay,
    recurrence: typeof o.recurrence === 'string' ? o.recurrence : null,
    exceptions: normalizeExceptions(o.exceptions),
  };
}

// --- equality -----------------------------------------------------------------

function exceptionsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function timeEqual(a: SyncedFields, b: SyncedFields): boolean {
  return a.start === b.start && a.end === b.end && a.allDay === b.allDay;
}

/** Whole synced-field-set equality (normalized inputs). */
export function syncedFieldsEqual(a: SyncedFields, b: SyncedFields): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.location === b.location &&
    timeEqual(a, b) &&
    a.recurrence === b.recurrence &&
    exceptionsEqual(a.exceptions, b.exceptions)
  );
}

// --- merge ---------------------------------------------------------------------

const SCALAR_FIELDS = [
  'title',
  'description',
  'location',
  'recurrence',
] as const;

/**
 * Three-way merge of one event's synced fields. `appUpdatedAt` is the local
 * row's updatedAt; `googleUpdatedAt` is Google's `updated` (null when the
 * payload omitted it).
 */
export function threeWayMergeEvent(
  base: SyncedFields | null,
  app: SyncedFields,
  google: SyncedFields,
  appUpdatedAt: Date,
  googleUpdatedAt: Date | null
): MergeResult {
  const appWinsLww =
    googleUpdatedAt === null ||
    appUpdatedAt.getTime() > googleUpdatedAt.getTime();

  const appWon: MergeFieldName[] = [];
  const googleWon: MergeFieldName[] = [];
  const conflicts: MergeFieldName[] = [];

  if (!base) {
    // No snapshot to diff against: whole-event LWW (plan §5 fallback).
    if (syncedFieldsEqual(app, google)) {
      return {
        merged: { ...google, exceptions: [...google.exceptions] },
        appWon,
        googleWon,
        conflicts,
        needsOutbound: false,
      };
    }
    const merged = appWinsLww ? app : google;
    (appWinsLww ? appWon : googleWon).push(
      'title',
      'description',
      'location',
      'time',
      'recurrence',
      'exceptions'
    );
    conflicts.push(...(appWinsLww ? appWon : googleWon));
    return {
      merged: { ...merged, exceptions: [...merged.exceptions] },
      appWon,
      googleWon,
      conflicts,
      needsOutbound: !syncedFieldsEqual(merged, google),
    };
  }

  const merged: SyncedFields = { ...app, exceptions: [...app.exceptions] };

  // Scalar fields: the 4-case table with per-field LWW on true conflicts.
  for (const field of SCALAR_FIELDS) {
    const b = base[field];
    const a = app[field];
    const g = google[field];
    if (a === b && g === b) {
      merged[field] = b as never;
    } else if (a === b) {
      merged[field] = g as never; // only Google changed
      googleWon.push(field);
    } else if (g === b) {
      merged[field] = a as never; // only the app changed
      appWon.push(field);
    } else if (a === g) {
      merged[field] = a as never; // both made the same change
    } else {
      conflicts.push(field);
      if (appWinsLww) {
        merged[field] = a as never;
        appWon.push(field);
      } else {
        merged[field] = g as never;
        googleWon.push(field);
      }
    }
  }

  // Time: {start, end, allDay} as one composite field.
  const appTimeChanged = !timeEqual(app, base);
  const googleTimeChanged = !timeEqual(google, base);
  const pickTime = (src: SyncedFields) => {
    merged.start = src.start;
    merged.end = src.end;
    merged.allDay = src.allDay;
  };
  if (!appTimeChanged && !googleTimeChanged) {
    pickTime(base);
  } else if (!appTimeChanged) {
    pickTime(google);
    googleWon.push('time');
  } else if (!googleTimeChanged) {
    pickTime(app);
    appWon.push('time');
  } else if (timeEqual(app, google)) {
    pickTime(app); // identical concurrent change
  } else {
    conflicts.push('time');
    if (appWinsLww) {
      pickTime(app);
      appWon.push('time');
    } else {
      pickTime(google);
      googleWon.push('time');
    }
  }

  // Exceptions: proper three-way SET merge — additions and removals from both
  // sides apply; removal (an occurrence deletion) beats a concurrent re-add.
  const baseSet = new Set(base.exceptions);
  const appSet = new Set(app.exceptions);
  const googleSet = new Set(google.exceptions);
  const mergedSet = new Set<string>();
  for (const v of new Set([...baseSet, ...appSet, ...googleSet])) {
    const inBase = baseSet.has(v);
    const inApp = appSet.has(v);
    const inGoogle = googleSet.has(v);
    // Present unless someone who knew about it removed it.
    const removed = (inBase && !inApp) || (inBase && !inGoogle);
    if (!removed && (inApp || inGoogle)) mergedSet.add(v);
  }
  merged.exceptions = [...mergedSet].sort();
  if (!exceptionsEqual(merged.exceptions, google.exceptions)) {
    appWon.push('exceptions');
  }
  if (!exceptionsEqual(merged.exceptions, app.exceptions)) {
    googleWon.push('exceptions');
  }

  return {
    merged,
    appWon,
    googleWon,
    conflicts,
    needsOutbound: !syncedFieldsEqual(merged, google),
  };
}
