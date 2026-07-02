/**
 * Inbound sync engine: Google -> Taskflow (plan §3). M1 scope: initial full
 * import and incremental pull. All inbound paths (manual "Sync now", the
 * 15-min reconciliation cron, and the M3 webhook) converge on syncCalendar().
 *
 * Invariants:
 *  - events.list always uses singleEvents=false (masters keep recurrence[]).
 *  - Full sync: timeMin = now - 1y, identical across pages; incremental
 *    requests send only syncToken (+ singleEvents/maxResults) — Google
 *    forbids timeMin with syncToken.
 *  - nextSyncToken appears only on the last page and is persisted only after
 *    every page committed. Pages are processed transactionally per page.
 *  - 410 GONE: clear the stored token and run a full import; the "wipe" is
 *    logical — re-upsert by googleEventId plus a deletion sweep of mapped
 *    rows missing from the fresh feed.
 *  - Recurring-instance shells (recurringEventId set) are buffered and
 *    processed after all pages so their masters exist locally first.
 *  - Echo suppression (live in M2, written now): items whose etag equals the
 *    stored events.googleEtag are our own writes coming back -> skipped.
 *
 * M2 will add: outbox drain (google_sync_ops), per-field three-way merge via
 * googleSyncSnapshot, tombstone-aware edit-vs-delete resolution.
 */
import type { PoolClient } from 'pg';
import type { GoogleCalendarClient } from './GoogleCalendarClient.js';
import { SyncTokenGoneError, type GCalEvent } from './types.js';
import {
  googleEventToApp,
  originalStartToIso,
  MappingError,
} from './mapping.js';
import * as repo from './syncRepo.js';
import type { CalendarLinkRow } from './syncRepo.js';

export interface SyncStats {
  mode: 'full' | 'incremental';
  inserted: number;
  updated: number;
  deleted: number;
  exceptionsApplied: number;
  skipped: number;
  pages: number;
}

const MAX_RESULTS = 2500;
const FULL_SYNC_WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // 1 year back

function newStats(mode: SyncStats['mode']): SyncStats {
  return {
    mode,
    inserted: 0,
    updated: 0,
    deleted: 0,
    exceptionsApplied: 0,
    skipped: 0,
    pages: 0,
  };
}

export class GoogleSyncService {
  /**
   * Sync one linked calendar: incremental when a syncToken is stored, full
   * import otherwise. On success updates the link's sync state; on failure
   * records lastError on the link and rethrows for the caller's error
   * mapping (needsReauth etc.).
   */
  async syncCalendar(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    try {
      const stats = link.syncToken
        ? await this.incrementalSync(client, link)
        : await this.fullImport(client, link);
      await repo.updateLinkSyncState(link.id, {
        lastSyncedAt: new Date(),
        lastError: null,
      });
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo
        .updateLinkSyncState(link.id, { lastError: message })
        .catch(() => {});
      throw error;
    }
  }

  /**
   * Initial full import (and post-410 resync). Pages the window, upserts
   * masters/one-offs per page, folds instance shells at the end, sweeps
   * mapped rows missing from the feed, then persists the fresh syncToken.
   */
  async fullImport(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    const stats = newStats('full');
    const windowStart = new Date(Date.now() - FULL_SYNC_WINDOW_MS);
    const instanceItems: GCalEvent[] = [];
    const seenIds: string[] = [];
    let pageToken: string | undefined;
    let syncToken: string | undefined;

    do {
      const page = await client.listEvents(link.googleCalendarId, {
        singleEvents: false,
        maxResults: MAX_RESULTS,
        timeMin: windowStart.toISOString(),
        pageToken,
      });
      stats.pages++;
      const items = page.items ?? [];
      seenIds.push(...items.map((e) => e.id));

      // Masters/one-offs now; instance shells after all pages (their master
      // may be on a later page).
      const masters = items.filter((e) => !e.recurringEventId);
      instanceItems.push(...items.filter((e) => !!e.recurringEventId));

      await repo.withTransaction(async (tx) => {
        for (const item of masters) {
          await this.processMasterItem(tx, link, item, stats);
        }
      });

      pageToken = page.nextPageToken;
      if (!pageToken) syncToken = page.nextSyncToken;
    } while (pageToken);

    await repo.withTransaction(async (tx) => {
      for (const item of instanceItems) {
        await this.processInstanceItem(tx, link, item, stats);
      }
      stats.deleted += await repo.deleteMappedEventsNotSeen(
        tx,
        link.userId,
        link.googleCalendarId,
        seenIds,
        windowStart
      );
    });

    const now = new Date();
    await repo.updateLinkSyncState(link.id, {
      syncToken: syncToken ?? null,
      lastFullSyncAt: now,
      lastSyncedAt: now,
      lastError: null,
    });
    return stats;
  }

