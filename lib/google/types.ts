/**
 * Google Calendar v3 wire types (subset used by the sync engine) and the
 * typed errors the client maps HTTP failures onto (plan §4).
 */

/** RFC3339 dateTime or all-day date, exactly one of the two set. */
export interface GCalEventDateTime {
  /** All-day date `yyyy-mm-dd` (end.date is EXCLUSIVE per Google). */
  date?: string;
  /** RFC3339 timestamp, e.g. `2026-07-01T14:00:00-04:00`. */
  dateTime?: string;
  /** IANA zone; required by Google for recurring event start/end. */
  timeZone?: string;
}

export interface GCalEvent {
  id: string;
  etag: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: GCalEventDateTime;
  end?: GCalEventDateTime;
  /** RFC5545 lines (RRULE/EXDATE/RDATE/EXRULE); DTSTART/DTEND never appear. */
  recurrence?: string[];
  /** Set on exception instances of a recurring event. */
  recurringEventId?: string;
  originalStartTime?: GCalEventDateTime;
  /** Last modification time of the main event data (RFC3339). */
  updated?: string;
  created?: string;
}

export interface GCalEventInput {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: GCalEventDateTime;
  end?: GCalEventDateTime;
  recurrence?: string[] | null;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface GCalCalendar {
  id: string;
  summary?: string;
  timeZone?: string;
}

export interface GCalCalendarListEntry extends GCalCalendar {
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export interface ListParams {
  /** Incremental sync token. Mutually exclusive with timeMin/timeMax. */
  syncToken?: string;
  pageToken?: string;
  /** RFC3339 lower bound; full-sync only (forbidden with syncToken). */
  timeMin?: string;
  maxResults?: number;
  /** Must stay false: masters with recurrence[] are only returned this way. */
  singleEvents?: boolean;
  showDeleted?: boolean;
}

export interface EventsPage {
  items: GCalEvent[];
  nextPageToken?: string;
  /** Present only on the final page of a (full or incremental) sync. */
  nextSyncToken?: string;
  timeZone?: string;
}

export interface WatchRequest {
  id: string;
  type: 'web_hook';
  address: string;
  token?: string;
  params?: { ttl?: string };
}

export interface WatchResponse {
  id: string;
  resourceId: string;
  /** ms since epoch, as a string. */
  expiration?: string;
}

// --- Typed error mapping (plan §4) -----------------------------------------

/** Base class for Google API failures. */
export class GoogleApiError extends Error {
  constructor(
    public status: number,
    public reason: string | undefined,
    message: string
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

/** 401 / invalid_grant: refresh token revoked or expired -> needsReauth. */
export class ReauthRequiredError extends GoogleApiError {
  constructor(message = 'Google authorization is no longer valid') {
    super(401, 'invalid_grant', message);
    this.name = 'ReauthRequiredError';
  }
}

/** 403/429 rateLimitExceeded / userRateLimitExceeded. */
export class RateLimitedError extends GoogleApiError {
  constructor(status: number, message = 'Google API rate limit exceeded') {
    super(status, 'rateLimitExceeded', message);
    this.name = 'RateLimitedError';
  }
}

/** 410 GONE on a stale syncToken: clear storage and full-resync. */
export class SyncTokenGoneError extends GoogleApiError {
  constructor(message = 'Sync token expired; full sync required') {
    super(410, 'fullSyncRequired', message);
    this.name = 'SyncTokenGoneError';
  }
}

/** 412 Precondition Failed on an If-Match write. */
export class EtagMismatchError extends GoogleApiError {
  constructor(message = 'Event changed concurrently on Google') {
    super(412, 'conditionNotMet', message);
    this.name = 'EtagMismatchError';
  }
}
