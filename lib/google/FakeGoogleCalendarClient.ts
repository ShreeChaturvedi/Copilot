/**
 * In-memory GoogleCalendarClient for tests (plan §9).
 *
 * Honors the contract the sync engine relies on:
 *  - assigns ids/etags; bumps etag + `updated` on every write
 *  - If-Match -> EtagMismatchError (412) on a stale etag
 *  - syncToken stream backed by a change journal; incremental listEvents
 *    returns the latest state of every event changed since the token
 *  - deletes surface as `status: 'cancelled'` items in incremental results
 *  - paging via pageToken/maxResults; nextSyncToken only on the last page
 *  - `expireSyncTokens()` makes the next incremental call throw
 *    SyncTokenGoneError (410) so full-resync paths can be exercised
 */
import type { GoogleCalendarClient } from './GoogleCalendarClient.js';
import {
  EtagMismatchError,
  GoogleApiError,
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

interface CalendarState {
  meta: GCalCalendarListEntry;
  events: Map<string, GCalEvent>;
  /** Append-only change journal of event ids; position = syncToken. */
  journal: string[];
}

export class FakeGoogleCalendarClient implements GoogleCalendarClient {
  private calendars = new Map<string, CalendarState>();
  private idCounter = 0;
  private clock = Date.parse('2026-07-01T00:00:00Z');
  private syncTokensExpired = false;
  /** Test hook: cap page size below maxResults to exercise paging. */
  forcePageSize?: number;
  readonly stoppedChannels: Array<{ id: string; resourceId: string }> = [];
  readonly watchedChannels: WatchRequest[] = [];

  constructor(private readonly primaryId = 'fake-primary@example.com') {
    this.addCalendar({
      id: primaryId,
      summary: 'Fake Primary',
      timeZone: 'UTC',
      primary: true,
    });
  }

  // --- test helpers ---------------------------------------------------------

  addCalendar(meta: GCalCalendarListEntry): void {
    this.calendars.set(meta.id, { meta, events: new Map(), journal: [] });
  }

  /** Insert a fully-formed event payload (e.g. a recurring-instance shell). */
  injectEvent(
    calId: string,
    event: Partial<GCalEvent> & { id: string }
  ): GCalEvent {
    const cal = this.getCal(calId);
    const full: GCalEvent = {
      etag: `"${this.nextTick()}"`,
      updated: this.nowIso(),
      status: 'confirmed',
      ...event,
    } as GCalEvent;
    cal.events.set(full.id, full);
    cal.journal.push(full.id);
    return full;
  }

  /** Make every outstanding syncToken invalid: next incremental call 410s. */
  expireSyncTokens(): void {
    this.syncTokensExpired = true;
  }

  getStoredEvent(calId: string, eventId: string): GCalEvent | undefined {
    return this.getCal(calId).events.get(eventId);
  }

  // --- internals -------------------------------------------------------------

  private nextTick(): number {
    this.clock += 1000;
    return this.clock;
  }

  private nowIso(): string {
    return new Date(this.clock).toISOString();
  }

  private resolveCalId(calId: string): string {
    return calId === 'primary' ? this.primaryId : calId;
  }

  private getCal(calId: string): CalendarState {
    const cal = this.calendars.get(this.resolveCalId(calId));
    if (!cal) {
      throw new GoogleApiError(404, 'notFound', `Calendar ${calId} not found`);
    }
    return cal;
  }

  private touch(cal: CalendarState, event: GCalEvent): void {
    event.etag = `"${this.nextTick()}"`;
    event.updated = this.nowIso();
    cal.journal.push(event.id);
  }

  private page(
    items: GCalEvent[],
    params: ListParams,
    tokenAtEnd: string
  ): EventsPage {
    const pageSize = this.forcePageSize ?? params.maxResults ?? 250;
    const offset = params.pageToken ? parseInt(params.pageToken, 10) : 0;
    const slice = items.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;
    if (nextOffset < items.length) {
      return { items: slice, nextPageToken: String(nextOffset) };
    }
    return { items: slice, nextSyncToken: tokenAtEnd };
  }

  // --- GoogleCalendarClient ---------------------------------------------------

  async listEvents(calId: string, params: ListParams): Promise<EventsPage> {
    if (params.singleEvents) {
      throw new GoogleApiError(
        400,
        'badRequest',
        'Fake only supports singleEvents=false (masters with recurrence[])'
      );
    }
    const cal = this.getCal(calId);
    const tokenAtEnd = `st:${cal.journal.length}`;

    if (params.syncToken) {
      if (params.timeMin) {
        // Google rejects timeMin/timeMax together with syncToken.
        throw new GoogleApiError(
          400,
          'badRequest',
          'syncToken cannot be combined with timeMin'
        );
      }
      if (this.syncTokensExpired || !params.syncToken.startsWith('st:')) {
        this.syncTokensExpired = false;
        throw new SyncTokenGoneError();
      }
      const since = parseInt(params.syncToken.slice(3), 10);
      const changedIds = [...new Set(cal.journal.slice(since))];
      const items = changedIds
        .map((id) => cal.events.get(id))
        .filter((e): e is GCalEvent => !!e)
        .map((e) => ({ ...e }));
      return this.page(items, params, tokenAtEnd);
    }

    // Full listing: active events only, EXCEPT cancelled instances of
    // recurring events, which Google includes even with showDeleted=false as
    // long as singleEvents is also false (events.list reference). timeMin is
    // honored loosely: recurring masters always pass, timed events pass when
    // they end at/after timeMin (parity with Google).
    const timeMin = params.timeMin ? Date.parse(params.timeMin) : undefined;
    const items = [...cal.events.values()]
      .filter(
        (e) =>
          e.status !== 'cancelled' || params.showDeleted || !!e.recurringEventId
      )
      .filter((e) => {
        if (timeMin === undefined || e.recurrence?.length) return true;
        const end = e.end?.dateTime ?? e.end?.date;
        return end === undefined || Date.parse(end) >= timeMin;
      })
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => ({ ...e }));
    return this.page(items, params, tokenAtEnd);
  }

  async getCalendar(calId: string): Promise<GCalCalendar> {
    const { meta } = this.getCal(calId);
    return { id: meta.id, summary: meta.summary, timeZone: meta.timeZone };
  }

  async listCalendars(): Promise<GCalCalendarListEntry[]> {
    return [...this.calendars.values()].map((c) => ({ ...c.meta }));
  }

  async insertEvent(calId: string, body: GCalEventInput): Promise<GCalEvent> {
    const cal = this.getCal(calId);
    const event: GCalEvent = {
      id: `fake-ev-${++this.idCounter}`,
      etag: '',
      status: body.status ?? 'confirmed',
      summary: body.summary,
      description: body.description ?? undefined,
      location: body.location ?? undefined,
      start: body.start,
      end: body.end,
      recurrence: body.recurrence ?? undefined,
      created: this.nowIso(),
    };
    cal.events.set(event.id, event);
    this.touch(cal, event);
    return { ...event };
  }

  async patchEvent(
    calId: string,
    eventId: string,
    body: Partial<GCalEventInput>,
    ifMatchEtag?: string
  ): Promise<GCalEvent> {
    const cal = this.getCal(calId);
    const event = cal.events.get(eventId);
    if (!event) {
      throw new GoogleApiError(404, 'notFound', `Event ${eventId} not found`);
    }
    if (ifMatchEtag && ifMatchEtag !== event.etag) {
      throw new EtagMismatchError();
    }
    if (body.summary !== undefined) event.summary = body.summary;
    if (body.description !== undefined) {
      event.description = body.description ?? undefined;
    }
    if (body.location !== undefined) {
      event.location = body.location ?? undefined;
    }
    if (body.start !== undefined) event.start = body.start;
    if (body.end !== undefined) event.end = body.end;
    if (body.recurrence !== undefined) {
      event.recurrence = body.recurrence ?? undefined;
    }
    if (body.status !== undefined) event.status = body.status;
    this.touch(cal, event);
    return { ...event };
  }

  async deleteEvent(
    calId: string,
    eventId: string,
    ifMatchEtag?: string
  ): Promise<void> {
    const cal = this.getCal(calId);
    const event = cal.events.get(eventId);
    if (!event) {
      throw new GoogleApiError(404, 'notFound', `Event ${eventId} not found`);
    }
    if (ifMatchEtag && ifMatchEtag !== event.etag) {
      throw new EtagMismatchError();
    }
    event.status = 'cancelled';
    this.touch(cal, event);
  }

  async watchEvents(
    _calId: string,
    channel: WatchRequest
  ): Promise<WatchResponse> {
    this.watchedChannels.push(channel);
    return {
      id: channel.id,
      resourceId: `fake-resource-${channel.id}`,
      expiration: String(this.clock + 604_800_000),
    };
  }

  async stopChannel(channelId: string, resourceId: string): Promise<void> {
    this.stoppedChannels.push({ id: channelId, resourceId });
  }
}