  /**
   * Incremental pull with the stored syncToken. 410 -> clear token, full
   * import. The new token is persisted only after every page committed.
   */
  async incrementalSync(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    if (!link.syncToken) return this.fullImport(client, link);

    const stats = newStats('incremental');
    const instanceItems: GCalEvent[] = [];
    let pageToken: string | undefined;
    const syncToken: string | undefined = link.syncToken;
    let nextSyncToken: string | undefined;

    try {
      do {
        const page = await client.listEvents(link.googleCalendarId, {
          singleEvents: false,
          maxResults: MAX_RESULTS,
          syncToken,
          pageToken,
        });
        stats.pages++;
        const items = page.items ?? [];
        const masters = items.filter((e) => !e.recurringEventId);
        instanceItems.push(...items.filter((e) => !!e.recurringEventId));

        await repo.withTransaction(async (tx) => {
          for (const item of masters) {
            await this.processMasterItem(tx, link, item, stats);
          }
        });

        pageToken = page.nextPageToken;
        if (!pageToken) nextSyncToken = page.nextSyncToken;
      } while (pageToken);
    } catch (error) {
      if (error instanceof SyncTokenGoneError) {
        // Stale token: clear storage and full-resync (events.list reference).
        await repo.updateLinkSyncState(link.id, { syncToken: null });
        return this.fullImport(client, { ...link, syncToken: null });
      }
      throw error;
    }

    await repo.withTransaction(async (tx) => {
      for (const item of instanceItems) {
        await this.processInstanceItem(tx, link, item, stats);
      }
    });

    await repo.updateLinkSyncState(link.id, {
      syncToken: nextSyncToken ?? link.syncToken,
      lastSyncedAt: new Date(),
      lastError: null,
    });
    return stats;
  }

  /** Handle a master/one-off item (no recurringEventId). */
  private async processMasterItem(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    if (item.status === 'cancelled') {
      stats.deleted += await repo.deleteEventByGoogleId(
        tx,
        link.userId,
        item.id
      );
      return;
    }

    // Echo suppression: our own write coming back (M2 sets googleEtag on
    // outbound writes; harmless and correct for inbound-only M1 re-lists).
    const existing = await repo.getEventByGoogleId(link.userId, item.id, tx);
    if (existing && existing.googleEtag === item.etag) {
      stats.skipped++;
      return;
    }

    let fields;
    try {
      fields = googleEventToApp(item);
    } catch (error) {
      if (error instanceof MappingError) {
        console.warn(
          `Skipping unmappable Google event ${item.id}:`,
          error.message
        );
        stats.skipped++;
        return;
      }
      throw error;
    }

    const result = await repo.upsertEventFromGoogle(tx, {
      userId: link.userId,
      appCalendarId: link.appCalendarId,
      googleCalendarId: link.googleCalendarId,
      googleEventId: item.id,
      etag: item.etag,
      googleUpdatedAt: item.updated ? new Date(item.updated) : null,
      fields,
    });
    if (result === 'inserted') stats.inserted++;
    else stats.updated++;
  }

  /**
   * Handle a recurring-instance shell (recurringEventId set): map to the
   * app's native pattern — the master gets the original occurrence start in
   * exceptions[]; a modified instance additionally becomes a standalone app
   * event mapped to the instance's own Google id (plan §3).
   */
  private async processInstanceItem(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    const masterGoogleId = item.recurringEventId!;
    let originalIso: string | null = null;
    if (item.originalStartTime) {
      try {
        originalIso = originalStartToIso(item.originalStartTime);
      } catch {
        originalIso = null;
      }
    }

    if (originalIso) {
      const added = await repo.addExceptionToMaster(
        tx,
        link.userId,
        masterGoogleId,
        originalIso
      );
      if (added) stats.exceptionsApplied++;
    }

    if (item.status === 'cancelled') {
      // Cancelled instance: exception on the master is the whole story;
      // also drop any previously-imported standalone row for this instance.
      stats.deleted += await repo.deleteEventByGoogleId(
        tx,
        link.userId,
        item.id
      );
      return;
    }

    const existing = await repo.getEventByGoogleId(link.userId, item.id, tx);
    if (existing && existing.googleEtag === item.etag) {
      stats.skipped++;
      return;
    }

    let fields;
    try {
      fields = googleEventToApp(item);
    } catch (error) {
      if (error instanceof MappingError) {
        stats.skipped++;
        return;
      }
      throw error;
    }

    const result = await repo.upsertEventFromGoogle(tx, {
      userId: link.userId,
      appCalendarId: link.appCalendarId,
      googleCalendarId: link.googleCalendarId,
      googleEventId: item.id,
      etag: item.etag,
      googleUpdatedAt: item.updated ? new Date(item.updated) : null,
      fields,
    });
    if (result === 'inserted') stats.inserted++;
    else stats.updated++;
  }
}

export const googleSyncService = new GoogleSyncService();
