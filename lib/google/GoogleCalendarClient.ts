/**
 * Thin typed client for the Google Calendar v3 REST API (plan §4).
 *
 * fetch-based; no `googleapis` dependency. Access tokens are supplied by an
 * injected provider (the sync engine wires refresh-token -> access-token
 * exchange via google-auth-library). HTTP failures are mapped to the typed
 * errors in ./types.ts. 403/429 rate limits and 5xx are retried in-request
 * with truncated exponential backoff (plan §8); durable retry is the caller's
 * job (google_sync_ops outbox / reconciliation cron).
 */
import {
  EtagMismatchError,
  GoogleApiError,
  RateLimitedError,
  ReauthRequiredError,
  SyncTokenGoneError,
  type EventsPage,
  type GCalCalendar,
  type GCalCalendarListEntry,
  type GCalEvent,
  type GCalEventInput,
  type ListParams,
  type WatchRequest,
  type WatchResponse,
} from './types.js';

export interface GoogleCalendarClient {
  /** events.list; syncToken/pageToken aware; 410 -> SyncTokenGoneError. */
  listEvents(calId: string, params: ListParams): Promise<EventsPage>;
  /** calendars.get; resolves 'primary' -> the real calendar id. */
  getCalendar(calId: string): Promise<GCalCalendar>;
  /** calendarList.list (needs a calendarlist scope; M4). */
  listCalendars(): Promise<GCalCalendarListEntry[]>;
  insertEvent(calId: string, body: GCalEventInput): Promise<GCalEvent>;
  patchEvent(
    calId: string,
    eventId: string,
    body: Partial<GCalEventInput>,
    ifMatchEtag?: string
  ): Promise<GCalEvent>;
  deleteEvent(
    calId: string,
    eventId: string,
    ifMatchEtag?: string
  ): Promise<void>;
  watchEvents(calId: string, channel: WatchRequest): Promise<WatchResponse>;
  stopChannel(channelId: string, resourceId: string): Promise<void>;
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3';
const MAX_RETRIES = 4;
const MAX_BACKOFF_MS = 32_000;

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    status?: string;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** min(2^n s + jitter(<=1s), 32s) per plan §8. */
function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt * 1000 + Math.random() * 1000, MAX_BACKOFF_MS);
}

export class FetchGoogleCalendarClient implements GoogleCalendarClient {
  constructor(
    /** Returns a currently-valid OAuth access token. */
    private readonly getAccessToken: () => Promise<string>,
    /** Injectable for tests. */
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private async request<T>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
      expectEmpty?: boolean;
    } = {}
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getAccessToken();
      const res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(opts.headers ?? {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

      if (res.ok) {
        if (opts.expectEmpty || res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      const error = await this.toTypedError(res);
      const retryable = error instanceof RateLimitedError || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) throw error;

      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_BACKOFF_MS)
          : backoffMs(attempt)
      );
      lastError = error;
    }
    /* istanbul ignore next -- loop always throws or returns */
    throw lastError ?? new GoogleApiError(0, undefined, 'Request failed');
  }

  private async toTypedError(res: Response): Promise<GoogleApiError> {
    let body: GoogleErrorBody = {};
    try {
      body = (await res.json()) as GoogleErrorBody;
    } catch {
      // non-JSON error body; fall through with status only
    }
    const reason = body.error?.errors?.[0]?.reason ?? body.error?.status;
    const message = body.error?.message ?? `Google API error ${res.status}`;

    if (res.status === 401) return new ReauthRequiredError(message);
    if (
      (res.status === 403 || res.status === 429) &&
      /rateLimitExceeded|userRateLimitExceeded/i.test(reason ?? '')
    ) {
      return new RateLimitedError(res.status, message);
    }
    if (res.status === 410) return new SyncTokenGoneError(message);
    if (res.status === 412) return new EtagMismatchError(message);
    return new GoogleApiError(res.status, reason, message);
  }

  async listEvents(calId: string, params: ListParams): Promise<EventsPage> {
    return this.request<EventsPage>(
      'GET',
      `/calendars/${encodeURIComponent(calId)}/events`,
      {
        query: {
          syncToken: params.syncToken,
          pageToken: params.pageToken,
          timeMin: params.timeMin,
          maxResults: params.maxResults,
          singleEvents: params.singleEvents ?? false,
          showDeleted: params.showDeleted,
        },
      }
    );
  }

  async getCalendar(calId: string): Promise<GCalCalendar> {
    return this.request<GCalCalendar>(
      'GET',
      `/calendars/${encodeURIComponent(calId)}`
    );
  }

  async listCalendars(): Promise<GCalCalendarListEntry[]> {
    const page = await this.request<{ items?: GCalCalendarListEntry[] }>(
      'GET',
      '/users/me/calendarList'
    );
    return page.items ?? [];
  }

  async insertEvent(calId: string, body: GCalEventInput): Promise<GCalEvent> {
    return this.request<GCalEvent>(
      'POST',
      `/calendars/${encodeURIComponent(calId)}/events`,
      { body }
    );
  }

  async patchEvent(
    calId: string,
    eventId: string,
    body: Partial<GCalEventInput>,
    ifMatchEtag?: string
  ): Promise<GCalEvent> {
    return this.request<GCalEvent>(
      'PATCH',
      `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        body,
        headers: ifMatchEtag ? { 'If-Match': ifMatchEtag } : undefined,
      }
    );
  }

  async deleteEvent(
    calId: string,
    eventId: string,
    ifMatchEtag?: string
  ): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        expectEmpty: true,
        headers: ifMatchEtag ? { 'If-Match': ifMatchEtag } : undefined,
      }
    );
  }

  async watchEvents(
    calId: string,
    channel: WatchRequest
  ): Promise<WatchResponse> {
    return this.request<WatchResponse>(
      'POST',
      `/calendars/${encodeURIComponent(calId)}/events/watch`,
      { body: channel }
    );
  }

  async stopChannel(channelId: string, resourceId: string): Promise<void> {
    await this.request<void>('POST', '/channels/stop', {
      body: { id: channelId, resourceId },
      expectEmpty: true,
    });
  }
}
